# Build the game city from OpenStreetMap tiles (design/osm/tiles/*.xml) -> public/map/usti.js
# Scale: real world compressed 2x; 1 game tile (T=48 units) = 9.6 m real.
import glob,json,math,base64,zlib,random,xml.etree.ElementTree as ET
from PIL import Image,ImageDraw
LA0,LA1,LO0,LO1=50.62,50.80,13.98,14.24;MY=111320;MX=111320*math.cos(math.radians(50.66));TM=9.6
W=int((LO1-LO0)*MX/TM);H=int((LA1-LA0)*MY/TM)
def P(lat,lon):return((lon-LO0)*MX/TM,(LA1-lat)*MY/TM)  # tile coords (float)
nodes={};ways={};rels={};places={}
for f in sorted(glob.glob('design/osm/tiles/*.xml')):
    for ev,el in ET.iterparse(f):
        t=el.tag
        if t=='node':
            nodes[el.get('id')]=(float(el.get('lat')),float(el.get('lon')))
            tg={x.get('k'):x.get('v') for x in el.findall('tag')}
            if tg.get('place') in('suburb','quarter','neighbourhood','village','town','hamlet') and tg.get('name'):places[tg['name']]=(tg['place'],nodes[el.get('id')])
            el.clear()
        elif t=='way':
            ways[el.get('id')]=([n.get('ref') for n in el.findall('nd')],{x.get('k'):x.get('v') for x in el.findall('tag')});el.clear()
        elif t=='relation':
            rels[el.get('id')]=([(m.get('type'),m.get('ref'),m.get('role')) for m in el.findall('member')],{x.get('k'):x.get('v') for x in el.findall('tag')});el.clear()
G=lambda nd:[P(*nodes[n]) for n in nd if n in nodes]
ROADW={'motorway':3,'trunk':3,'primary':2,'secondary':2,'tertiary':2,'motorway_link':1,'trunk_link':1,'primary_link':1,'secondary_link':1,'tertiary_link':1,'unclassified':1,'residential':1,'living_street':1}
paths=[];roads=[];water=[];forest=[];park=[];ind=[];peds=[];bldg=[];rail=[]
for wid,(nd,tg) in ways.items():
    h=tg.get('highway')
    if h in ROADW and tg.get('tunnel')!='yes' and tg.get('access')!='private':roads.append((wid,nd,ROADW[h],h,tg.get('name',''),tg.get('bridge')=='yes',tg.get('oneway')=='yes'))
    elif h in('pedestrian','footway') and tg.get('area')=='yes':peds.append(G(nd))
    elif h in('footway','path','pedestrian','steps','service','track','cycleway'):paths.append(G(nd))
    elif tg.get('building'):
        try:lv=float(tg.get('building:levels','0') or 0)
        except:lv=0
        bldg.append((G(nd),lv,tg.get('building'),tg.get('name','')))
    elif tg.get('natural')=='water' or tg.get('waterway')=='riverbank':water.append(G(nd))
    elif tg.get('landuse')=='forest' or tg.get('natural') in('wood','scrub'):forest.append(G(nd))
    elif tg.get('landuse') in('grass','meadow','recreation_ground','cemetery','allotments','village_green') or tg.get('leisure') in('park','garden','pitch','playground') or tg.get('natural')=='grassland':park.append(G(nd))
    elif tg.get('landuse') in('industrial','railway','commercial','retail') or tg.get('amenity')=='parking':ind.append(G(nd))
    elif tg.get('railway')=='rail':rail.append(G(nd))
for rid,(mem,tg) in rels.items():
    if tg.get('natural')=='water' or tg.get('water')=='river' or tg.get('waterway')=='riverbank':
        for ty,ref,role in mem:
            if ty=='way' and ref in ways and role=='outer':water.append(G(ways[ref][0]))
# ---- rasterise (4x supersampling for areas) ----
ROAD,WALK,BUILD,GRASS,WATER,BRIDGE,PLAZA,LOT,FOREST,ROCK=0,1,2,3,4,5,6,7,8,9
SS=4
def mask(polys,closed=True,width=0):
    im=Image.new('L',(W*SS,H*SS),0);d=ImageDraw.Draw(im)
    for p in polys:
        if len(p)<2:continue
        q=[(x*SS,y*SS) for x,y in p]
        if closed and len(q)>2:d.polygon(q,fill=255)
        else:d.line(q,fill=255,width=max(1,int(width*SS)),joint='curve')
    return im.resize((W,H),Image.BOX)
