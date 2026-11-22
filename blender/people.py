# Shrink textures of rigged+animated Tripo people and export to public/models/people/ai/
import bpy,os,glob
ROOT=os.path.join(os.path.dirname(__file__),'..');DST=os.path.join(ROOT,'public','models','people','ai');os.makedirs(DST,exist_ok=True)
for f in sorted(glob.glob(os.path.join(ROOT,'design','people','raw','*_anim.glb'))):
    n=os.path.basename(f).replace('_anim.glb','');out=os.path.join(DST,n+'.glb')
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=f)
    for img in bpy.data.images:
        if img.size[0]>512:img.scale(512,512)
    bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=80,export_animations=True,export_skins=True)
    print('ok',n,round(os.path.getsize(out)/1024),'KB',[a.name for a in bpy.data.actions],flush=True)
import json;json.dump(sorted(os.path.splitext(x)[0] for x in os.listdir(DST) if x.endswith('.glb')),open(os.path.join(DST,'index.json'),'w'))
