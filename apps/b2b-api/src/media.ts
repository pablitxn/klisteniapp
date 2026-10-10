import { randomUUID, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, link, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Readable } from 'node:stream';
import { inflateSync } from 'node:zlib';
import { HttpError } from './errors.ts';

export type MediaKind = 'image' | 'video' | 'model3d';
export const MEDIA_LIMITS: Readonly<Record<MediaKind, number>> = Object.freeze({ image: 8 * 1024 ** 2, video: 32 * 1024 ** 2, model3d: 24 * 1024 ** 2 });
const formats = {
  'image/jpeg': { kind: 'image', extension: 'jpg' }, 'image/png': { kind: 'image', extension: 'png' },
  'image/webp': { kind: 'image', extension: 'webp' }, 'video/mp4': { kind: 'video', extension: 'mp4' },
  'video/webm': { kind: 'video', extension: 'webm' }, 'model/gltf-binary': { kind: 'model3d', extension: 'glb' },
} as const;
type Mime = keyof typeof formats;
export type StoredMedia = { id: string; relativePath: string; mime: Mime; bytes: number; sha256: string; extension: string };
export type MediaReference = Pick<StoredMedia, 'id' | 'relativePath'> & { mime: string; bytes: number };
const invalid = () => new HttpError(415, 'INVALID_MEDIA', 'El archivo no es un medio válido o usa características no admitidas.');
function check(condition: unknown): asserts condition { if (!condition) throw invalid(); }
function dimensions(width: number, height: number) { check(width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 32_000_000); return width * height; }
const uint = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function object(value: unknown): Record<string, unknown> { check(value !== null && typeof value === 'object' && !Array.isArray(value)); return value as Record<string, unknown>; }
function array(value: unknown): unknown[] { check(Array.isArray(value)); return value; }

function png(data: Buffer) {
  check(data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  let at = 8, pixels = 0, header = false, endedPayload = false;
  const payload: Buffer[] = [], rows: number[] = [];
  while (at + 12 <= data.length) {
    const length = data.readUInt32BE(at), type = data.toString('ascii', at + 4, at + 8), end = at + 12 + length;
    check(end <= data.length);
    let crc = 0xffffffff;
    for (const byte of data.subarray(at + 4, end - 4)) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    check(((crc ^ 0xffffffff) >>> 0) === data.readUInt32BE(end - 4));
    if (!header) {
      check(type === 'IHDR' && length === 13);
      pixels = dimensions(data.readUInt32BE(at + 8), data.readUInt32BE(at + 12));
      const depths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      check(depths[data[at + 17]]?.includes(data[at + 16]) && data[at + 18] === 0 && data[at + 19] === 0 && data[at + 20] <= 1);
      const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }, bits = channels[data[at + 17]] * data[at + 16];
      const passes = data[at + 20] ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
      for (const [x, y, dx, dy] of passes) {
        const width = Math.max(0, Math.ceil((data.readUInt32BE(at + 8) - x) / dx)), height = Math.max(0, Math.ceil((data.readUInt32BE(at + 12) - y) / dy));
        if (width) for (let row = 0; row < height; row++) rows.push(1 + Math.ceil(width * bits / 8));
      }
      header = true;
    } else check(type !== 'IHDR');
    // Animated images are intentionally outside this image-upload profile.
    check(!['acTL', 'fcTL', 'fdAT'].includes(type));
    if (type === 'IDAT') { check(!endedPayload); payload.push(data.subarray(at + 8, at + 8 + length)); }
    else if (payload.length) endedPayload = true;
    if (type === 'IEND') {
      check(length === 0 && payload.length && end === data.length);
      const expected = rows.reduce((sum, row) => sum + row, 0); check(expected > 0 && expected <= 64 * 1024 ** 2);
      const compressed = Buffer.concat(payload);
      // Node's info:true result exposes consumed input; current typings omit that overload.
      const decoded = inflateSync(compressed, { maxOutputLength: expected + 1, info: true }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
      check(decoded.buffer.length === expected && decoded.engine.bytesWritten === compressed.length);
      let rowStart = 0; for (const size of rows) { check(decoded.buffer[rowStart] <= 4); rowStart += size; }
      return pixels;
    }
    at = end;
  }
  throw invalid();
}
function jpeg(data: Buffer) {
  check(data.length >= 12 && data.readUInt16BE(0) === 0xffd8 && data.readUInt16BE(data.length - 2) === 0xffd9);
  let at = 2, pixels = 0;
  while (at + 4 <= data.length) {
    check(data[at++] === 0xff);
    while (data[at] === 0xff) at++;
    const marker = data[at++];
    check(marker !== 0 && marker !== 0xd8 && marker !== 0xd9 && marker !== 0x01 && !(marker >= 0xd0 && marker <= 0xd7));
    const length = data.readUInt16BE(at); check(length >= 2 && at + length <= data.length);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      check(length >= 8 && data[at + 2] === 8 && [1, 3, 4].includes(data[at + 7]) && length === 8 + 3 * data[at + 7]);
      pixels = dimensions(data.readUInt16BE(at + 5), data.readUInt16BE(at + 3));
    }
    if (marker === 0xda) { check(pixels > 0 && at + length < data.length - 2); return pixels; }
    at += length;
  }
  throw invalid();
}
function webp(data: Buffer) {
  check(data.length >= 20 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' && data.readUInt32LE(4) + 8 === data.length);
  let at = 12, pixels = 0, image = false;
  while (at + 8 <= data.length) {
    const type = data.toString('ascii', at, at + 4), size = data.readUInt32LE(at + 4), start = at + 8;
    check(start + size + (size % 2) <= data.length && !['ANIM', 'ANMF'].includes(type));
    if (type === 'VP8X') {
      check(size === 10 && !(data[start] & 2));
      pixels = dimensions(1 + data.readUIntLE(start + 4, 3), 1 + data.readUIntLE(start + 7, 3));
    } else if (type === 'VP8 ') {
      check(size > 10 && data.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 1, 0x2a])) && !(data[start] & 1));
      const actual = dimensions(data.readUInt16LE(start + 6) & 0x3fff, data.readUInt16LE(start + 8) & 0x3fff);
      check(!image && (!pixels || actual === pixels)); pixels = actual; image = true;
    } else if (type === 'VP8L') {
      check(size > 5 && data[start] === 0x2f);
      const bits = data.readUInt32LE(start + 1); check((bits >>> 29) === 0);
      const actual = dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      check(!image && (!pixels || pixels === actual)); pixels = actual; image = true;
    }
    at = start + size + size % 2;
  }
  check(at === data.length && image); return pixels;
}

