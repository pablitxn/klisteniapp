import bpy, json, sys
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
summary=[]
for system,filename in [('muscular','MuscularSystem100.fbx'),('skeletal','SkeletalSystem100.fbx'),('skin','Regions of human body100.fbx')]:
    before=set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(root/'.cache/anatomy'/filename))
    for obj in set(bpy.data.objects)-before:
        if obj.type!='MESH': continue
        pts=[obj.matrix_world @ Vector(c) for c in obj.bound_box]
        mins=[min(p[i] for p in pts) for i in range(3)]
        maxs=[max(p[i] for p in pts) for i in range(3)]
        summary.append({'name':obj.name,'system':system,'vertices':len(obj.data.vertices),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'min':mins,'max':maxs,'materials':[m.name for m in obj.data.materials if m]})
(root/'.cache/anatomy/source-inspection.json').write_text(json.dumps(summary,indent=2))
print('INSPECTED',len(summary),'objects; triangles',sum(o['triangles'] for o in summary))
print('BOUNDS',[[min(o['min'][i] for o in summary),max(o['max'][i] for o in summary)] for i in range(3)])
bpy.ops.wm.save_as_mainfile(filepath=str(root/'.cache/anatomy/source-import.blend'))
