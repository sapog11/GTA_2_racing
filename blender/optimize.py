# Clean + optimize AI-generated parts: centre, scale to unit size, decimate, shrink textures, export GLB.
# python3 blender/optimize.py  (reads design/parts/raw3d/*.glb -> public/models/parts/ai/*.glb)
import bpy, os, glob, math, mathutils
ROOT=os.path.join(os.path.dirname(__file__),'..');SRC=os.path.join(ROOT,'design','parts','raw3d');DST=os.path.join(ROOT,'public','models','parts','ai');os.makedirs(DST,exist_ok=True)
TARGET={'rim':9000,'headlight':8000,'taillight':6000,'mirror':3000,'wing':4000,'hood':5000,'bumper_front':7000,'bumper_rear':7000}
for f in sorted(glob.glob(os.path.join(SRC,'*_*.glb'))):
    name=os.path.splitext(os.path.basename(f))[0];out=os.path.join(DST,name+'.glb')
    if 'tripo' in name or (os.path.exists(out) and os.path.getmtime(out)>os.path.getmtime(f)):continue
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=f)
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    if len(obs)>1:bpy.ops.object.join()
    o=bpy.context.view_layer.objects.active;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    part=[k for k in TARGET if name.endswith(k)];tgt=TARGET[part[0]] if part else 5000
    tris=sum(len(p.vertices)-2 for p in o.data.polygons)
    if tris>tgt:m=o.modifiers.new('dec','DECIMATE');m.ratio=tgt/tris;bpy.ops.object.modifier_apply(modifier='dec')
    bb=[o.matrix_world@mathutils.Vector(c) for c in o.bound_box];mn=mathutils.Vector([min(v[i] for v in bb) for i in range(3)]);mx=mathutils.Vector([max(v[i] for v in bb) for i in range(3)])
    ctr=(mn+mx)/2;size=max(mx-mn);o.location-=ctr;bpy.ops.object.transform_apply(location=True);o.scale=(1/size,)*3;bpy.ops.object.transform_apply(scale=True)
    for img in bpy.data.images:
        if img.size[0]>512:img.scale(512,512)
    bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=80,use_selection=False)
    t2=sum(len(p.vertices)-2 for p in o.data.polygons);print('ok',name,tris,'->',t2,round(os.path.getsize(out)/1024),'KB',flush=True)
import json
json.dump(sorted(os.path.splitext(f)[0] for f in os.listdir(DST) if f.endswith('.glb')),open(os.path.join(DST,'index.json'),'w'))
