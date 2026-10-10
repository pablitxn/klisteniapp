import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { createMediaStore, MEDIA_LIMITS, parseMediaRange, validateMedia } from '../src/media.ts';
import { HttpError } from '../src/errors.ts';

function pngChunk(type: string, body: Buffer) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length);
  out.write(type, 4);
  body.copy(out, 8);
  let crc = 0xffffffff;
  for (const byte of out.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4);
  return out;
}
function png(width = 1, height = 1) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
// A 1x1 grayscale baseline JPEG: constant DCT block, one-symbol DC/AC Huffman tables.
function jpeg() {
  function segment(marker: number, bytes: number[]) {
    const header = Buffer.from([0xff, marker, 0, 0]);
    header.writeUInt16BE(bytes.length + 2, 2);
    return Buffer.concat([header, Buffer.from(bytes)]);
  }
  const table = [1, ...Array<number>(15).fill(0), 0];
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xdb, [0, ...Array<number>(64).fill(1)]),
    segment(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]),
    segment(0xc4, [0, ...table, 0x10, ...table]),
    segment(0xda, [1, 1, 0, 0, 63, 0]),
    Buffer.from([0x3f, 0xff, 0xd9]),
  ]);
}
function box(type: string, ...data: Buffer[]) {
  const bytes = Buffer.concat(data),
    out = Buffer.alloc(8);
  out.writeUInt32BE(8 + bytes.length);
  out.write(type, 4);
  return Buffer.concat([out, bytes]);
}
function mp4(external = false) {
  const handler = Buffer.alloc(24);
  handler.write('vide', 8);
  const reference = external
    ? Buffer.from('\0\0\0\0https://uncontrolled.example/video')
    : Buffer.from([0, 0, 0, 1]);
  return Buffer.concat([
    box('ftyp', Buffer.from('isom\0\0\0\0isommp42')),
    box(
      'moov',
      box(
        'trak',
        box(
          'mdia',
          box('hdlr', handler),
          box(
            'minf',
            box('dinf', box('dref', Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), box('url ', reference))),
          ),
        ),
      ),
    ),
    box('mdat', Buffer.from([0, 0, 1, 0])),
  ]);
}
function ebml(id: string, data: Buffer) {
  assert.ok(data.length < 127);
  return Buffer.concat([Buffer.from(id, 'hex'), Buffer.from([data.length | 0x80]), data]);
}
function webm(docType = 'webm') {
  return Buffer.concat([
    ebml('1a45dfa3', ebml('4282', Buffer.from(docType))),
    ebml(
      '18538067',
      Buffer.concat([
        ebml(
          '1654ae6b',
          ebml(
            'ae',
            Buffer.concat([
              ebml('83', Buffer.from([1])),
              ebml('86', Buffer.from('V_VP8')),
              ebml(
                'e0',
                Buffer.concat([ebml('b0', Buffer.from([2])), ebml('ba', Buffer.from([2]))]),
              ),
            ]),
          ),
        ),
        ebml('1f43b675', ebml('a3', Buffer.from([0x81, 0, 0, 0x80, 0]))),
      ]),
    ),
  ]);
}
function glb(change?: (model: Record<string, unknown>) => void) {
  const model: Record<string, unknown> = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  change?.(model);
  const json = Buffer.from(JSON.stringify(model)),
    padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const header = Buffer.alloc(20);
  header.write('glTF');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + 8 + 44, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binary = Buffer.alloc(52);
  binary.writeUInt32LE(44);
  binary.writeUInt32LE(0x004e4942, 4);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => binary.writeFloatLE(value, 8 + index * 4));
  [0, 1, 2].forEach((value, index) => binary.writeUInt16LE(value, 44 + index * 2));
  return Buffer.concat([header, padded, binary]);
}
const rejected = (error: unknown) => error instanceof HttpError && error.status === 415;

