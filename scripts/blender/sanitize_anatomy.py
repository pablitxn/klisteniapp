"""Sanitize only file-selector metadata and prove authored anatomy is preserved.

Run with Blender --background --factory-startup --disable-autoexec
--python-exit-code 1 --python scripts/blender/sanitize_anatomy.py --
--input anatomy.blend --output /private/clean.blend --report /private/report.json

Alternatively use --compare other.blend (no save). Output must be a new file.
The verifier covers this static mesh atlas, and fails closed on animation,
rigging, modifiers, constraints, linked data, or unsupported content. It does
not switch scenes, frames, view layers, or regenerate/export the model.
The separate publication audit must still check decoded SDNA buffer capacity.
Fingerprints cover authored mesh arrays/attributes, weights, object transforms,
material graphs, provenance/custom properties and selected scene/view settings.
They do not claim exhaustive coverage of every nested render/tool/UI setting.
"""

import argparse
from array import array
import hashlib
import json
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from public_metadata import clear_file_browser_state
from audit_file_browser_buffers import check_file_browser_buffers


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                                     ensure_ascii=True, allow_nan=False).encode()).hexdigest()


def plain(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, bytes):
        return {'bytes': value.hex()}
    if isinstance(value, bpy.types.ID):
        return {'id': value.bl_rna.identifier, 'name': value.name_full}
    if hasattr(value, 'to_dict'):
        return plain(value.to_dict())
    if isinstance(value, dict):
        return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, set):
        return sorted(plain(v) for v in value)
    if hasattr(value, '__iter__') or (hasattr(value, '__len__') and hasattr(value, '__getitem__')):
        return [plain(v) for v in value]
    raise RuntimeError('Unsupported fingerprint value type: ' + type(value).__name__)


def settings(value, skip=()):
    """All writable primitive RNA values, plus referenced datablock identity."""
    result = {}
    for prop in value.bl_rna.properties:
        name = prop.identifier
        if name in {'rna_type', 'tag', 'is_runtime_data'} or name in skip:
            continue
        if prop.type == 'POINTER':
            item = getattr(value, name)
            if isinstance(item, bpy.types.ID):
                result[name] = plain(item)
        elif not prop.is_readonly and prop.type in {'BOOLEAN', 'INT', 'FLOAT', 'STRING', 'ENUM'}:
            result[name] = plain(getattr(value, name))
    return result


def custom(value):
    try:
        return plain(dict(value.items())) if hasattr(value, 'items') else {}
    except TypeError:
        # Some RNA structs expose items() but cannot carry IDProperties.
        return {}


def nested_settings(value, depth=0):
    """Small nested authored settings (palettes/Freestyle), never geometry."""
    if value is None:
        return None
    if depth > 12:
        raise RuntimeError('Unsupported recursive settings')
    result = {'settings': settings(value), 'custom': custom(value)}
    for prop in value.bl_rna.properties:
        if prop.identifier in {'rna_type', 'id_data'}:
            continue
        item = getattr(value, prop.identifier)
        if prop.type == 'POINTER' and item is not None and not isinstance(item, bpy.types.ID):
            result[prop.identifier] = nested_settings(item, depth + 1)
        elif prop.type == 'COLLECTION':
            result[prop.identifier] = [plain(v) if isinstance(v, bpy.types.ID) else
                                       nested_settings(v, depth + 1) for v in item]
    return result


def table(values, names=None):
    """Exact full-array hashes: no geometry sampling or rounded coordinates."""
    if not len(values):
        return {'count': 0}
    result = {'count': len(values)}
    for prop in values[0].bl_rna.properties:
        name = prop.identifier
        if name == 'rna_type' or (names is not None and name not in names):
            continue
        if prop.type not in {'BOOLEAN', 'INT', 'FLOAT', 'STRING', 'ENUM'}:
            continue
        width = getattr(prop, 'array_length', 0) or 1
        if prop.type in {'BOOLEAN', 'INT', 'FLOAT'} and (
                not getattr(prop, 'is_array', False) or prop.array_length):
            code = {'BOOLEAN': 'b', 'INT': 'i', 'FLOAT': 'f'}[prop.type]
            data = array(code, [0]) * (len(values) * width)
            try:
                values.foreach_get(name, data)
            except (TypeError, ValueError, RuntimeError):
                result[name] = digest([plain(getattr(v, name)) for v in values])
            else:
                if sys.byteorder != 'little':
                    data.byteswap()
                result[name] = {'type': code, 'width': width,
                                'sha256': hashlib.sha256(data.tobytes()).hexdigest()}
        else:
            result[name] = digest([plain(getattr(v, name)) for v in values])
    return result