import numpy as np
def A(im,th=110):return np.asarray(im)>th
tiles=np.full((H,W),FOREST,np.uint8)
cov=np.zeros((H,W),bool)
for f in glob.glob('design/osm/tiles/*.xml'):
    la,lo=map(float,f.split('/')[-1][2:-4].split('_'));x0,y1=P(la,lo);x1,y0=P(la+.02,lo+.02);cov[max(0,int(y0)):min(H,int(y1)+1),max(0,int(x0)):min(W,int(x1)+1)]=True
tiles[cov]=GRASS
tiles[A(mask(forest))]=FOREST
tiles[A(mask(park))]=GRASS
tiles[A(mask(ind))]=LOT
wat=A(mask(water),100);tiles[wat]=WATER
tiles[A(mask(peds))]=PLAZA
pm=A(mask(paths,closed=False,width=1.1),70)
# buildings: per building tile set -> rectangles
bmask=np.zeros((H,W),np.int32)
for i,(g,lv,bt,nm) in enumerate(bldg):
    if len(g)<3:continue
    im=Image.new('L',(W,H),0);
    xs=[x for x,y in g];ys=[y for x,y in g];x0,x1,y0,y1=int(min(xs))-1,int(max(xs))+2,int(min(ys))-1,int(max(ys))+2
    if x1<0 or y1<0 or x0>=W or y0>=H:continue
    x0=max(0,x0);y0=max(0,y0);x1=min(W,x1);y1=min(H,y1)
    sm=Image.new('L',((x1-x0)*SS,(y1-y0)*SS),0);ImageDraw.Draw(sm).polygon([((x-x0)*SS,(y-y0)*SS) for x,y in g],fill=255)
    a=np.asarray(sm.resize((x1-x0,y1-y0),Image.BOX))>90
    if not a.any():
        cx,cy=int(sum(xs)/len(xs)),int(sum(ys)/len(ys))
        if 0<=cx<W and 0<=cy<H and (max(xs)-min(xs))*(max(ys)-min(ys))>.35:bmask[cy,cx]=i+1
        continue
    sub=bmask[y0:y1,x0:x1];sub[a&(sub==0)]=i+1
# roads (drawn over everything); sidewalks = road buffer
rmask=np.zeros((H,W),bool);wmask=np.zeros((H,W),bool);bridge=np.zeros((H,W),bool)
rim=Image.new('L',(W*SS,H*SS),0);wim=Image.new('L',(W*SS,H*SS),0);bim=Image.new('L',(W*SS,H*SS),0)
dr,dw,db=ImageDraw.Draw(rim),ImageDraw.Draw(wim),ImageDraw.Draw(bim)
for wid,nd,wd,h,nm,br,ow in roads:
    q=[(x*SS,y*SS) for x,y in G(nd)]
    if len(q)<2:continue
    dr.line(q,fill=255,width=int(wd*SS*.95),joint='curve');dw.line(q,fill=255,width=int((wd+1.6)*SS),joint='curve')
    if br:db.line(q,fill=255,width=int(wd*SS),joint='curve')
