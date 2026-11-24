# python3 blender/replace_tex.py in.glb texture.png out.glb  — swap the base-colour image of every material
import bpy,sys
src,tex,dst=sys.argv[-3],sys.argv[-2],sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
new=bpy.data.images.load(tex);new.pack()
for m in bpy.data.materials:
    if not m.use_nodes:continue
    for n in m.node_tree.nodes:
        if n.type=='TEX_IMAGE' and n.image and any(l.to_socket.name=='Base Color' for l in n.outputs[0].links):n.image=new
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=88)
print('ok')