type Box = { type: string; start: number; end: number };
function boxes(data: Buffer, start: number, end: number): Box[] {
  const result: Box[] = []; let at = start;
  while (at < end) {
    check(at + 8 <= end && result.length < 10000);
    let size = data.readUInt32BE(at), header = 8;
    if (size === 1) { check(at + 16 <= end); const large = data.readBigUInt64BE(at + 8); check(large <= BigInt(Number.MAX_SAFE_INTEGER)); size = Number(large); header = 16; }
    else if (size === 0) size = end - at;
    check(size >= header && at + size <= end);
    result.push({ type: data.toString('ascii', at + 4, at + 8), start: at + header, end: at + size }); at += size;
  }
  return result;
}
function mp4(data: Buffer) {
  const top = boxes(data, 0, data.length), type = top[0];
  check(type?.type === 'ftyp' && type.end - type.start >= 8 && (type.end - type.start) % 4 === 0);
  const brands = [data.toString('ascii', type.start, type.start + 4)];
  for (let i = type.start + 8; i < type.end; i += 4) brands.push(data.toString('ascii', i, i + 4));
  check(brands.some(value => ['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V '].includes(value)));
  check(top.some(box => box.type === 'mdat' && box.end > box.start));
  const movie = top.find(box => box.type === 'moov'); check(movie);
  let video = false;
  function inspect(start: number, end: number, depth: number) {
    check(depth <= 8);
    for (const box of boxes(data, start, end)) {
      if (box.type === 'hdlr') { check(box.end - box.start >= 24); if (data.toString('ascii', box.start + 8, box.start + 12) === 'vide') video = true; }
      if (box.type === 'dref') {
        check(box.end - box.start >= 8);
        const refs = boxes(data, box.start + 8, box.end); check(refs.length === data.readUInt32BE(box.start + 4));
        for (const ref of refs) check(ref.type === 'url ' && ref.end - ref.start === 4 && data.readUInt32BE(ref.start) === 1);
      }
      if (['trak', 'mdia', 'minf', 'dinf', 'stbl'].includes(box.type)) inspect(box.start, box.end, depth + 1);
    }
  }
  inspect(movie.start, movie.end, 0); check(video);
}