test('binary media profile rejects type spoofing, corrupt PNG, SVG, oversized dimensions and incomplete containers', () => {
  assert.deepEqual(validateMedia(png(), 'image', 'image/png'), {
    mime: 'image/png',
    extension: 'png',
  });
  assert.equal(validateMedia(jpeg(), 'image', 'image/jpeg').extension, 'jpg');
  const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  assert.equal(validateMedia(webp, 'image', 'image/webp').extension, 'webp');
  assert.throws(() => validateMedia(png(), 'image', 'image/jpeg'), rejected);
  assert.throws(
    () => validateMedia(Buffer.from('<svg onload="alert(1)"/>'), 'image', 'image/png'),
    rejected,
  );
  assert.throws(() => validateMedia(png(), 'image', 'image/svg+xml'), rejected);
  assert.throws(() => validateMedia(png(9000, 1), 'image', 'image/png'), rejected);
  assert.throws(
    () => validateMedia(Buffer.concat([png(), Buffer.from('<html>')]), 'image', 'image/png'),
    rejected,
  );
  const broken = png();
  broken[broken.length - 1] ^= 1;
  assert.throws(() => validateMedia(broken, 'image', 'image/png'), rejected);
  for (const payload of [
    Buffer.from('not a zlib stream'),
    deflateSync(Buffer.from([5, 255, 0, 0, 255])),
    deflateSync(Buffer.alloc(1000)),
  ]) {
    const malformed = Buffer.concat([
      png().subarray(0, 33),
      pngChunk('IDAT', payload),
      pngChunk('IEND', Buffer.alloc(0)),
    ]);
    assert.throws(() => validateMedia(malformed, 'image', 'image/png'), rejected);
  }
  assert.throws(
    () => validateMedia(Buffer.from('RIFF\0\0\0\0WEBP'), 'image', 'image/webp'),
    rejected,
  );
  assert.throws(
    () => validateMedia(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), 'image', 'image/jpeg'),
    rejected,
  );
  assert.throws(
    () => validateMedia(Buffer.alloc(MEDIA_LIMITS.image + 1), 'image', 'image/png'),
    (error) => error instanceof HttpError && error.status === 413,
  );
});

test('MP4 and WebM require video container structure and reject external MP4 data references', () => {
  assert.equal(validateMedia(mp4(), 'video', 'video/mp4').extension, 'mp4');
  assert.equal(validateMedia(webm(), 'video', 'video/webm').extension, 'webm');
  assert.throws(() => validateMedia(mp4(true), 'video', 'video/mp4'), rejected);
  assert.throws(() => validateMedia(webm('matroska'), 'video', 'video/webm'), rejected);
  assert.throws(() => validateMedia(mp4().subarray(0, -1), 'video', 'video/mp4'), rejected);
  assert.throws(() => validateMedia(webm().subarray(0, -1), 'video', 'video/webm'), rejected);
  assert.throws(() => validateMedia(mp4(), 'image', 'video/mp4'), rejected);
});

test('static GLB accepts an embedded triangle and rejects external/data resources, extensions, animation and cyclic nodes', () => {
  assert.equal(validateMedia(glb(), 'model3d', 'model/gltf-binary').extension, 'glb');
  for (const uri of [
    'https://uncontrolled.example/texture.png',
    '//uncontrolled.example/image',
    'data:image/png;base64,AAAA',
    '../private.bin',
  ]) {
    assert.throws(
      () =>
        validateMedia(
          glb((model) => {
            model.images = [{ uri }];
          }),
          'model3d',
          'model/gltf-binary',
        ),
      rejected,
    );
  }
  for (const change of [
    (model: Record<string, unknown>) => {
      model.animations = [{ channels: [] }];
    },
    (model: Record<string, unknown>) => {
      model.extensionsUsed = ['KHR_draco_mesh_compression'];
    },
    (model: Record<string, unknown>) => {
      model.nodes = [{ mesh: 0, children: [0] }];
    },
    (model: Record<string, unknown>) => {
      model.accessors = [{ bufferView: 0, componentType: 5126, count: 2_000_001, type: 'VEC3' }];
    },
  ])
    assert.throws(() => validateMedia(glb(change), 'model3d', 'model/gltf-binary'), rejected);
  assert.throws(
    () => validateMedia(glb().subarray(0, -4), 'model3d', 'model/gltf-binary'),
    rejected,
  );
});