rmask=np.asarray(rim.resize((W,H),Image.BOX))>70;wmask=np.asarray(wim.resize((W,H),Image.BOX))>60;bridge=np.asarray(bim.resize((W,H),Image.BOX))>60
side=wmask&~rmask
tiles[(bmask>0)]=BUILD
tiles[side&~wat]=WALK;tiles[side&wat]=WALK
tiles[pm&~wat&(tiles!=FOREST)]=WALK
tiles[rmask]=ROAD
tiles[rmask&(wat|bridge)]=BRIDGE
bmask[side|rmask|(pm&(tiles==WALK))]=0
# building rectangles (greedy max rectangles inside each building's tile set)
rects=[];visited=np.zeros((H,W),bool);rnd=random.Random(7)
bt_of={i+1:bldg[i] for i in range(len(bldg))}
ys,xs=np.nonzero(bmask)
order=np.lexsort((xs,ys))
for k in order:
    y,x=ys[k],xs[k]
    if visited[y,x]:continue
    bid=bmask[y,x];w=0
    while x+w<W and bmask[y,x+w]==bid and not visited[y,x+w]:w+=1
    h=1
    while y+h<H and all(bmask[y+h,x+j]==bid and not visited[y+h,x+j] for j in range(w)):h+=1
    visited[y:y+h,x:x+w]=True
    g,lv,btype,nm=bt_of[bid]
    if lv<=0:lv={'apartments':6,'residential':4,'house':2,'detached':2,'garage':1,'garages':1,'industrial':2,'warehouse':2,'commercial':4,'retail':2,'church':4,'school':3,'office':5,'hospital':5,'train_station':3}.get(btype,3)
    rects.append([int(x),int(y),int(w),int(h),round(float(lv),1),btype[:12]])
# districts
pl=[[n,t,round(P(*c)[0],1),round(P(*c)[1],1)] for n,(t,c) in places.items() if 0<=P(*c)[0]<W and 0<=P(*c)[1]<H]
# road graph for traffic: nodes = OSM nodes used by >=2 drivable ways or ends
cnt={}
for wid,nd,wd,h,nm,br,ow in roads:
    for n in nd:cnt[n]=cnt.get(n,0)+1
edges=[];names=[]
for wid,nd,wd,h,nm,br,ow in roads:
    if wd<1:continue
    seg=[nd[0]]
    for n in nd[1:]:
        seg.append(n)
        if cnt.get(n,0)>1 or n==nd[-1]:
            pts=[P(*nodes[m]) for m in seg if m in nodes]
            if len(pts)>=2:edges.append([seg[0],seg[-1],[[round(x,2),round(y,2)] for x,y in pts],wd,1 if ow else 0])
            seg=[n]
# label points for street names (long named roads)
lab=[]
for wid,nd,wd,h,nm,br,ow in roads:
    if not nm:continue
    g=G(nd)
    if len(g)<2:continue
    L=sum(math.dist(g[i],g[i+1]) for i in range(len(g)-1))
    if L<10:continue
    acc=0;tgt=L/2
    for i in range(len(g)-1):
        s=math.dist(g[i],g[i+1])
        if acc+s>=tgt:
            t=(tgt-acc)/s;x=g[i][0]+(g[i+1][0]-g[i][0])*t;y=g[i][1]+(g[i+1][1]-g[i][1])*t
            lab.append([nm.upper(),round(x,1),round(y,1),round(math.atan2(g[i+1][1]-g[i][1],g[i+1][0]-g[i][0]),2),1 if br else 0]);break
        acc+=s
# compact node ids
nid={};
for e in edges:
    for k in(0,1):e[k]=nid.setdefault(e[k],len(nid))
flat=tiles.ravel();rle=bytearray();i=0;n=len(flat)
while i<n:
    v=flat[i];j=i
    while j<n and flat[j]==v and j-i<255:j+=1
    rle+=bytes([int(v),j-i]);i=j
out={'W':W,'H':H,'tiles':base64.b64encode(bytes(rle)).decode(),'rects':rects,'places':pl,'edges':edges,'labels':lab,'ll':[LA0,LA1,LO0,LO1,TM]}
import os;os.makedirs('public/map',exist_ok=True)
open('public/map/usti.js','w').write('window.USTI='+json.dumps(out,separators=(',',':'))+';')
print('tiles',W,H,'rects',len(rects),'edges',len(edges),'labels',len(lab),'places',len(pl),'size',os.path.getsize('public/map/usti.js'))
u,c=np.unique(tiles,return_counts=True);print(dict(zip(u.tolist(),c.tolist())))
pal=np.array([[70,70,76],[170,168,160],[150,120,100],[150,200,130],[110,170,220],[130,130,140],[200,190,170],[160,150,150],[60,110,60],[120,110,100]],np.uint8)
Image.fromarray(pal[tiles]).save('/tmp/claude-0/-home-user/ebaa5676-a9c3-5878-9986-7661b0bb7735/scratchpad/tilemap.png')
