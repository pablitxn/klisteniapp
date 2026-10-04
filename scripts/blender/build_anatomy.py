"""Build licensed, registered Z-Anatomy geometry; run with Blender --background.

No remeshing, invented body envelope, or limb stretching. Decimation is measured
against a deterministic sample of original vertices, NOT a Hausdorff guarantee.
The source skin territories keep their original exterior triangles unchanged.
"""
import bpy, bmesh, json, hashlib, math, re, time, struct
from pathlib import Path
from collections import Counter
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[2]
CACHE=ROOT/'.cache/anatomy'
OUT=ROOT/'apps/web/public/models'
ASSETS=ROOT/'assets/blender'
for folder in (CACHE,OUT,ASSETS):folder.mkdir(parents=True,exist_ok=True)
HEIGHT=1.8
SOURCE_FLOOR=-0.0003824450832325965
SOURCE_TOP=1.7091528177261353
SCALE=HEIGHT/(SOURCE_TOP-SOURCE_FLOOR)

def source_to_gltf(v): return [round(v[0]*SCALE,9),round((v[2]-SOURCE_FLOOR)*SCALE,9),round(-v[1]*SCALE,9)]
left={'shoulder':[.173821285,.022997165,1.384690046], 'elbow':[.222,.034,1.096], 'wrist':[.2592,-.01436,.856], 'hip':[.070791528,.007162600,.861496806], 'knee':[.079,.033,.435], 'ankle':[.073,.038,.08], 'handEnd':[.293,-.031,.694], 'toe':[.095,-.125,.02]}
landmarks={'version':1,'coordinateSystem':'glTF metres: +Y up, +Z anterior, anatomical left +X', 'normalization':{'uniformScale':SCALE,'sourceFloor':SOURCE_FLOOR,'sourceTop':SOURCE_TOP,'targetHeight':HEIGHT}, 'method':'Artist-selected rig landmarks informed by original bone surface bounds and proximal/distal vertex centroids; not clinically validated joint centers.', 'pelvis':source_to_gltf([0,.007162600,.861496806]),'neck':source_to_gltf([0,.020,1.48]),'headTop':source_to_gltf([0,0,SOURCE_TOP]), 'left':{k:source_to_gltf(v) for k,v in left.items()},'right':{k:source_to_gltf([-v[0],v[1],v[2]]) for k,v in left.items()}}
(OUT/'rig-landmarks.json').write_text(json.dumps(landmarks,indent=2)+'\n')

inspection=json.loads((CACHE/'source-inspection.json').read_text())
lookup={o['name']:o for o in inspection}
bpy.ops.wm.open_mainfile(filepath=str(CACHE/'source-import.blend'))
original_world={o.name:o.matrix_world.copy() for o in bpy.data.objects}
# FBX mirrored structures share datablocks: copy BEFORE any transform mutation.
for source_obj in bpy.data.objects:
    if source_obj.type=='MESH':source_obj.data=source_obj.data.copy()
remove_words=['fascia','bursa','sheath','retinaculum','cross section','ligament','septum','aponeurosis','tarsus','tendinous ring']
excluded=[]
kept=[]
for obj in list(bpy.data.objects):
    info=lookup.get(obj.name)
    keep=False
    if obj.type=='MESH' and info:
        n=obj.name.lower(); mats=info['materials'];system=info['system']
        if system=='muscular':keep=bool(mats) and (not any(word in n for word in remove_words) or 'tensor fasciae latae' in n)
        elif system=='skeletal':keep=any(m.lower().startswith(('bone','teeth','dentine')) for m in mats) and not any(word in n for word in ['sinus of','incus.','malleus.','stapes.'])
        elif system=='skin':keep=any(m.startswith('Skin-') or m=='Nail' for m in mats)
    if keep:kept.append(obj)
    else:
        if info:excluded.append({'name':obj.name,'system':info['system'],'reason':'annotation, non-target structure, fascia/backing, or excluded auditory ossicle'})
        bpy.data.objects.remove(obj,do_unlink=True)