test('uploaded object is immutable, persists across store instances and supports bounded byte ranges', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klisteni-media-test-'));
  try {
    const bytes = png(),
      store = createMediaStore(directory),
      result = await store.ingest({
        body: Readable.from([bytes.subarray(0, 15), bytes.subarray(15)]),
        contentType: 'image/png',
        kind: 'image',
      });
    assert.equal(result.bytes, bytes.length);
    assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(result.relativePath, `${result.id}.png`);
    assert.deepEqual(await readdir(directory), [result.relativePath]);
    const reopened = createMediaStore(directory),
      full = await reopened.open(result);
    assert.equal(full.status, 200);
    assert.equal(full.headers['content-type'], 'image/png');
    assert.equal(full.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(
      Buffer.from(await full.stream.toArray().then((parts) => Buffer.concat(parts))),
      bytes,
    );
    for (const range of ['bytes=1-4', 'bytes=1-', 'bytes=-8', `bytes=0-${bytes.length + 100}`]) {
      const selection = parseMediaRange(range, bytes.length)!,
        opened = await reopened.open(result, range);
      assert.equal(opened.status, 206);
      assert.equal(
        opened.headers['content-range'],
        `bytes ${selection.start}-${selection.end}/${bytes.length}`,
      );
      assert.deepEqual(
        Buffer.concat(await opened.stream.toArray()),
        bytes.subarray(selection.start, selection.end + 1),
      );
    }
    for (const range of [
      'bytes=999999-',
      'bytes=9-3',
      'bytes=-0',
      'bytes=0-1,3-4',
      'items=0-1',
      'bytes=9999999999999999999999-',
      'bytes=-',
    ]) {
      const opened = await reopened.open(result, range);
      assert.equal(opened.status, 416);
      assert.equal(opened.headers['content-range'], `bytes */${bytes.length}`);
    }
    const second = await store.ingest({
      body: Readable.from([bytes]),
      kind: 'image',
      contentType: 'image/png',
    });
    assert.notEqual(result.id, second.id);
    assert.deepEqual(await readFile(join(directory, result.relativePath)), bytes);
    await assert.rejects(reopened.open({ ...result, relativePath: '../outside.png' }), rejected);
    await assert.rejects(reopened.remove({ ...result, relativePath: '../outside.png' }), rejected);
    await reopened.remove(result);
    await assert.rejects(
      reopened.open(result),
      (error) => error instanceof HttpError && error.status === 404,
    );
    await reopened.remove(result);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('failed, interrupted and oversized uploads leave no object or temporary file; symlinks cannot be served', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'klisteni-media-test-'));
  try {
    const store = createMediaStore(directory);
    await assert.rejects(
      store.ingest({
        body: Readable.from([Buffer.from('<html>')]),
        kind: 'image',
        contentType: 'image/png',
      }),
      rejected,
    );
    async function* interrupted() {
      yield png().subarray(0, 10);
      throw new Error('connection interrupted');
    }
    await assert.rejects(
      store.ingest({ body: interrupted(), kind: 'image', contentType: 'image/png' }),
      /interrupted/,
    );
    await assert.rejects(
      store.ingest({
        body: Readable.from([Buffer.alloc(MEDIA_LIMITS.image), Buffer.from([1])]),
        kind: 'image',
        contentType: 'image/png',
      }),
      (error) => error instanceof HttpError && error.status === 413,
    );
    assert.deepEqual(await readdir(directory), []);
    const id = '00000000-0000-4000-8000-000000000001',
      outside = join(directory, 'outside');
    await writeFile(outside, png());
    await symlink(outside, join(directory, `${id}.png`));
    await assert.rejects(
      store.open({ id, relativePath: `${id}.png`, mime: 'image/png', bytes: png().length }),
      (error) => error instanceof HttpError && error.status === 404,
    );
    await store.remove({ id, relativePath: `${id}.png` });
    assert.deepEqual(await readFile(outside), png());
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