function vint(data: Buffer, at: number, id: boolean) {
  check(at < data.length && data[at] !== 0);
  let width = 1; while (width <= 8 && !(data[at] & (1 << (8 - width)))) width++;
  check(width <= (id ? 4 : 8) && at + width <= data.length);
  let value = BigInt(id ? data[at] : data[at] & ((1 << (8 - width)) - 1));
  for (let i = 1; i < width; i++) value = (value << 8n) | BigInt(data[at + i]);
  const unknown = !id && value === (1n << BigInt(7 * width)) - 1n;
  check(unknown || value <= BigInt(Number.MAX_SAFE_INTEGER)); return { value: Number(value), width, unknown };
}
function ebml(data: Buffer, start: number, end: number) {
  const result: Array<{ id: number; start: number; end: number }> = []; let at = start;
  while (at < end) {
    check(result.length < 20000);
    const id = vint(data, at, true), length = vint(data, at + id.width, false), content = at + id.width + length.width;
    check(content <= end && (!length.unknown || id.value === 0x18538067 || id.value === 0x1f43b675));
    const finish = length.unknown ? end : content + length.value; check(finish <= end);
    result.push({ id: id.value, start: content, end: finish }); at = finish;
  }
  return result;
}
function webm(data: Buffer) {
  const top = ebml(data, 0, data.length); check(top[0]?.id === 0x1a45dfa3);
  const header = ebml(data, top[0].start, top[0].end), doc = header.find(item => item.id === 0x4282);
  check(doc && data.toString('ascii', doc.start, doc.end) === 'webm');
  const segment = top.find(item => item.id === 0x18538067); check(segment);
  const children = ebml(data, segment.start, segment.end), tracks = children.find(item => item.id === 0x1654ae6b);
  check(tracks && children.some(item => item.id === 0x1f43b675 && item.end > item.start));
  let video = false;
  for (const entry of ebml(data, tracks.start, tracks.end).filter(item => item.id === 0xae)) {
    const fields = ebml(data, entry.start, entry.end), type = fields.find(item => item.id === 0x83), codec = fields.find(item => item.id === 0x86);
    if (type && type.end - type.start === 1 && data[type.start] === 1) {
      check(codec && ['V_VP8', 'V_VP9', 'V_AV1'].includes(data.toString('ascii', codec.start, codec.end)));
      const view = fields.find(item => item.id === 0xe0); check(view);
      const settings = ebml(data, view.start, view.end), width = settings.find(item => item.id === 0xb0), height = settings.find(item => item.id === 0xba);
      check(width && height && width.end - width.start >= 1 && width.end - width.start <= 4 && height.end - height.start >= 1 && height.end - height.start <= 4);
      dimensions(data.readUIntBE(width.start, width.end - width.start), data.readUIntBE(height.start, height.end - height.start)); video = true;
    }
  }
  check(video);
}