# Bake transforms, preserving source handedness. glTF export converts Z-up to Y-up.
for obj in kept:
    world=original_world[obj.name]
    obj.parent=None
    obj.data.transform(world)
    if world.determinant()<0:
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
        bm.to_mesh(obj.data);bm.free()
    obj.matrix_world=Matrix.Identity(4)
    for vert in obj.data.vertices:
        vert.co.z-=SOURCE_FLOOR
        vert.co*=SCALE
    obj.data.update()


def group_id(name):
    n=name.lower()
    pairs=[('pectorals',['pectoralis major']),('deltoids',['deltoid']),('triceps',['triceps brachii']),('lats',['latissimus']),('biceps',['biceps brachii']),('upper-back',['trapezius','rhomboid']),('abdominals',['rectus abdominis','transversus abdominis']),('obliques',['abdominal oblique']),('glutes',['gluteus']),('quadriceps',['rectus femoris','vastus']),('hamstrings',['biceps femoris','semitendinosus','semimembranosus']),('calves',['gastrocnemius','soleus'])]
    return next((key for key,words in pairs if any(w in n for w in words)),None)

def segment(name,center):
    x,y,z=center; n=name.lower();ax=abs(x)
    if any(w in n for w in ['hip region','hypogastric region','anal region','urogenital region','inguinal region','sacral region','gluteal region']):return 'pelvis'
    if n.startswith(('mental region.','mentolabial','submental triangle.','oral region.','labial region.','nasal region.','infra-orbital region.')):return 'head'
    if n.startswith('pectoral region.'):return 'torso'
    # Coordinates are still Blender Z-up here.
    if z>1.52*SCALE:return 'head'
    if ax>.165*SCALE and z>.60*SCALE:
        if z<.86*SCALE:return 'hand'
        if z<1.10*SCALE:return 'forearm'
        return 'upperArm'
    if z<.90*SCALE:
        if z<.13*SCALE:return 'foot'
        if z<.44*SCALE:return 'shin'
        if 'hip bone' in n or 'sacrum' in n or 'coccyx' in n or 'glute' in n:return 'pelvis'
        return 'thigh'
    return 'torso'

def material(name,color):
    mat=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=.56
    return mat
materials={
    'muscle':material('Natural muscle and tendon - vertex color',(1,1,1)),
    'bone':material('Natural bone - vertex color',(1,1,1)),
    'skin':material('Registered body surface - vertex color',(1,1,1)),
}
for mat in materials.values():
    nodes=mat.node_tree.nodes
    attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='AnatomyColor'
    mat.node_tree.links.new(attr.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])

