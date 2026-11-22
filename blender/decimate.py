# python3 blender/decimate.py file.glb target_tris  (keeps skins/animations)
import bpy,sys
f,t=sys.argv[-2],int(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=f)
tot=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
r=min(1,t/max(tot,1))
for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
    if r<1:
        bpy.context.view_layer.objects.active=o;m=o.modifiers.new('d','DECIMATE');m.ratio=r
        while o.modifiers[0].name!='d':bpy.ops.object.modifier_move_up(modifier='d')
        bpy.ops.object.modifier_apply(modifier='d')
for img in bpy.data.images:
    if img.size[0]>512:img.scale(512,512)
bpy.ops.export_scene.gltf(filepath=f,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=80,export_animations=True,export_skins=True)
print('ok',f,tot,'->',sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons))
