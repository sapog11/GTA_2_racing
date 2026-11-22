# Split an AI-generated whole-car GLB into Body + Wheel_FL/FR/RL/RR, normalize and optimize.
# python3 blender/split_car.py in.glb out.glb
import bpy, bmesh, sys, math, mathutils, numpy as np
src,dst=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
for o in obs:o.select_set(True)
bpy.context.view_layer.objects.active=obs[0]
if len(obs)>1:bpy.ops.object.join()
car=bpy.context.view_layer.objects.active;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
V=np.array([v.co[:] for v in car.data.vertices]);mn,mx=V.min(0),V.max(0)
if (mx[1]-mn[1])>(mx[0]-mn[0])*1.15:
    car.data.transform(mathutils.Matrix.Rotation(math.pi/2,4,'Z'));V=np.array([v.co[:] for v in car.data.vertices]);mn,mx=V.min(0),V.max(0);print('rotated 90')
# remove baked magenta neon reflections from the concept-art lighting
for img in bpy.data.images:
    if not img.size[0]:continue
    px=np.array(img.pixels[:]).reshape(-1,4);r,g,b=px[:,0],px[:,1],px[:,2];mxc=np.maximum(np.maximum(r,g),b);mnc=np.minimum(np.minimum(r,g),b)
    pink=(r>g*1.35)&(b>g*1.15)&(mxc-mnc>.12);lum=r*.3+g*.59+b*.11;k=np.where(pink,.85,0)
    for c in(0,1,2):px[:,c]=px[:,c]*(1-k)+lum*k*.8
    img.pixels[:]=px.ravel();img.pack() if False else None
    print('pink px',int(pink.sum()))
# normalize: length along X = 1, centred in X/Y, ground at z=0
L=mx[0]-mn[0];off=mathutils.Vector((-(mn[0]+mx[0])/2,-(mn[1]+mx[1])/2,-mn[2]))
for v in car.data.vertices:v.co=(v.co+off)/L
V=np.array([v.co[:] for v in car.data.vertices]);H=V[:,2].max();W=V[:,1].max()
# wheel x positions: where the low part of the car is widest
low=V[V[:,2]<H*.42];bins=np.linspace(-.5,.5,81);wid=np.zeros(80)
for i in range(80):
    s=low[(low[:,0]>=bins[i])&(low[:,0]<bins[i+1])]
    wid[i]=np.abs(s[:,1]).max() if len(s) else 0
def peak(lo,hi):
    idx=[i for i in range(80) if lo<=(bins[i]+bins[i+1])/2<=hi];w=wid[idx];m=w.max();sel=[idx[k] for k in range(len(idx)) if w[k]>=m-.01]
    xs=[(bins[i]+bins[i+1])/2 for i in sel];return (min(xs)+max(xs))/2,(max(xs)-min(xs))/2+.0125
xf,hwf=peak(.05,.48);xr,hwr=peak(-.48,-.05)
r=max(.07,min(.2,(hwf+hwr)/2*1.0));zc=r
# tyre radius from the lowest-point profile: use vertical extent of outer-band vertices near each axle
def radius(xc):
    s=V[(np.abs(V[:,0]-xc)<.02)&(np.abs(V[:,1])>W*.8)];return (s[:,2].max()/2) if len(s) else r
rf,rr=radius(xf),radius(xr);rf=min(max(rf,.08),.2);rr=min(max(rr,.08),.2)
print('wheels',round(xf,3),round(xr,3),'r',round(rf,3),round(rr,3),'W',round(W,3),'H',round(H,3))
centers={'FL':(xf,1,rf),'FR':(xf,-1,rf),'RL':(xr,1,rr),'RR':(xr,-1,rr)}
def lab(c):
    for (k,xc,rad) in(('F',xf,rf),('R',xr,rr)):
        if math.hypot(c.x-xc,c.z-rad)<rad*1.04 and abs(c.y)>W-rad*1.15:return k+('L' if c.y>0 else 'R')
    return None
for k in('FL','FR','RL','RR'):
    bpy.ops.object.select_all(action='DESELECT');car.select_set(True);bpy.context.view_layer.objects.active=car
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bpy.ops.object.mode_set(mode='OBJECT')
    n=0
    for p in car.data.polygons:
        p.select=(lab(p.center)==k);n+=p.select
    if not n:continue
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
    w=[o for o in bpy.context.selected_objects if o!=car][0];w.name='Wheel_'+k
    xc,sd,rad=centers[k];yc=float(np.array([v.co.y for v in w.data.vertices]).mean())
    bpy.context.scene.cursor.location=(xc,yc,rad);bpy.ops.object.select_all(action='DESELECT');w.select_set(True);bpy.context.view_layer.objects.active=w;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
car.name='Body'
tris=sum(len(p.vertices)-2 for p in car.data.polygons)
if tris>30000:
    m=car.modifiers.new('d','DECIMATE');m.ratio=30000/tris;bpy.context.view_layer.objects.active=car;bpy.ops.object.modifier_apply(modifier='d')
for img in bpy.data.images:
    if img.size[0]>1024:img.scale(1024,1024)
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=82)
print('exported',[o.name for o in bpy.context.scene.objects])
