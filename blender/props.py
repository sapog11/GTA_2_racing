import bpy,os,glob,mathutils,json
ROOT=os.path.join(os.path.dirname(__file__),'..');DST=os.path.join(ROOT,'public','models','city');os.makedirs(DST,exist_ok=True)
TGT={'lamp':2500,'tree':6000,'busstop':4000,'bins':3000,'house_old':9000,'panelak':9000}
for n,t in TGT.items():
    f=os.path.join(ROOT,'design','city','raw',n+'.glb');bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=f)
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]
    if len(obs)>1:bpy.ops.object.join()
    o=bpy.context.view_layer.objects.active;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    tris=sum(len(p.vertices)-2 for p in o.data.polygons)
    if tris>t:m=o.modifiers.new('d','DECIMATE');m.ratio=t/tris;bpy.ops.object.modifier_apply(modifier='d')
    bb=[o.matrix_world@mathutils.Vector(c) for c in o.bound_box];mn=mathutils.Vector([min(v[i] for v in bb) for i in range(3)]);mx=mathutils.Vector([max(v[i] for v in bb) for i in range(3)])
    o.location-=mathutils.Vector(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z));bpy.ops.object.transform_apply(location=True);h=mx.z-mn.z;o.scale=(1/h,)*3;bpy.ops.object.transform_apply(scale=True)
    for img in bpy.data.images:
        if img.size[0]>512:img.scale(512,512)
    bpy.ops.export_scene.gltf(filepath=os.path.join(DST,n+'.glb'),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=80)
    print('ok',n,tris,round((mx.x-mn.x)/h,2),round((mx.y-mn.y)/h,2),flush=True)