// Core glTF 2.0 only: no remote buffers, data URIs, loader extensions or animation.
// See https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification
function glb(data: Buffer) {
  check(data.length >= 28 && data.toString('ascii', 0, 4) === 'glTF' && data.readUInt32LE(4) === 2 && data.readUInt32LE(8) === data.length);
  const jsonBytes = data.readUInt32LE(12), binHeader = 20 + jsonBytes;
  check(jsonBytes > 0 && jsonBytes <= 2 * 1024 ** 2 && jsonBytes % 4 === 0 && data.readUInt32LE(16) === 0x4e4f534a && binHeader + 8 <= data.length);
  const model = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(20, binHeader))));
  const binBytes = data.readUInt32LE(binHeader), binStart = binHeader + 8;
  check(data.readUInt32LE(binHeader + 4) === 0x004e4942 && binBytes % 4 === 0 && binStart + binBytes === data.length);
  check(object(model.asset).version === '2.0');
  const queue: Array<{ value: unknown; depth: number }> = [{ value: model, depth: 0 }]; let visited = 0;
  while (queue.length) {
    const { value, depth } = queue.pop()!; check(depth <= 40 && ++visited <= 200000);
    if (typeof value === 'number') check(Number.isFinite(value));
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      check(key !== 'uri' && key !== 'url');
      if (['extensions', 'extensionsRequired', 'extensionsUsed', 'animations', 'skins'].includes(key)) check(child && typeof child === 'object' && Object.keys(child).length === 0);
      queue.push({ value: child, depth: depth + 1 });
    }
  }
  const buffers = array(model.buffers); check(buffers.length === 1);
  const buffer = object(buffers[0]); check(uint(buffer.byteLength) && buffer.byteLength > 0 && buffer.byteLength <= binBytes && binBytes - buffer.byteLength <= 3);
  const views = array(model.bufferViews).map(object); check(views.length > 0 && views.length <= 10000);
  for (const view of views) check(view.buffer === 0 && uint(view.byteLength) && view.byteLength > 0 && uint(view.byteOffset ?? 0) && Number(view.byteOffset ?? 0) + view.byteLength <= buffer.byteLength && (view.byteStride === undefined || (uint(view.byteStride) && view.byteStride >= 4 && view.byteStride <= 252 && view.byteStride % 4 === 0)));
  const accessors = array(model.accessors).map(object); check(accessors.length <= 10000);
  const sizes: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const components: Record<string, number> = { '5120': 1, '5121': 1, '5122': 2, '5123': 2, '5125': 4, '5126': 4 };
  for (const accessor of accessors) {
    check(uint(accessor.bufferView) && views[accessor.bufferView] && !accessor.sparse && uint(accessor.count) && accessor.count > 0 && accessor.count <= 2_000_000 && uint(accessor.byteOffset ?? 0));
    const view = views[accessor.bufferView], size = sizes[String(accessor.type)] * components[String(accessor.componentType)], stride = Number(view.byteStride ?? size);
    check(size > 0 && stride >= size && Number(accessor.byteOffset ?? 0) + (accessor.count - 1) * stride + size <= Number(view.byteLength));
  }
  const meshes = array(model.meshes).map(object); check(meshes.length > 0 && meshes.length <= 1000);
  for (const mesh of meshes) for (const entry of array(mesh.primitives)) {
    const primitive = object(entry), attributes = object(primitive.attributes); check(uint(attributes.POSITION) && accessors[attributes.POSITION]?.type === 'VEC3');
    for (const index of Object.values(attributes)) check(uint(index) && accessors[index]);
    if (primitive.indices !== undefined) check(uint(primitive.indices) && accessors[primitive.indices]?.type === 'SCALAR');
  }
  const nodes = array(model.nodes).map(object); check(nodes.length > 0 && nodes.length <= 10000);
  const parents = new Map<number, number>();
  for (const [index, node] of nodes.entries()) {
    check(node.skin === undefined);
    if (node.mesh !== undefined) check(uint(node.mesh) && meshes[node.mesh]);
    for (const child of array(node.children ?? [])) { check(uint(child) && nodes[child] && !parents.has(child)); parents.set(child, index); }
  }
  for (let index = 0; index < nodes.length; index++) { let cursor: number | undefined = index, depth = 0; while (cursor !== undefined) { check(++depth <= 100); cursor = parents.get(cursor); } }
  const scenes = array(model.scenes).map(object); check(scenes.length > 0 && uint(model.scene ?? 0) && scenes[Number(model.scene ?? 0)]);
  for (const scene of scenes) for (const index of array(scene.nodes ?? [])) check(uint(index) && nodes[index] && !parents.has(index));
  let pixels = 0;
  const images = array(model.images ?? []); check(images.length <= 16);
  for (const entry of images) {
    const image = object(entry); check(uint(image.bufferView) && views[image.bufferView]);
    const view = views[image.bufferView], start = binStart + Number(view.byteOffset ?? 0), bytes = data.subarray(start, start + Number(view.byteLength));
    check(bytes.length <= MEDIA_LIMITS.image);
    pixels += image.mimeType === 'image/png' ? png(bytes) : image.mimeType === 'image/jpeg' ? jpeg(bytes) : (() => { throw invalid(); })();
    check(pixels <= 32_000_000);
  }
}

/** Container validation and bounded dimensions, not transcoding or a codec-quality assessment. */
export function validateMedia(data: Buffer, kind: MediaKind, contentType: string): { mime: Mime; extension: string } {
  const mime = contentType.trim().toLowerCase();
  check(Object.hasOwn(formats, mime) && formats[mime as Mime].kind === kind);
  if (data.length > MEDIA_LIMITS[kind]) throw new HttpError(413, 'MEDIA_TOO_LARGE', 'El archivo supera el límite permitido.');
  check(data.length > 0);
  try {
    ({ 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp, 'video/mp4': mp4, 'video/webm': webm, 'model/gltf-binary': glb })[mime as Mime](data);
  } catch (error) { if (error instanceof HttpError) throw error; throw invalid(); }
  return { mime: mime as Mime, extension: formats[mime as Mime].extension };
}