def node_tree(tree):
    if tree is None:
        return None
    allowed = {'ShaderNodeBsdfPrincipled', 'ShaderNodeOutputMaterial',
               'ShaderNodeVertexColor', 'ShaderNodeBackground', 'ShaderNodeOutputWorld'}
    nodes = []
    for node in tree.nodes:
        if node.bl_idname not in allowed:
            raise RuntimeError('Unsupported shader node; extend preservation verifier first')
        nodes.append({'type': node.bl_idname, 'settings': settings(node), 'custom': custom(node),
                      'parent': node.parent.name if node.parent else None,
                      'inputs': [(s.identifier, settings(s), custom(s)) for s in node.inputs],
                      'outputs': [(s.identifier, settings(s), custom(s)) for s in node.outputs]})
    return {'settings': settings(tree), 'custom': custom(tree),
            'nodes': sorted(nodes, key=lambda n: n['settings']['name']),
            'links': sorted((l.from_node.name, l.from_socket.identifier,
                             l.to_node.name, l.to_socket.identifier, l.is_muted) for l in tree.links)}


def layer_collection(layer):
    return {'settings': settings(layer), 'collection': plain(layer.collection),
            'children': [layer_collection(c) for c in layer.children]}


def inventory():
    # These are absent in the distributed atlas. Reject them instead of silently
    # claiming preservation of unexamined rigs, simulation, or animation data.
    unsupported = ('armatures', 'actions', 'curves', 'cameras', 'lights', 'lattices',
                   'metaballs', 'particles', 'hair_curves', 'pointclouds', 'volumes',
                   'grease_pencils', 'shape_keys', 'libraries', 'node_groups', 'sounds',
                   'movieclips', 'masks', 'textures', 'paint_curves', 'fonts', 'brushes',
                   'speakers', 'annotations', 'cache_files', 'lightprobes')
    if any(len(getattr(bpy.data, name, ())) for name in unsupported):
        raise RuntimeError('Unsupported atlas datablocks; extend preservation verifier first')
    for prop in bpy.data.bl_rna.properties:
        if prop.type == 'COLLECTION':
            for item in getattr(bpy.data, prop.identifier):
                if getattr(item, 'animation_data', None) or getattr(item, 'asset_data', None):
                    raise RuntimeError('Unsupported animation or asset metadata')
    if any(o.type != 'MESH' or o.modifiers or o.constraints or o.pose for o in bpy.data.objects):
        raise RuntimeError('Unsupported object rigging, modifiers, or constraints')
    if any(m.shape_keys or len(m.skin_vertices) for m in bpy.data.meshes):
        raise RuntimeError('Unsupported shape keys or skin data')
    if any(getattr(s, 'node_tree', None) or getattr(s, 'compositing_node_group', None)
           or (s.sequence_editor and len(s.sequence_editor.strips)) for s in bpy.data.scenes):
        raise RuntimeError('Unsupported scene compositor or sequence strips')

    meshes = []
    for mesh in bpy.data.meshes:
        meshes.append({'settings': settings(mesh), 'custom': custom(mesh),
                       'materials': [plain(m) for m in mesh.materials],
                       'vertices': table(mesh.vertices, {'co', 'normal', 'select', 'hide'}),
                       'edges': table(mesh.edges),
                       'loops': table(mesh.loops, {'vertex_index', 'edge_index'}),
                       'polygons': table(mesh.polygons),
                       'vertexNormals': table(mesh.vertex_normals),
                       'polygonNormals': table(mesh.polygon_normals),
                       'cornerNormals': table(mesh.corner_normals),
                       'normalsDomain': mesh.normals_domain, 'hasCustomNormals': mesh.has_custom_normals,
                       'attributes': [(a.name, a.domain, a.data_type, table(a.data)) for a in mesh.attributes],
                       'attributeSettings': settings(mesh.attributes),
                       'colorSettings': settings(mesh.color_attributes),
                       'uvLayers': [settings(u) for u in mesh.uv_layers]})
    objects = []
    for obj in bpy.data.objects:
        objects.append({'settings': settings(obj), 'custom': custom(obj),
                        'type': obj.type, 'data': plain(obj.data),
                        'matrixWorld': plain(obj.matrix_world), 'matrixLocal': plain(obj.matrix_local),
                        'matrixBasis': plain(obj.matrix_basis), 'matrixParentInverse': plain(obj.matrix_parent_inverse),
                        'parent': plain(obj.parent),
                        'materials': [settings(slot) for slot in obj.material_slots],
                        'groups': [settings(g) for g in obj.vertex_groups],
                        'weights': [[(g.group, g.weight) for g in v.groups] for v in obj.data.vertices],
                        'collections': sorted(c.name for c in obj.users_collection),
                        'display': settings(obj.display),
                        'visibility': [(s.name, v.name, obj.hide_get(view_layer=v),
                                        obj.select_get(view_layer=v)) for s in bpy.data.scenes
                                       for v in s.view_layers if obj.name in v.objects]})
    materials = [{'settings': settings(m), 'custom': custom(m), 'nodes': node_tree(m.node_tree),
                  'surface': settings(m.grease_pencil) if m.grease_pencil else None} for m in bpy.data.materials]
    worlds = [{'settings': settings(w), 'custom': custom(w), 'nodes': node_tree(w.node_tree),
               'lighting': settings(w.light_settings)} for w in bpy.data.worlds]
    palettes = [nested_settings(p) for p in bpy.data.palettes]
    linestyles = [{'settings': nested_settings(s), 'nodes': node_tree(s.node_tree)}
                  for s in bpy.data.linestyles]
    scenes = []
    for scene in bpy.data.scenes:
        scenes.append({'settings': settings(scene), 'custom': custom(scene),
                       'collection': layer_collection(scene.view_layers[0].layer_collection),
                       'units': settings(scene.unit_settings), 'render': settings(scene.render),
                       'imageSettings': settings(scene.render.image_settings),
                       'viewSettings': settings(scene.view_settings),
                       'displaySettings': settings(scene.display_settings),
                       'toolSettings': settings(scene.tool_settings),
                       'sequencer': nested_settings(scene.sequence_editor) if scene.sequence_editor else None,
                       'markers': [(m.name, m.frame, plain(m.camera)) for m in scene.timeline_markers],
                       'layers': [{'settings': settings(v), 'collection': layer_collection(v.layer_collection),
                                   'active': plain(v.objects.active), 'custom': custom(v)} for v in scene.view_layers]})
    collections = [{'settings': settings(c), 'custom': custom(c),
                    'objects': sorted(o.name for o in c.objects),
                    'children': sorted(x.name for x in c.children)} for c in bpy.data.collections]
    sources = {'texts': [(t.name, settings(t), t.as_string(), custom(t)) for t in bpy.data.texts], 'images': []}
    for img in bpy.data.images:
        if img.source != 'VIEWER' or img.filepath or img.packed_file:
            raise RuntimeError('Unsupported external/packed image; extend preservation verifier first')
        # Viewer pixels are transient render caches, not authored atlas content.
        sources['images'].append({'settings': settings(img), 'custom': custom(img),
                                  'source': img.source, 'type': img.type,
                                  'colorspace': settings(img.colorspace_settings)})
    viewports = []
    for screen in bpy.data.screens:
        for area in screen.areas:
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    viewports.append({'screen': screen.name, 'settings': settings(space),
                                      'region': settings(space.region_3d) if space.region_3d else None,
                                      'shading': settings(space.shading), 'overlay': settings(space.overlay)})
    window = bpy.context.window
    context = {'scene': bpy.context.scene.name if bpy.context.scene else None,
               'viewLayer': bpy.context.view_layer.name if bpy.context.view_layer else None,
               'workspace': window.workspace.name if window else None,
               'screen': window.screen.name if window else None,
               'viewports': viewports}
    values = {'meshes': meshes, 'objects': objects, 'materials': materials, 'worlds': worlds,
              'scenes': scenes, 'collections': collections, 'sources': sources, 'context': context,
              'palettes': palettes, 'linestyles': linestyles,
              'unsupportedCounts': {name: len(getattr(bpy.data, name, ())) for name in unsupported}}
    # Only hashes/counts leave this process; no labels, custom metadata or paths.
    return {'fingerprints': {name: digest(value) for name, value in values.items()},
            'counts': {'objects': len(objects), 'meshes': len(meshes), 'materials': len(materials),
                       'vertices': sum(len(m.vertices) for m in bpy.data.meshes),
                       'polygons': sum(len(m.polygons) for m in bpy.data.meshes),
                       'armatures': len(bpy.data.armatures), 'actions': len(bpy.data.actions)},
            'frame': {'current': bpy.context.scene.frame_current,
                      'subframe': bpy.context.scene.frame_subframe}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--output', type=Path)
    action.add_argument('--compare', type=Path)
    parser.add_argument('--report', required=True, type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if args.output and (args.output.exists() or args.output.resolve() == args.input.resolve()):
        raise RuntimeError('Output must be a new file distinct from the input')
    if args.report.exists() or args.report.resolve() in {
            args.input.resolve(), (args.output or args.compare).resolve()}:
        raise RuntimeError('Report must be a new file distinct from both assets')
    input_hash = hashlib.sha256(args.input.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(args.input.resolve()), load_ui=True, use_scripts=False)
    before = inventory()
    cleared = 0
    if args.output:
        cleared = clear_file_browser_state()
        if inventory() != before:
            raise RuntimeError('Unexpected model/context change before saving')
        bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), check_existing=False,
                                   compress=True, relative_remap=False, copy=True)
    output = args.output or args.compare
    bpy.ops.wm.open_mainfile(filepath=str(output.resolve()), load_ui=True, use_scripts=False)
    after = inventory()
    report = {'schemaVersion': 1, 'blenderVersion': bpy.app.version_string,
              'inputSha256': input_hash, 'outputSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
              'inputUnchanged': hashlib.sha256(args.input.read_bytes()).hexdigest() == input_hash,
              'clearedStrings': cleared, 'before': before, 'after': after,
              'preserved': before == after,
              'changedCategories': [k for k in before['fingerprints']
                                    if before['fingerprints'][k] != after['fingerprints'][k]]}
    if args.output:
        report['fileBrowserBuffers'] = check_file_browser_buffers(output)
    with args.report.open('x') as handle:
        handle.write(json.dumps(report, indent=2) + '\n')
    if not report['preserved'] or not report['inputUnchanged'] or (
            args.output and not report['fileBrowserBuffers']['passed']):
        raise RuntimeError('Preservation verification failed; do not publish the output')
    print('ANATOMY_PRESERVATION_OK')


if __name__ == '__main__':
    main()
