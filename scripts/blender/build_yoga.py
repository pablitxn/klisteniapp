"""Build an editable Yoga workshop from the exact live renderer's GLB exports.

Run after `node scripts/export-yoga-blender.mjs`:
  blender --background --factory-startup --python scripts/blender/build_yoga.py
The original anatomy.blend and anatomy.glb are never changed.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import sys
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from public_metadata import clear_file_browser_state

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'artifacts/yoga-quality/blender'
OUTPUT = ROOT / 'assets/blender/yoga-quality.blend'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_export():
    manifest = json.loads((SOURCE / 'manifest.json').read_text())
    sources = manifest['sources']
    source_hash = hashlib.sha256(json.dumps(sources, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    if source_hash != manifest['sourceHash']:
        raise ValueError('Invalid Yoga export source manifest; re-export the GLBs.')
    for path, expected in sources.items():
        if digest(ROOT / path) != expected:
            raise ValueError(f'Yoga source changed after export: {path}; re-export before rebuilding.')
    fps, duration = manifest['fps'], manifest['durationSeconds']
    if not isinstance(fps, int) or fps <= 0 or not math.isfinite(duration) or duration <= 0:
        raise ValueError('Invalid Yoga export timing.')
    if abs(round(fps * duration) - fps * duration) > 1e-6:
        raise ValueError('Yoga duration must cover an integer number of frames.')
    variants = [model['variant'] for model in manifest['models']]
    if sorted(variants) != ['female', 'male']:
        raise ValueError('Yoga export must contain each visual model exactly once.')
    for model in manifest['models']:
        if Path(model['file']).name != model['file'] or digest(SOURCE / model['file']) != model['sha256']:
            raise ValueError(f"Missing or changed Yoga GLB: {model['file']}")
        if len(set(model['actions'])) != len(model['actions']) or set(model['actions']) != set(model['poses']):
            raise ValueError(f"Duplicate or missing pose metadata: {model['variant']}")
    # Never silently append a second workshop or overwrite similarly named
    # actions when this script is run in an already populated Blender file.
    for variant in variants:
        if bpy.data.scenes.get(f'Yoga | {variant.title()}') or any(action.name.startswith(f'{variant} | ') for action in bpy.data.actions):
            raise ValueError('Yoga workshop already exists in this file. Save it, then rebuild in a clean file.')
    return manifest


MANIFEST = validate_export()
ATLAS = json.loads((ROOT / 'apps/web/public/models/anatomy-manifest.json').read_text())
ATLAS_LICENSE = (ROOT / 'apps/web/public/models/LICENSE-anatomy.txt').read_text()


def enum_value(owner, name, preferred):
    values = {item.identifier for item in owner.bl_rna.properties[name].enum_items}
    if preferred not in values:
        raise ValueError(f'{name}: {preferred} unavailable; choose from {values}')
    return preferred


def material(name, color, roughness=0.8):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    mat.diffuse_color = (*color, 1)
    return mat


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def normalize_action_frames(action, frames):
    """The importer offsets NLA strips, but active Actions retain zero-based keys."""
    start, end = action.frame_range
    if abs(start) < 0.01 and abs(end - frames) < 0.01:
        curves = [curve for layer in action.layers for strip in layer.strips
                  for channelbag in strip.channelbags for curve in channelbag.fcurves]
        if not curves:
            raise ValueError(f'{action.name}: imported action has no editable animation curves.')
        for curve in curves:
            for key in curve.keyframe_points:
                key.co.x += 1
                key.handle_left.x += 1
                key.handle_right.x += 1
            curve.update()
    start, end = action.frame_range
    if abs(start - 1) > 0.01 or abs(end - (frames + 1)) > 0.01:
        raise ValueError(f'{action.name}: imported timing differs from the manifest.')


def compact_constant_keys(action):
    """Remove only redundant keys inside exact, linearly interpolated plateaus.

    Keep both ends of each plateau and every changing sample. This preserves
    the imported motion at every time while making the editable workshop small
    enough for the bounded publication metadata audit.
    """
    removed = 0
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for curve in channelbag.fcurves:
                    keys = curve.keyframe_points
                    redundant = [index for index in range(1, len(keys) - 1)
                                 if keys[index - 1].interpolation == 'LINEAR'
                                 and keys[index].interpolation == 'LINEAR'
                                 and keys[index - 1].co.y == keys[index].co.y == keys[index + 1].co.y]
                    for index in reversed(redundant):
                        keys.remove(keys[index], fast=True)
                    if redundant:
                        curve.update()
                    # LINEAR interpolation never uses Bezier handles. Keep
                    # these unused coordinates at their keys rather than
                    # publishing extrapolated importer-generated values.
                    for key in keys:
                        if key.interpolation == 'LINEAR':
                            key.handle_left_type = enum_value(key, 'handle_left_type', 'FREE')
                            key.handle_right_type = enum_value(key, 'handle_right_type', 'FREE')
                            key.handle_left = key.co
                            key.handle_right = key.co
                    removed += len(redundant)
    return removed


def fit_workshop_camera(scene, camera, armature, actions, anatomy, frames, props):
    """Keep one stable camera that contains every exported action and its props."""
    rotation = camera.rotation_euler.to_quaternion()
    inverse = rotation.inverted()
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))

    def include(point):
        point = inverse @ point
        for axis in range(3):
            minimum[axis] = min(minimum[axis], point[axis])
            maximum[axis] = max(maximum[axis], point[axis])

    previous_action = armature.animation_data.action
    previous_frame = scene.frame_current
    hidden = [(obj, obj.hide_get()) for obj in anatomy]
    try:
        for obj, _ in hidden:
            obj.hide_set(False)
        for action in actions.values():
            armature.animation_data.action = action
            armature.animation_data.action_slot = action.slots[0]
            for sample in range(33):
                frame = 1 + frames * sample / 32
                scene.frame_set(math.floor(frame), subframe=frame % 1)
                depsgraph = bpy.context.evaluated_depsgraph_get()
                depsgraph.update()
                for obj in anatomy:
                    evaluated = obj.evaluated_get(depsgraph)
                    for corner in evaluated.bound_box:
                        include(evaluated.matrix_world @ Vector(corner))
        # Props are excluded collections, so use their authored box corners.
        for pose in props.values():
            for prop in pose['props']:
                x, y, z = prop['position']
                w, h, d = prop['size']
                for sx in (-1, 1):
                    for sy in (-1, 1):
                        for sz in (-1, 1):
                            include(Vector((x + sx * w / 2, -(z + sz * d / 2), y + sy * h / 2)))
        # Include either orientation of the mat used by lateral standing poses.
        for half_width, half_depth in ((0.525, 1.175), (1.175, 0.525)):
            for sx in (-1, 1):
                for sy in (-1, 1):
                    include(Vector((sx * half_width, sy * half_depth, 0)))
    finally:
        armature.animation_data.action = previous_action
        armature.animation_data.action_slot = previous_action.slots[0]
        scene.frame_set(previous_frame)
        for obj, was_hidden in hidden:
            obj.hide_set(was_hidden)
    if not all(math.isfinite(value) for value in (*minimum, *maximum)):
        raise ValueError('Cannot frame empty or non-finite Yoga geometry.')
    center = (minimum + maximum) / 2
    camera.location = rotation @ (center + Vector((0, 0, 5)))
    camera.data.ortho_scale = 1
    frame = camera.data.view_frame(scene=scene)
    width = max(point.x for point in frame) - min(point.x for point in frame)
    height = max(point.y for point in frame) - min(point.y for point in frame)
    # Six percent margin on every edge also covers extrema between samples.
    camera.data.ortho_scale = max((maximum.x - minimum.x) / width, (maximum.y - minimum.y) / height) / 0.88
    camera.data.clip_start, camera.data.clip_end = 0.01, 100
    bpy.context.view_layer.update()
    from bpy_extras.object_utils import world_to_camera_view
    for x in (minimum.x, maximum.x):
        for y in (minimum.y, maximum.y):
            for z in (minimum.z, maximum.z):
                uv = world_to_camera_view(scene, camera, rotation @ Vector((x, y, z)))
                if not (0.059 <= uv.x <= 0.941 and 0.059 <= uv.y <= 0.941 and uv.z > 0):
                    raise ValueError(f'Yoga camera failed full-action framing: {tuple(uv)}')
    scene['yoga_camera_fit_samples'] = len(actions) * 33


def build_supports(scene, model):
    supports = bpy.data.collections.new(f"{model['variant']} | Pose supports - enable matching collection")
    scene.collection.children.link(supports)
    cork = material(f"{model['variant']} cork", (0.38, 0.26, 0.14), 0.95)
    for name, pose in model['poses'].items():
        if not pose['props']:
            continue
        collection = bpy.data.collections.new(f"{model['variant']} | Supports | {name}")
        supports.children.link(collection)
        for index, prop in enumerate(pose['props']):
            if prop['type'] != 'block':
                raise ValueError(f"Unsupported Yoga prop: {prop['type']}")
            x, y, z = prop['position']
            width, height, depth = prop['size']
            # glTF Y-up becomes Blender Z-up: (x, y, z) -> (x, -z, y).
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
            block = bpy.context.object
            block.name = f"{model['variant']} | {name} | Cork block {index + 1}"
            block.scale = (width, depth, height)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            bevel = block.modifiers.new('Soft cork edges', 'BEVEL')
            bevel.width, bevel.segments = min(prop['size']) * 0.075, 3
            block.data.materials.append(cork)
            for owner in list(block.users_collection):
                owner.objects.unlink(block)
            collection.objects.link(block)
        # Excluding this collection hides it in viewport and render together.
        # The artist can enable its checkbox; no Python handler is needed.
        bpy.context.view_layer.layer_collection.children[supports.name].children[collection.name].exclude = True


def build_model(model):
    variant = model['variant']
    scene = bpy.data.scenes.new(f'Yoga | {variant.title()}')
    bpy.context.window.scene = scene
    scene.render.fps = MANIFEST['fps']
    frames = round(MANIFEST['durationSeconds'] * MANIFEST['fps'])
    scene.frame_start, scene.frame_end = 1, frames
    scene.render.resolution_x, scene.render.resolution_y = 1440, 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = enum_value(scene.render.image_settings, 'file_format', 'PNG')
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / model['file']), disable_bone_shape=True)
    armatures = [obj for obj in scene.objects if obj.type == 'ARMATURE']
    if len(armatures) != 1 or len(armatures[0].data.bones) != model['bones']:
        raise ValueError(f'{variant}: imported rig does not match the export manifest.')
    armature = armatures[0]
    anatomy = [obj for obj in scene.objects if obj.type == 'MESH']
    armature.name = f"Yoga {variant} | {model['bones']} controls"
    armature.show_in_front = False
    actions = {}
    for track in armature.animation_data.nla_tracks:
        track.mute = True
        for strip in track.strips:
            action = strip.action
            key = re.sub(r'\.\d{3,}$', '', action.name)
            if key not in model['actions'] or key in actions:
                raise ValueError(f'{variant}: unexpected or duplicate imported action {key}.')
            if len(action.slots) != 1:
                raise ValueError(f'{variant} {key}: expected one armature action slot.')
            normalize_action_frames(action, frames)
            compact_constant_keys(action)
            strip.action_frame_start, strip.action_frame_end = 1, frames + 1
            action.name = f'{variant} | {key}'
            action.use_fake_user = True
            actions[key] = action
    if set(actions) != set(model['actions']):
        raise ValueError(f'{variant}: imported action set is incomplete.')
    action = actions['adho-mukha-svanasana.both']
    armature.animation_data.action = action
    if action.slots:
        armature.animation_data.action_slot = action.slots[0]
    for obj in scene.objects:
        if obj.type == 'MESH':
            skin = obj.get('tissue') == 'skin'
            obj.hide_render = skin
            obj.hide_set(skin)
    scene.frame_set(1 + round(frames * 0.5))
    for name, phase in [('Preparación', 0), ('Entrada', 0.08), ('Permanencia', 0.36), ('Pose de referencia', 0.5), ('Salida', 0.66)]:
        scene.timeline_markers.new(name, frame=1 + round(frames * phase))
    build_supports(scene, model)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.009))
    mat = bpy.context.object
    mat.name = 'Yoga mat | support surface z=0'
    mat.scale = (1.05, 2.35, 0.016)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = mat.modifiers.new('Soft mat corners', 'BEVEL')
    bevel.width, bevel.segments = 0.006, 3
    mat.data.materials.append(material(f'{variant} mat', (0.055, 0.11, 0.098)))

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.021))
    floor = bpy.context.object
    floor.name = 'Studio floor'
    floor.data.materials.append(material(f'{variant} studio', (0.016, 0.029, 0.029)))
    world = bpy.data.worlds.new(f'Yoga {variant} studio')
    world.use_nodes = True
    bg = next(node for node in world.node_tree.nodes if node.type == 'BACKGROUND')
    bg.inputs['Color'].default_value = (0.2, 0.27, 0.29, 1)
    bg.inputs['Strength'].default_value = 0.35
    scene.world = world
    for name, position, energy, size, color in [
        ('Key softbox', (2.8, -3.5, 5), 450, 4, (1, 0.9, 0.78)),
        ('Fill softbox', (-3, -1, 2.8), 250, 3, (0.78, 0.88, 1)),
        ('Rim softbox', (0.5, 3, 4), 500, 3, (1, 0.94, 0.85)),
    ]:
        light_data = bpy.data.lights.new(name, 'AREA')
        light_data.energy, light_data.size, light_data.color = energy, size, color
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = position
        point_at(light, (0, 0, 0.7))
    camera_data = bpy.data.cameras.new(f'Yoga {variant} camera')
    camera_data.type = enum_value(camera_data, 'type', 'ORTHO')
    camera = bpy.data.objects.new(f'Yoga {variant} camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (-3.8, -1.7, 1.65)
    point_at(camera, (0, -0.02, 0.55))
    scene.camera = camera
    fit_workshop_camera(scene, camera, armature, actions, anatomy, frames, model['poses'])
    scene['yoga_model'] = variant
    scene['yoga_source_hash'] = MANIFEST['sourceHash']
    scene['yoga_glb_sha256'] = model['sha256']
    scene['yoga_actions'] = '\n'.join(sorted(actions))
    asana_count = len({pose['asanaId'] for pose in model['poses'].values()})
    scene['yoga_source'] = f"Source geometry and skinning: live YogaStage, {asana_count} asanas / {len(actions)} anatomical-side clips."
    for obj in scene.objects:
        obj.select_set(False)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    return scene


scenes = [build_model(model) for model in MANIFEST['models']]
bpy.context.window.scene = scenes[0]
readme = bpy.data.texts.new('YOGA - Read me')
readme.write(f'''KLISTENI YOGA QUALITY WORKSHOP

Two Yoga scenes: male / female. Each armature has
{len(MANIFEST['models'][0]['actions'])} editable actions covering
{len({pose['asanaId'] for pose in MANIFEST['models'][0]['poses'].values()})} asanas
and both sides of unilateral postures, sampled at {MANIFEST['fps']} fps.
Frame {1 + round(MANIFEST['durationSeconds'] * MANIFEST['fps'] * 0.5)} is the held posture.
Playback frames 1-{round(MANIFEST['durationSeconds'] * MANIFEST['fps'])} form a
{MANIFEST['durationSeconds']}-second loop. The closing key at frame
{1 + round(MANIFEST['durationSeconds'] * MANIFEST['fps'])} matches frame 1,
outside the playback range.

Choose an action in the Dope Sheet / Action Editor. The imported NLA tracks
are muted; the chosen active action drives the pose. Skin is hidden by
default so muscles and bones stay visible; enable skin:anatomy to inspect
the external surface. The yoga_spine controls distribute curvature; the
intermediate shoulder controls distribute torso-to-humerus rotation.
The fixed camera contains the deformed anatomy of every action, sampled at 33
phases per clip, plus props and either mat orientation, with an edge margin.

Support blocks are grouped by action beneath Pose supports. Enable the checkbox
of the matching support collection for poses with blocks; disable it when you
switch actions. These collections are excluded by default. Rotate the mat 90
degrees around Z for Warrior II and Triangle. No automatic script execution or
frame-change handler is needed to use these props or play the actions.

The source is the licensed anatomical atlas used by the web application.
Creator: {ATLAS['creator']}
Source: {ATLAS['sourceRepository']}
Source revision: {ATLAS['sourceCommit']}
License: {ATLAS['license']} ({ATLAS['licenseUrl']})
The full source license is embedded as the text YOGA - Atlas license.
This workshop adds Yoga deformation weights, controls and authored movement
to the source atlas. Preserve the attribution and share-alike terms when sharing.
These are artist-authored educational approximations, not a medical atlas
of motion or a vertebral biomechanics simulation.

Canonical authoring logic: apps/web/src/lib/yoga-rig.ts, yoga-motion.ts,
yoga-anatomy.ts. Rebuild this editable snapshot with:
node scripts/export-yoga-blender.mjs
blender --background --factory-startup --python scripts/blender/build_yoga.py

Blender changes do not automatically update the web application.
''')
license_text = bpy.data.texts.new('YOGA - Atlas license')
license_text.write(ATLAS_LICENSE)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            space = area.spaces.active
            space.overlay.show_overlays = False
            space.region_3d.view_perspective = enum_value(space.region_3d, 'view_perspective', 'CAMERA')
            space.shading.type = enum_value(space.shading, 'type', 'MATERIAL')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
for path, expected in MANIFEST['sources'].items():
    if digest(ROOT / path) != expected:
        raise ValueError(f'Yoga source changed while building: {path}; re-export before saving.')
for model in MANIFEST['models']:
    if digest(SOURCE / model['file']) != model['sha256']:
        raise ValueError(f"Yoga GLB changed while building: {model['file']}; rebuild before saving.")
clear_file_browser_state()
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT), compress=True)
print(f"Saved {OUTPUT}: {len(MANIFEST['models'])} models, {sum(len(model['actions']) for model in MANIFEST['models'])} actions, source {MANIFEST['sourceHash']}.")
