import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const modelDir = resolve(root, 'apps/web/public/models');
const bytes = await readFile(resolve(modelDir, 'anatomy.glb'));
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
const manifest = JSON.parse(await readFile(resolve(modelDir, 'anatomy-manifest.json'), 'utf8'));
const landmarks = JSON.parse(await readFile(resolve(modelDir, 'rig-landmarks.json'), 'utf8'));
const report = JSON.parse(await readFile(resolve(root, 'assets/blender/optimization-report.json'), 'utf8'));
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
const tissues = new Map();
const names = new Set();
let triangles = 0;
let checkedOutwardNormals = 0;
const binOffset = 28 + bytes.readUInt32LE(12);
for (const node of gltf.nodes) {
  if (node.mesh === undefined) continue;
  const meta = node.extras;
  assert.ok(meta?.anatomyName, 'Every mesh retains its exact anatomical source name');
  if (meta.tissue === 'skin' && /^Pectoral region\.[lr]$/.test(meta.anatomyName)) assert.equal(meta.bodySegment, 'torso', 'Pectoral body surface is torso, never the oral/head substring');
  assert.ok(['muscle', 'bone', 'skin'].includes(meta.tissue));
  assert.ok(!/^(Incus|Malleus|Stapes)(\.|$)/.test(meta.anatomyName), 'Auditory ossicles excluded');
  assert.ok(!names.has(meta.anatomyName), `Duplicate source name ${meta.anatomyName}`);
  names.add(meta.anatomyName);
  tissues.set(meta.tissue, (tissues.get(meta.tissue) ?? 0) + 1);
  assert.ok(!node.translation && !node.scale && !node.rotation && !node.matrix, 'All transforms are baked once');
  for (const primitive of gltf.meshes[node.mesh].primitives) {
    const position = gltf.accessors[primitive.attributes.POSITION];
    assert.ok(primitive.attributes.NORMAL !== undefined);
    assert.ok(primitive.attributes.COLOR_0 !== undefined, 'Natural tissue/tendon colors exported');
    assert.equal(primitive.attributes.COLOR_1, undefined, 'No legacy source color layer can override tissue colors');
    if (meta.tissue === 'skin') {
      const colors = gltf.accessors[primitive.attributes.COLOR_0];
      const view = gltf.bufferViews[colors.bufferView];
      assert.equal(colors.componentType, 5126);
      const red = bytes.readFloatLE(binOffset + (view.byteOffset ?? 0) + (colors.byteOffset ?? 0));
      assert.ok(red > 0.4 && red < 0.85, `Body surface has a skin tone including fingers: ${meta.anatomyName}`);
    }
    assert.ok(position.min.every(Number.isFinite) && position.max.every(Number.isFinite));
    if (/^Epigastric region\.[lr]$/.test(meta.anatomyName)) {
      const normal = gltf.accessors[primitive.attributes.NORMAL];
      assert.equal(normal.componentType, 5126);
      const view = gltf.bufferViews[normal.bufferView];
      let anterior = 0;
      for (let vertex = 0; vertex < normal.count; vertex++) anterior += bytes.readFloatLE(binOffset + (view.byteOffset ?? 0) + (normal.byteOffset ?? 0) + vertex * (view.byteStride ?? 12) + 8);
      assert.ok(anterior / normal.count > 0.7, `Anterior surface normals must point outward: ${meta.anatomyName}`);
      checkedOutwardNormals++;
    }
    const centerX = (position.min[0] + position.max[0]) / 2;
    if (meta.side === 'left') assert.ok(centerX > -0.006, `Anatomical left stays +X: ${meta.anatomyName}`);
    if (meta.side === 'right') assert.ok(centerX < 0.006, `Anatomical right stays -X: ${meta.anatomyName}`);
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], position.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], position.max[axis]);
    }
    triangles += (primitive.indices === undefined ? position.count : gltf.accessors[primitive.indices].count) / 3;
  }
}
assert.equal(checkedOutwardNormals, 2, 'Both mirrored anterior body surfaces checked');
assert.ok(Math.abs(bounds.min[1]) < 1e-5, 'Soles rest at Y=0');
assert.ok(Math.abs(bounds.max[1] - 1.8) < 1e-5, 'Registered assembly retains normalized 1.8m height');
assert.ok(Math.abs(bounds.min[0]) < 0.37 && Math.abs(bounds.max[0]) < 0.37, 'No displaced/mirrored transforms');
assert.equal(names.size, manifest.geometry.meshCount);
assert.equal(triangles, manifest.geometry.optimizedTriangles);
assert.deepEqual(Object.fromEntries(tissues), manifest.geometry.byTissue);
assert.equal(bytes.length, manifest.geometry.glbBytes);
assert.ok(manifest.optimization.sampledMaxDistanceM <= 0.0017);
assert.ok(manifest.optimization.sampledP95MaxAcrossMeshesM <= 0.0007);
assert.ok(bytes.length < 20 * 1024 * 1024, 'Bounded mobile download size');
assert.equal((gltf.images ?? []).length, 0, 'No untracked external textures');
for (const mesh of report.meshes.filter(mesh => mesh.tissue === 'skin')) {
  assert.equal(mesh.sourceTriangles, mesh.optimizedTriangles, `Body surface unchanged: ${mesh.name}`);
  assert.equal(mesh.decimationRatio, 1);
  assert.ok(mesh.sampledMaxDistanceM < 1e-5);
}
assert.ok(landmarks.left.shoulder[0] > 0 && landmarks.right.shoulder[0] < 0);
assert.ok(landmarks.left.hip[0] > 0 && landmarks.right.hip[0] < 0);
assert.ok(landmarks.neck[1] > landmarks.pelvis[1]);
for (const source of manifest.sources) {
  assert.ok(source.url.includes(manifest.sourceCommit), 'Source download URL pinned to commit');
  try {
    const raw = await readFile(resolve(root, '.cache/anatomy', source.name));
    assert.equal(createHash('sha256').update(raw).digest('hex'), source.sha256, `Source checksum ${source.name}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
console.log(JSON.stringify({ status: 'passed', namedMeshes: names.size, triangles, bounds, tissues: Object.fromEntries(tissues), maxSampledOptimizationErrorMm: manifest.optimization.sampledMaxDistanceM * 1000, maximumPerMeshP95Mm: manifest.optimization.sampledP95MaxAcrossMeshesM * 1000 }, null, 2));
