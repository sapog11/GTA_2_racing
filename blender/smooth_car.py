# Smooth a split car GLB: Catmull-Clark subdivision on the body with sharp creases kept, smooth normals.
# python3 blender/smooth_car.py in.glb out.glb [levels]
import bpy,sys,math,bmesh
src,dst=sys.argv[-3],sys.argv[-2];lv=int(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
for o in bpy.context.scene.objects:
    if o.type!='MESH' or o.name!='Body':continue
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5)
    cl=bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
    for e in bm.edges:
        if len(e.link_faces)==2 and e.calc_face_angle(0)>math.radians(48):e[cl]=.85
        elif len(e.link_faces)!=2:e[cl]=1
    bm.to_mesh(o.data);bm.free()
    m=o.modifiers.new('s','SUBSURF');m.levels=m.render_levels=lv;m.uv_smooth='PRESERVE_BOUNDARIES';m.boundary_smooth='PRESERVE_CORNERS'
    bpy.ops.object.modifier_apply(modifier='s')
    for p in o.data.polygons:p.use_smooth=True
    print('body faces',len(o.data.polygons))
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=85)