function filename(reference: Pick<StoredMedia, 'id' | 'relativePath'>) {
  check(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(reference.id));
  check(new RegExp(`^${reference.id}\\.(jpg|png|webp|mp4|webm|glb)$`).test(reference.relativePath));
  return reference.relativePath;
}
export function parseMediaRange(range: string | undefined, size: number): { start: number; end: number } | null {
  if (range === undefined) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return null;
  const first = Number(match[1]), last = Number(match[2]);
  if ((match[1] && !Number.isSafeInteger(first)) || (match[2] && !Number.isSafeInteger(last))) return null;
  const start = match[1] ? first : Math.max(0, size - last), end = match[1] && match[2] ? Math.min(last, size - 1) : size - 1;
  return start >= 0 && start < size && end >= start && (!match[1] ? last > 0 : true) ? { start, end } : null;
}

/** Call only after authorization; paths and tenant ownership come from the database, never a URL. */
export function createMediaStore(root: string) {
  if (!root.trim()) throw new Error('B2B_MEDIA_ROOT is required for uploads');
  const directory = resolve(root);
  return {
    async ingest({ body, contentType, kind }: { body: AsyncIterable<Uint8Array>; contentType: string; kind: MediaKind }): Promise<StoredMedia> {
      const mime = contentType.trim().toLowerCase(); check(Object.hasOwn(formats, mime) && formats[mime as Mime].kind === kind);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const id = randomUUID(), temporary = join(directory, `.upload-${id}.tmp`), handle = await open(temporary, 'wx', 0o600);
      let bytes = 0, published: string | undefined;
      const hash = createHash('sha256');
      try {
        // Leave HTTP streams available for draining and a useful 413 response after rejection.
        const chunks = body instanceof Readable ? body.iterator({ destroyOnReturn: false }) : body;
        for await (const chunk of chunks) {
          check(chunk instanceof Uint8Array); bytes += chunk.length;
          if (bytes > MEDIA_LIMITS[kind]) throw new HttpError(413, 'MEDIA_TOO_LARGE', 'El archivo supera el límite permitido.');
          hash.update(chunk); await handle.writeFile(chunk);
        }
        await handle.sync(); await handle.close();
        const validated = validateMedia(await readFile(temporary), kind, mime), relativePath = `${id}.${validated.extension}`;
        await chmod(temporary, 0o400);
        // Hard-link publication is atomic and refuses overwriting an existing immutable object.
        await link(temporary, join(directory, relativePath)); published = relativePath;
        await unlink(temporary);
        const folder = await open(directory, constants.O_RDONLY); try { await folder.sync(); } finally { await folder.close(); }
        return { id, relativePath, ...validated, bytes, sha256: hash.digest('hex') };
      } catch (error) {
        await handle.close().catch(() => undefined);
        await unlink(temporary).catch(() => undefined);
        if (published) await unlink(join(directory, published)).catch(() => undefined);
        throw error;
      }
    },
    async open(reference: MediaReference, range?: string): Promise<{ stream: Readable; status: number; headers: Record<string, string> }> {
      const name = filename(reference); check(Object.hasOwn(formats, reference.mime) && name.endsWith(`.${formats[reference.mime as Mime].extension}`) && uint(reference.bytes) && reference.bytes > 0);
      const file = await open(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => { throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Medio no disponible.'); });
      try {
        const stat = await file.stat(); check(stat.isFile() && stat.size === reference.bytes);
        const selected = parseMediaRange(range, stat.size);
        const headers: Record<string, string> = { 'content-type': reference.mime, 'x-content-type-options': 'nosniff', 'content-disposition': `inline; filename="${name}"`, 'accept-ranges': 'bytes', 'cache-control': 'private, no-store' };
        if (!selected) { await file.close(); return { status: 416, headers: { ...headers, 'content-range': `bytes */${stat.size}`, 'content-length': '0' }, stream: Readable.from([]) }; }
        headers['content-length'] = String(selected.end - selected.start + 1);
        if (range !== undefined) headers['content-range'] = `bytes ${selected.start}-${selected.end}/${stat.size}`;
        return { status: range === undefined ? 200 : 206, headers, stream: file.createReadStream({ start: selected.start, end: selected.end, autoClose: true }) };
      } catch (error) { await file.close(); throw error; }
    },
    async remove(reference: Pick<StoredMedia, 'id' | 'relativePath'>) {
      await unlink(join(directory, filename(reference))).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
    },
  };
}
