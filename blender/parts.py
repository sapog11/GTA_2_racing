# Car parts for ÚSTÍ racing, built with Blender (bpy). Run: python3 blender/parts.py
import bpy, bmesh, math, os
OUT=os.path.join(os.path.dirname(__file__),'..','public','models','parts')
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,col,metal=0,rough=.5,emit=None):
    m=bpy.data.materials.new(name);b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*col,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=(*emit,1);b.inputs['Emission Strength'].default_value=4
    return m
def obj(name,bm,m,bevel=0,smooth=True):
    me=bpy.data.meshes.new(name);bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(m)
    if smooth:
        for p in me.polygons:p.use_smooth=True
    if bevel:
        md=o.modifiers.new('bev','BEVEL');md.width=bevel;md.segments=2;md.limit_method='ANGLE'
    md=o.modifiers.new('wn','WEIGHTED_NORMAL');md.keep_sharp=True
    return o
def cyl(r,depth,x,segs=40,r2=None,cap=True):
    bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=cap,segments=segs,radius1=r,radius2=r2 if r2 is not None else r,depth=depth)
    bmesh.ops.rotate(bm,verts=bm.verts,cent=(0,0,0),matrix=__import__('mathutils').Matrix.Rotation(math.pi/2,3,'Y'));bmesh.ops.translate(bm,verts=bm.verts,vec=(x,0,0));return bm
def torus(R,r,x,seg=48,ring=10):
    bm=bmesh.new();import mathutils
    vs=[]
    for i in range(seg):
        a=i/seg*2*math.pi;row=[]
        for j in range(ring):
            b=j/ring*2*math.pi;rr=R+r*math.cos(b);row.append(bm.verts.new((x+r*math.sin(b),rr*math.cos(a),rr*math.sin(a))))
        vs.append(row)
    for i in range(seg):
        for j in range(ring):bm.faces.new((vs[i][j],vs[(i+1)%seg][j],vs[(i+1)%seg][(j+1)%ring],vs[i][(j+1)%ring]))
    return bm
def beam(a,r0,r1,w0,w1,x0,x1,t,bm=None,twist=0):
    """tapered spoke from radius r0 (hub, depth x0) to r1 (rim, depth x1) at angle a"""
    bm=bm or bmesh.new();ca,sa=math.cos(a),math.sin(a);pa=(-sa,ca)
    def P(r,w,x,side,dz):
        o=twist*(r-r0)
        return (x+dz,r*ca+side*w*pa[0]+o*pa[0],r*sa+side*w*pa[1]+o*pa[1])
    v=[bm.verts.new(P(r,w,x,s,d)) for (r,w,x) in((r0,w0,x0),(r1,w1,x1)) for s in(-1,1) for d in(0,-t)]
    F=[(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6),(0,1,3,2),(4,6,7,5)]
    for f in F:bm.faces.new([v[i] for i in f])
    return bm
def export(name):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=False)

# ---------------- RIMS (radius 1, axle along X, outer face at +X) ----------------
def rim(style):
    reset();F=mat('Face',(.8,.8,.82),1,.25);D=mat('Barrel',(.06,.06,.07),.6,.5);C=mat('Chrome',(.95,.95,.97),1,.08);N=mat('Nut',(.7,.7,.72),1,.2)
    b=cyl(.97,.62,0,64,cap=False);obj('barrel',b,D)
    obj('lip',torus(.965,.035,.3,64,10),C if style in('deep','mesh') else F)
    obj('hub',cyl(.26,.14,.17,32,.22),F,.01)
    obj('cap',cyl(.11,.06,.26,24,.09),C,.005)
    for i in range(5):
        a=i/5*2*math.pi;n=cyl(.035,.06,.25,8);bmesh.ops.translate(n,verts=n.verts,vec=(0,.17*math.cos(a),.17*math.sin(a)));obj('nut%d'%i,n,N,smooth=False)
    bm=bmesh.new()
    if style=='five':
        for i in range(5):
            a=i/5*2*math.pi
            for s in(-.12,.12):beam(a+s,.22,.93,.15,.085,.19,.3,.13,bm)
    elif style=='multi':
        for i in range(10):beam(i/10*2*math.pi,.22,.93,.11,.065,.18,.3,.12,bm)
    elif style=='mesh':
        for i in range(10):
            a=i/10*2*math.pi;beam(a,.22,.93,.07,.05,.2,.28,.1,bm,twist=.35);beam(a,.22,.93,.07,.05,.2,.28,.1,bm,twist=-.35)
        obj('ring',torus(.55,.03,.24,48,8),F)
    elif style=='deep':
        dish=cyl(.97,.2,.2,64,.6,cap=False);obj('dish',dish,C)
        for i in range(6):a=i/6*2*math.pi;beam(a,.22,.62,.13,.1,.18,.12,.11,bm)
    elif style=='turbine':
        for i in range(16):beam(i/16*2*math.pi,.24,.93,.1,.08,.2,.29,.09,bm,twist=.5)
    obj('spokes',bm,F,.008)
    export('rim_'+style)