reports=[]
started=time.time()
for index,obj in enumerate(kept):
    info=lookup[obj.name];system=info['system'];tissue={'muscular':'muscle','skeletal':'bone','skin':'skin'}[system]
    original_mats=[m.name if m else '' for m in obj.data.materials]
    source_colors={}
    if tissue=='skin':
        # Territories are thin volumes; keep only exact registered exterior faces.
        bm=bmesh.new();bm.from_mesh(obj.data)
        gone=[f for f in bm.faces if original_mats[f.material_index]=='Skin-in']
        bmesh.ops.delete(bm,geom=gone,context='FACES')
        bm.to_mesh(obj.data);bm.free();obj.data.update()
    # Discard pre-existing loose points/edges and removed territory backing vertices.
    bm=bmesh.new();bm.from_mesh(obj.data)
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    source_vertices=[v.co.copy() for v in obj.data.vertices]
    source_polygons=[list(p.vertices) for p in obj.data.polygons]
    before=sum(len(p.vertices)-2 for p in obj.data.polygons)
    center=sum(source_vertices,Vector())/max(1,len(source_vertices))
    region=group_id(obj.name) if tissue=='muscle' else None
    side='left' if re.search(r'\.l(?:\.\d+)?$',obj.name) else 'right' if re.search(r'\.r(?:\.\d+)?$',obj.name) else None
    for k,v in {'system':tissue,'tissue':tissue,'muscleId':region or '', 'region':region or '', 'anatomyName':obj.name,'bodySegment':segment(obj.name,center),'side':side or '', 'sourceFile':{'muscle':'MuscularSystem100.fbx','bone':'SkeletalSystem100.fbx','skin':'Regions of human body100.fbx'}[tissue], 'license':'CC-BY-SA-4.0'}.items():obj[k]=v
    # Retain small structure contours. Body surface is never decimated.
    ratio=1 if tissue=='skin' or before<360 else max(180/before,.16 if tissue=='bone' else .12)
    original=obj.data.copy()
    sample_indices=sorted(set([round(i*(len(source_vertices)-1)/min(199,len(source_vertices)-1)) for i in range(min(200,len(source_vertices)))])) if len(source_vertices)>1 else [0]
    samples=[source_vertices[i] for i in sample_indices]
    tight=obj['bodySegment'] in ['head','hand','foot']
    max_allowed=.0009 if tight else .0017
    p95_allowed=.0004 if tight else .0007
    errors=[]
    while True:
        if ratio<.999:
            obj.data=original.copy()
            bpy.context.view_layer.objects.active=obj
            modifier=obj.modifiers.new('Shape-preserving measured decimation','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        else:obj.data=original.copy()
        bm=bmesh.new();bm.from_mesh(obj.data);tree=BVHTree.FromBMesh(bm)
        errors=sorted(tree.find_nearest(p)[3] or 0 for p in samples)
        bm.free()
        p95=errors[min(len(errors)-1,int(len(errors)*.95))] if errors else 0
        if not errors or (max(errors)<=max_allowed and p95<=p95_allowed) or ratio>=.999:break
        ratio=min(1,ratio*1.6)
    # Keep natural tendon face distinction in an exported vertex color attribute.
    for old_color in list(obj.data.color_attributes):obj.data.color_attributes.remove(old_color)
    color_attr=obj.data.color_attributes.new(name='AnatomyColor',type='BYTE_COLOR',domain='CORNER')
    seed=int(hashlib.sha256(obj.name.encode()).hexdigest()[:4],16)/65535
    for polygon in obj.data.polygons:
        srcmat=original_mats[polygon.material_index] if polygon.material_index<len(original_mats) else ''
        if tissue=='muscle':
            rgb=(.81,.765,.66) if 'Tendon' in srcmat else (.50+.035*seed,.165+.018*seed,.13+.012*seed)
        elif tissue=='bone':rgb=(.83,.80,.72) if 'Teeth' not in srcmat else (.93,.90,.81)
        else:rgb=(.64,.435,.31) if srcmat!='Nail' else (.74,.57,.46)
        for loop in polygon.loop_indices:color_attr.data[loop].color=(*rgb,1)
        polygon.material_index=0;polygon.use_smooth=True
    obj.data.materials.clear();obj.data.materials.append(materials[tissue])
    after=sum(len(p.vertices)-2 for p in obj.data.polygons)
    reports.append({'name':obj.name,'tissue':tissue,'bodySegment':obj['bodySegment'],'region':region,'sourceTriangles':before,'optimizedTriangles':after,'decimationRatio':round(ratio,4),'sampleCount':len(samples),'sampledMaxDistanceM':round(max(errors,default=0),8),'sampledP95DistanceM':round(p95,8)})
    if index%100==0:print(f'PROGRESS {index}/{len(kept)} {obj.name}: {before}->{after}',flush=True)
    bpy.data.meshes.remove(original)

bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
# Source remains editable, named and already normalized; geometry is never joined.
bpy.data.orphans_purge(do_recursive=True)
# File-browser editor state is part of a .blend, even when no external assets
# use absolute paths. Avoid publishing the workstation's last visited folder.
for screen in bpy.data.screens:
    for area in screen.areas:
        for space in area.spaces:
            params = getattr(space, 'params', None)
            if space.type == 'FILE_BROWSER' and params is not None:
                params.directory = b'//'
                params.filename = ''
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS/'anatomy.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'anatomy.glb'),export_format='GLB',export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT',export_normals=True,export_texcoords=False,export_all_vertex_colors=True)
glb_bytes=(OUT/'anatomy.glb').read_bytes()
glb_json_length=struct.unpack_from('<I',glb_bytes,12)[0]
glb=json.loads(glb_bytes[20:20+glb_json_length])
export_triangles=sum(glb['accessors'][p['indices']]['count']//3 for m in glb['meshes'] for p in m['primitives'])
commit=json.loads((CACHE/'source-commit.json').read_text())['sha']
api_files=json.loads((CACHE/'github-files.json').read_text())
files=[]
for fname in ['MuscularSystem100.fbx','SkeletalSystem100.fbx','Regions of human body100.fbx']:
    entry=next(o for o in api_files if o['name']==fname)
    files.append({'name':fname,'url':entry['download_url'].replace('/PC-Version/',f'/{commit}/'),'githubBlobSha':entry['sha'],'sha256':hashlib.sha256((CACHE/fname).read_bytes()).hexdigest(),'bytes':(CACHE/fname).stat().st_size})
summary={'schemaVersion':1,'title':'Registered anatomical body surface, musculature and skeleton','creator':'Z-Anatomy contributors; BodyParts3D / Anatomography, DBCLS','sourceRepository':'https://github.com/LluisV/Z-Anatomy','sourceCommit':commit,'license':'CC-BY-SA-4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/','sources':files,'normalization':landmarks['normalization'],'coordinateSystem':landmarks['coordinateSystem'],'geometry':{'meshCount':len(reports),'sourceTriangles':sum(o['sourceTriangles'] for o in reports),'optimizedTriangles':export_triangles,'preExportTriangles':sum(o['optimizedTriangles'] for o in reports),'glbBytes':(OUT/'anatomy.glb').stat().st_size,'byTissue':dict(Counter(o['tissue'] for o in reports))},'modifications':['Removed annotation geometry, muscle attachment visualizers, fascia/bursae/sheaths, and auditory ossicles.','Kept exact external body-surface territory triangles; removed Skin-in interior backing faces.','Uniformly normalized complete registered assembly to 1.8 m body-surface height and translated soles to floor.','Adaptively decimated internal musculature and skeleton with sampled surface-distance checks; no remeshing or shape fitting.','Baked original world transforms once per independent mesh; reversed face winding for negative-determinant source instances to retain outward orientation.','Recolored materials in natural tissue hues, retaining original tendon face assignments through vertex colors.'],'limitations':['Source is a generic registered anatomical atlas, not a personalized medical scan.','Surface-distance checks sample up to 200 source vertices per object, one direction only; not a global Hausdorff bound.','Rig landmarks and simulated exercise motion are educational approximations and not clinically validated biomechanics.'],'optimization':{'sampledMaxDistanceM':max(o['sampledMaxDistanceM'] for o in reports),'sampledP95MaxAcrossMeshesM':max(o['sampledP95DistanceM'] for o in reports),'elapsedSeconds':round(time.time()-started,2)}}
(OUT/'anatomy-manifest.json').write_text(json.dumps(summary,indent=2)+'\n')
(ASSETS/'optimization-report.json').write_text(json.dumps({'method':'Up to 200 deterministic source-vertex samples per individual mesh; nearest triangle on optimized mesh in normalized metres; one-direction sampled distances only. Surface territory removal is not counted as decimation.','meshes':reports,'excluded':excluded},indent=2)+'\n')
print('DONE',json.dumps(summary['geometry']),json.dumps(summary['optimization']),flush=True)
