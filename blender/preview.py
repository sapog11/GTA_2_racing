import bpy,os,sys,math
P=os.path.join(os.path.dirname(__file__),'..','public','models','parts');O=sys.argv[-1]
names=['rim_five','rim_multi','rim_mesh','rim_deep','rim_turbine','headlight_slim','rear_diffuser']
for n in names:
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=os.path.join(P,n+'.glb'))
    sc=bpy.context.scene;sc.render.engine='BLENDER_WORKBENCH';sc.display.shading.light='STUDIO';sc.display.shading.color_type='MATERIAL';sc.display.shading.show_cavity=True
    sc.render.resolution_x=sc.render.resolution_y=320;sc.render.film_transparent=False
    cam=bpy.data.objects.new('c',bpy.data.cameras.new('c'));sc.collection.objects.link(cam);sc.camera=cam
    import mathutils
    obs=[o for o in sc.objects if o.type=='MESH'];mn=mathutils.Vector((1e9,)*3);mx=-mn
    for o in obs:
        for c in o.bound_box:w=o.matrix_world@mathutils.Vector(c);mn=mathutils.Vector(map(min,mn,w));mx=mathutils.Vector(map(max,mx,w))
    ctr=(mn+mx)/2;R=(mx-mn).length
    d=mathutils.Vector((1,.45,.55)) if not n.startswith('rear') else mathutils.Vector((-1,.5,.6))
    cam.location=ctr+d.normalized()*R*1.3;cam.rotation_euler=(ctr-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=os.path.join(O,n+'.png');bpy.ops.render.render(write_still=True)