# ---------------- SLIM HEADLIGHT (game units, faces +X) ----------------
def slim_headlight():
    reset();H=mat('Housing',(.02,.02,.025),.9,.15);L=mat('Light',(1,1,1),0,.3,(1,.97,.92));C=mat('Chrome',(.9,.9,.92),1,.1);G=mat('Lens',(.6,.7,.8),0,.02)
    # tapered slanted housing: thin at the inner end, rises to the outer end
    bm=bmesh.new();import mathutils
    pts=[(0,-.55,-2.4),(0,.15,-2.4),(0,.55,2.3),(0,-.25,2.3)]
    fr=[bm.verts.new((x+.05,y,z)) for x,y,z in pts];bk=[bm.verts.new((x-.45,y,z)) for x,y,z in pts]
    bm.faces.new(fr);bm.faces.new(bk[::-1])
    for i in range(4):j=(i+1)%4;bm.faces.new((fr[i],bk[i],bk[j],fr[j]))
    obj('housing',bm,H,.04,False)
    # LED brow along the top edge
    bm=bmesh.new();a=[(.08,.12,-2.3),(.08,.5,2.2)];w=.06
    v=[bm.verts.new((x,y+dy,z)) for x,y,z in a for dy in(-w,w)]+[bm.verts.new((x-.1,y+dy,z)) for x,y,z in a for dy in(-w,w)]
    for f in[(0,1,3,2),(4,6,7,5),(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6)]:bm.faces.new([v[i] for i in f])
    obj('brow',bm,L,0,False)
    # big projector eye + small one
    for z,r in((1.15,.42),(-.35,.28)):
        y=.06+ (z+2.4)/4.7*.4-.25
        o=cyl(r,.18,.02,40);bmesh.ops.translate(o,verts=o.verts,vec=(0,y,z));obj('eye%d'%int(r*100),o,L,.01)
        t=torus(r+.03,.04,.1,40,8);bmesh.ops.translate(t,verts=t.verts,vec=(0,y,z));obj('ring%d'%int(r*100),t,C)
    # clear lens
    export('headlight_slim')

# ---------------- REAR: diffuser with fins + quad exhaust (game units, faces -X) ----------------
def rear():
    reset();D=mat('Diffuser',(.03,.03,.035),.4,.55);C=mat('Chrome',(.92,.92,.94),1,.12);I=mat('Inner',(.01,.01,.01),0,.9);R=mat('Reflector',(.8,.05,.05),0,.3,(.6,0,0))
    bm=bmesh.new();
    def box(x0,x1,y0,y1,z0,z1,b=None):
        b=b or bm;v=[b.verts.new((x,y,z)) for x in(x0,x1) for y in(y0,y1) for z in(z0,z1)]
        for f in[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]:b.faces.new([v[i] for i in f])
    box(-.6,1.6,0,.25,-7.5,7.5)                 # floor plate
    for z in(-5.6,-2.8,0,2.8,5.6):box(-.55,1.5,.25,1.6,z-.09,z+.09)  # fins
    box(-.65,-.45,.25,1.9,-7.5,7.5)            # rear lip
    obj('diffuser',bm,D,.03,False)
    for z in(-5.2,-4.0,4.0,5.2):
        t=cyl(.42,1.2,-.4,32,cap=False);bmesh.ops.translate(t,verts=t.verts,vec=(0,1.05,z));obj('tip',t,C,.02)
        i=cyl(.36,.05,-.95,24);bmesh.ops.translate(i,verts=i.verts,vec=(0,1.05,z));obj('in',i,I)
    rb=bmesh.new();box(-.7,-.62,1.7,1.85,-6.8,-2.2,rb);box(-.7,-.62,1.7,1.85,2.2,6.8,rb);obj('refl',rb,R,0,False)
    export('rear_diffuser')

for s in('five','multi','mesh','deep','turbine'):rim(s)
slim_headlight();rear()
print('ok',sorted(os.listdir(OUT)))

# ---------------- ALMOND "EYE" HEADLIGHT (game units, faces +X, inner end at z=0, outer at z=+4.6) ----------------
def eye_headlight():
    reset();H=mat('Housing',(.015,.015,.02),.9,.12);L=mat('Light',(1,1,1),0,.3,(1,.97,.92));C=mat('Chrome',(.92,.92,.95),1,.06);B=mat('Amber',(1,.5,.05),0,.3,(1,.45,0))
    import mathutils
    def almond(n=40,sx=2.3,sy=.62,lift=.55):
        pts=[]
        for i in range(n):
            t=i/n*2*math.pi;x=math.cos(t);y=math.sin(t)*(1 if math.sin(t)>0 else .55)
            z=(x+1)/2*sx*2;yy=y*sy*(.65+.35*(x+1)/2)+lift*(x+1)/2
            pts.append((z,yy))
        return pts
    def slab(pts,x0,x1,m,name,shrink=1.0,dy=0):
        bm=bmesh.new();cz=sum(p[0] for p in pts)/len(pts);cy=sum(p[1] for p in pts)/len(pts)
        P=[(cz+(z-cz)*shrink,cy+(y-cy)*shrink+dy) for z,y in pts]
        f=[bm.verts.new((x1,y,z)) for z,y in P];b=[bm.verts.new((x0,y,z)) for z,y in P]
        bm.faces.new(f);bm.faces.new(b[::-1])
        for i in range(len(P)):j=(i+1)%len(P);bm.faces.new((f[i],b[i],b[j],f[j]))
        return obj(name,bm,m,0,True)
    A=almond();slab(A,-.6,.02,H,'housing')
    slab(A,.02,.06,C,'bezel',.9)
    slab(A,.05,.09,H,'inner',.82)
    # projector eye at outer end, small one inner
    for z,y,r in((3.2,.55,.42),(1.55,.32,.3)):
        o=cyl(r,.16,.12,36);bmesh.ops.translate(o,verts=o.verts,vec=(0,y,z));obj('eye',o,L,.01)
        t=torus(r+.03,.035,.18,36,8);bmesh.ops.translate(t,verts=t.verts,vec=(0,y,z));obj('ring',t,C)
    # LED DRL hook along the lower lid
    bm=bmesh.new();seg=[(0.35,-.05),(1.2,-.22),(2.4,-.18),(3.6,.05),(4.4,.42)]
    for (z0,y0),(z1,y1) in zip(seg,seg[1:]):
        v=[bm.verts.new((x,y+dy,z)) for z,y in((z0,y0),(z1,y1)) for x in(.1,.16) for dy in(-.05,.05)]
        for f in[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]:bm.faces.new([v[i] for i in f])
    obj('drl',bm,L,0,False)
    o=cyl(.12,.1,.12,16);bmesh.ops.translate(o,verts=o.verts,vec=(0,.05,4.25));obj('blink',o,B)
    export('headlight_eye')
eye_headlight()

# ---------------- HONEYCOMB INTAKE GRILLE (faces +X, width along Z = 1, height Y = 1) ----------------
def intake():
    reset();F=mat('Frame',(.05,.05,.055),.6,.35);M=mat('Mesh',(.12,.12,.13),.8,.3);D=mat('Back',(.005,.005,.005),0,.9)
    bm=bmesh.new();r=.045;h=r*math.sqrt(3)
    row=0;y=-.5+h/2
    while y<.5-h/2:
        z=-.5+r+(r*1.5 if row%2 else 0)
        while z<.5-r:
            c=bmesh.ops.create_circle(bm,cap_ends=False,segments=6,radius=r*.92)['verts']
            for v in c:v.co=(.0,v.co.y+y,v.co.x+z)
            inner=[bm.verts.new((.0,y+(v.co.y-y)*.72,z+(v.co.z-z)*.72)) for v in c]
            back=[bm.verts.new((-.06,y+(v.co.y-y)*.72,z+(v.co.z-z)*.72)) for v in c]
            for i in range(6):j=(i+1)%6;bm.faces.new((c[i],c[j],inner[j],inner[i]));bm.faces.new((inner[i],inner[j],back[j],back[i]))
            z+=r*3
        y+=h/2;row+=1
    obj('cells',bm,M,0,False)
    b=bmesh.new();v=[b.verts.new((-.08,y,z)) for y in(-.5,.5) for z in(-.5,.5)];b.faces.new((v[0],v[1],v[3],v[2]));obj('back',b,D,0,False)
    fr=bmesh.new()
    for (y0,y1,z0,z1) in((-.53,-.47,-.53,.53),(.47,.53,-.53,.53),(-.53,.53,-.53,-.47),(-.53,.53,.47,.53)):
        vv=[fr.verts.new((x,y,z)) for x in(-.08,.04) for y in(y0,y1) for z in(z0,z1)]
        for f in[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]:fr.faces.new([vv[i] for i in f])
    obj('frame',fr,F,0,False)
    export('intake_honeycomb')
intake()
