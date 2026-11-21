'use strict';
/* =========================================================
   R3 — 3D renderer (three.js) for ÚSTÍ: Město andělů
   Game logic stays in index.html (2D world coords in px).
   World (x, y) -> three (x, height, y). Heading a -> rotation.y = -a.
   ========================================================= */
const R3={ok:false,off:/[?&]2d/.test(location.search),chunks:new Map(),CH:16,PX:20,HK:620,camMode:'top',
 cars:new Map(),peds:new Map(),markers:[],tmp:null,lastT:0,
 init(){
  if(this.off||!window.THREE)return;const T3=THREE;
  try{
   const cv=document.getElementById('c3');
   const r=this.renderer=new T3.WebGLRenderer({canvas:cv,antialias:!isTouch,powerPreference:'high-performance'});
   r.useLegacyLights=true;r.outputColorSpace=T3.SRGBColorSpace;r.setPixelRatio(Math.min(window.devicePixelRatio||1,isTouch?1.5:2));r.setSize(VW,VH,false);
  }catch(e){console.warn('WebGL off',e);return}
  const S=this.scene=new T3.Scene();S.background=new T3.Color(0x06070f);S.fog=new T3.FogExp2(0x0a0c1a,.00045);
  this.cam=new T3.PerspectiveCamera(50,VW/VH,8,5200);
  this.hemi=new T3.HemisphereLight(0x7f90d0,0x141626,.55);S.add(this.hemi);
  const moon=new T3.DirectionalLight(0x9fb0ff,.35);moon.position.set(-400,900,-300);S.add(moon);
  // player headlights
  this.head=new T3.SpotLight(0xfff1c8,2.4,620,.5,.55,1.2);S.add(this.head);S.add(this.head.target);
  // nearest street lamps (fixed count to avoid shader recompiles)
  this.lampL=[];for(let i=0;i<(isTouch?4:6);i++){const l=new T3.PointLight(0xffa850,1.5,300,1.6);l.position.set(-9999,40,-9999);S.add(l);this.lampL.push(l)}
  this.polL=[new T3.PointLight(0xff2a3a,0,260,1.5),new T3.PointLight(0x2a5aff,0,260,1.5)];for(const l of this.polL)S.add(l);
  // shared materials & textures
  this.mkTex();
  this.wallMat=new T3.MeshLambertMaterial({map:this.winTex,emissiveMap:this.winEm,emissive:0xffffff,emissiveIntensity:1,vertexColors:true});
  this.roofMats={};for(const k of['roof_tar','roof_tiles','roof_metal','plain'])this.roofMats[k]=new T3.MeshLambertMaterial({vertexColors:true,map:this.imgTex(k)});
  this.groundGeo=new T3.PlaneGeometry(this.CH*T,this.CH*T);
  this.carBox=new T3.BoxGeometry(1,1,1);
  this.glass=new T3.MeshLambertMaterial({color:0x1a2a3a,emissive:0x05080c});
  this.hlMat=new T3.MeshBasicMaterial({color:0xfff6cc});this.tlMat=new T3.MeshBasicMaterial({color:0xff1a28});
  this.redMat=new T3.MeshBasicMaterial({color:0xff2a3a});this.bluMat=new T3.MeshBasicMaterial({color:0x2a6aff});this.offMat=new T3.MeshBasicMaterial({color:0x221418});
  this.beamMat=new T3.MeshBasicMaterial({map:this.beamTex(),transparent:true,blending:T3.AdditiveBlending,depthWrite:false,opacity:.5});
  this.beamGeo=new T3.PlaneGeometry(260,170);this.beamGeo.rotateX(-Math.PI/2);this.beamGeo.translate(130,0,0);
  this.skin=[0xe8b896,0xd79c74,0xc08060,0xf0c8a8].map(c=>new T3.MeshLambertMaterial({color:c}));
  this.pedBody=new T3.CylinderGeometry(4,4.5,13,6);this.pedHead=new T3.SphereGeometry(3.6,8,6);
  this.staticObjs();
  // dynamic buffers
  this.mkParticles();this.mkSkids();this.mkArrow();
  this.ok=true;document.body.classList.add('r3on');
 },
 resize(){if(!this.ok)return;this.renderer.setSize(VW,VH,false);this.cam.aspect=VW/VH;this.cam.updateProjectionMatrix()},
 imgTex(k){const T3=THREE;const im=window.TEXIMG&&TEXIMG[k];const t=new T3.Texture();t.wrapS=t.wrapT=T3.RepeatWrapping;t.colorSpace=T3.SRGBColorSpace;
  if(im&&im.complete){t.image=im;t.needsUpdate=true}else if(k!=='plain'){const i2=new Image();i2.onload=()=>{t.image=i2;t.needsUpdate=true};i2.src='art/tex/'+k+'.jpg'}else{const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');g.fillStyle='#bbb';g.fillRect(0,0,8,8);t.image=c;t.needsUpdate=true}return t},
 mkTex(){const T3=THREE,N=8,B=64,cv=document.createElement('canvas'),em=document.createElement('canvas');cv.width=cv.height=em.width=em.height=N*B;const g=cv.getContext('2d'),e=em.getContext('2d');
  g.fillStyle='#c9c6be';g.fillRect(0,0,N*B,N*B);e.fillStyle='#000';e.fillRect(0,0,N*B,N*B);const r=rng(77);
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){const x=i*B,y=j*B;g.fillStyle='rgba(0,0,0,.08)';g.fillRect(x,y+B-4,B,4);
   for(const wx of[10,36]){g.fillStyle='#22303d';g.fillRect(x+wx,y+14,18,30);g.fillStyle='rgba(255,255,255,.18)';g.fillRect(x+wx,y+14,18,3);
    if(r()<.32){const c=r()<.8?'#ffcf7a':'#9fd8ff';e.fillStyle=c;e.fillRect(x+wx,y+14,18,30);g.fillStyle=c;g.fillRect(x+wx,y+14,18,30)}}}
  this.winTex=new T3.CanvasTexture(cv);this.winEm=new T3.CanvasTexture(em);for(const t of[this.winTex,this.winEm]){t.wrapS=t.wrapT=T3.RepeatWrapping;t.colorSpace=T3.SRGBColorSpace}},
 beamTex(){const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(0,64,0,0,64,256);gr.addColorStop(0,'rgba(255,240,200,.95)');gr.addColorStop(1,'rgba(255,240,200,0)');g.fillStyle=gr;g.beginPath();g.moveTo(0,58);g.lineTo(256,0);g.lineTo(256,128);g.lineTo(0,70);g.fill();const t=new THREE.CanvasTexture(c);return t},
 glowTex(col){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)},
 staticObjs(){const T3=THREE,S=this.scene,M=new T3.Matrix4(),Q=new T3.Quaternion(),V=new T3.Vector3(),SC=new T3.Vector3(),C=new T3.Color();
  // lamps: pole + bulb + ground pool of light
  const n=lamps.length;const pole=new T3.InstancedMesh(new T3.CylinderGeometry(1.4,1.8,46,5),new T3.MeshLambertMaterial({color:0x3a3a42}),n);
  const bulb=new T3.InstancedMesh(new T3.SphereGeometry(4.5,8,6),new T3.MeshBasicMaterial({color:0xffd9a0}),n);
  const pg=new T3.PlaneGeometry(1,1);pg.rotateX(-Math.PI/2);const pool=new T3.InstancedMesh(pg,new T3.MeshBasicMaterial({map:this.glowTex('rgba(255,170,80,.55)'),transparent:true,blending:T3.AdditiveBlending,depthWrite:false}),n);
  for(let i=0;i<n;i++){const l=lamps[i];M.makeTranslation(l.x,23,l.y);pole.setMatrixAt(i,M);M.makeTranslation(l.x,47,l.y);bulb.setMatrixAt(i,M);M.compose(V.set(l.x,1.2,l.y),Q.identity(),SC.set(230,1,230));pool.setMatrixAt(i,M)}
  S.add(pole,bulb,pool);
  // trees
  const tg=new T3.IcosahedronGeometry(1,1);const tm=new T3.InstancedMesh(tg,new T3.MeshLambertMaterial({color:0xffffff}),trees.length);
  trees.forEach((t,i)=>{M.compose(V.set(t.x,t.r*1.3,t.y),Q.identity(),SC.set(t.r,t.r*1.25,t.r));tm.setMatrixAt(i,M);tm.setColorAt(i,C.set(t.c))});S.add(tm);
  // parked cars
  const pb=new T3.InstancedMesh(this.carBox,new T3.MeshLambertMaterial({color:0xffffff}),parked.length),pc=new T3.InstancedMesh(this.carBox,this.glass,parked.length);
  parked.forEach((p,i)=>{Q.setFromAxisAngle(V.set(0,1,0),-p.a);M.compose(V.set(p.x,7,p.y),Q,SC.set(p.L,12,p.Wd));pb.setMatrixAt(i,M);pb.setColorAt(i,C.set(p.col));M.compose(V.set(p.x,15,p.y),Q,SC.set(p.L*.5,8,p.Wd*.84));pc.setMatrixAt(i,M)});S.add(pb,pc);
  // Děčín barriers
  const bm=new T3.InstancedMesh(this.carBox,new T3.MeshLambertMaterial({color:0xe0201a,emissive:0x400000}),barriers.length);barriers.forEach((b,i)=>{M.compose(V.set(b.x+T/2,10,b.y+24),Q.identity(),SC.set(T,8,6));bm.setMatrixAt(i,M)});S.add(bm);
  // Mariánský most cables (from pylon top to deck)
  const py=buildings.find(b=>b.pylon);if(py){const top=[py.x+py.w/2,Math.min(py.ht*this.HK,560),py.y+py.h/2],pts=[];for(let k=0;k<12;k++){pts.push(top[0],top[1],top[2],43*T+k*T*.45,8,8*25*T+T*(k%2?1.6:.4))}
   const lg=new T3.BufferGeometry();lg.setAttribute('position',new T3.Float32BufferAttribute(pts,3));S.add(new T3.LineSegments(lg,new T3.LineBasicMaterial({color:0xff7ad9})))}},
 // ---------- ground + buildings per chunk ----------
 chunkKey(cx,cy){return cx+','+cy},
 makeChunk(cx,cy){const T3=THREE,CH=this.CH,PX=this.PX,S=CH*T,cv=document.createElement('canvas');cv.width=cv.height=CH*PX;const g=cv.getContext('2d'),k=PX/T;
  g.setTransform(k,0,0,k,-cx*S*k,-cy*S*k);const x0=cx*S,y0=cy*S,x1=x0+S-1,y1=y0+S-1;
  drawGround(g,x0,y0,x1,y1,0,true);
  for(const a of awn)if(a.x>x0-100&&a.x<x1&&a.y>y0-20&&a.y<y1){const n=Math.max(2,a.w/10|0);for(let q=0;q<n;q++){g.fillStyle=q%2?'#efe9dc':a.c;g.fillRect(a.x+q*a.w/n,a.y,a.w/n+.5,12)}}
  {const fx=(8*3+5)*T,fy=(8*24+5)*T;if(fx>x0-60&&fx<x1+60&&fy>y0-60&&fy<y1+60){g.fillStyle='#6d665e';g.beginPath();g.arc(fx,fy,34,0,7);g.fill();g.fillStyle='#1c4a60';g.beginPath();g.arc(fx,fy,27,0,7);g.fill()}}
  g.textAlign='center';g.textBaseline='middle';g.font='700 13px Oswald, sans-serif';g.fillStyle='rgba(240,240,230,.55)';
  for(const st of STREETS){if(st.v!==undefined){const x=IX(st.v);if(x<x0-40||x>x1+40)continue;for(let j=st.a;j<st.b;j++){const y=(8*j+5)*T;if(y<y0||y>y1)continue;g.save();g.translate(x,y);g.rotate(-Math.PI/2);g.fillText(st.n,0,0);g.restore()}}
   else{const y=IX(st.h);if(y<y0-40||y>y1+40)continue;for(let i=st.a;i<st.b;i++){const x=(8*i+5)*T;if(x<x0||x>x1)continue;g.fillText(st.n,x,y)}}}
  for(const j in BRIDGES){const y=IX(+j),x=(8*RIVER+5)*T;if(y>y0-40&&y<y1+40&&x>x0-200&&x<x1+200)g.fillText(BRIDGES[j].toUpperCase(),x,y)}
  const tex=new T3.CanvasTexture(cv);tex.colorSpace=T3.SRGBColorSpace;tex.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());
  const grp=new T3.Group();const gm=new T3.Mesh(this.groundGeo,new T3.MeshLambertMaterial({map:tex}));gm.rotation.x=-Math.PI/2;gm.position.set(x0+S/2,0,y0+S/2);grp.add(gm);
  // buildings whose centre lies in this chunk
  const W={pos:[],nor:[],uv:[],col:[]},RF={};const rk=b=>b.panel?'roof_tar':b.factory?'roof_metal':(b.castle||b.church)?'roof_tiles':(b.chimney||b.pylon||b.tower)?'plain':b.shop?'roof_metal':(((b.x*7+b.y*13)/T|0)%3===0?'roof_tiles':'roof_tar');
  const C=new T3.Color();
  for(const b of buildings){const mx=b.x+b.w/2,my=b.y+b.h/2;if(mx<x0||mx>x1||my<y0||my>y1)continue;
   const H=Math.min(b.ht*this.HK,b.pylon?560:900),X0=b.x,X1=b.x+b.w,Z0=b.y,Z1=b.y+b.h;C.set(b.col);const wc=C.clone().lerp(new T3.Color(0xbdb8ae),.35);
   const quad=(o,a,bq,c,d,n,uv)=>{o.pos.push(...a,...bq,...c,...a,...c,...d);for(let q=0;q<6;q++)o.nor.push(...n);o.uv.push(uv[0],uv[1],uv[2],uv[3],uv[4],uv[5],uv[0],uv[1],uv[4],uv[5],uv[6],uv[7])};
   const wall=(ax,az,bx,bz,n)=>{const L=Math.hypot(bx-ax,bz-az),u0=(ax+az)/384,u1=u0+L/384,v1=H/256;quad(W,[ax,0,az],[bx,0,bz],[bx,H,bz],[ax,H,az],n,[u0,0,u1,0,u1,v1,u0,v1]);for(let q=0;q<6;q++)W.col.push(wc.r,wc.g,wc.b)};
   wall(X0,Z1,X1,Z1,[0,0,1]);wall(X1,Z1,X1,Z0,[1,0,0]);wall(X1,Z0,X0,Z0,[0,0,-1]);wall(X0,Z0,X0,Z1,[-1,0,0]);
   const key=rk(b),o=RF[key]||(RF[key]={pos:[],nor:[],uv:[],col:[]}),sc=key==='plain'?1:1/192;
   quad(o,[X0,H,Z1],[X1,H,Z1],[X1,H,Z0],[X0,H,Z0],[0,1,0],[X0*sc,Z1*sc,X1*sc,Z1*sc,X1*sc,Z0*sc,X0*sc,Z0*sc]);const rc=key==='roof_tiles'?C.clone().lerp(new T3.Color(0xffffff),.5):C;for(let q=0;q<6;q++)o.col.push(rc.r,rc.g,rc.b);
   if(b.chimney){const sm=new T3.Mesh(new T3.CylinderGeometry(b.w*.3,b.w*.3,4,8),new T3.MeshBasicMaterial({color:0x1a1010}));sm.position.set(mx,H+2,my);grp.add(sm)}}
  const mk=(o,mat)=>{if(!o.pos.length)return;const bg=new T3.BufferGeometry();bg.setAttribute('position',new T3.Float32BufferAttribute(o.pos,3));bg.setAttribute('normal',new T3.Float32BufferAttribute(o.nor,3));bg.setAttribute('uv',new T3.Float32BufferAttribute(o.uv,2));bg.setAttribute('color',new T3.Float32BufferAttribute(o.col,3));grp.add(new T3.Mesh(bg,mat))};
  mk(W,this.wallMat);for(const k in RF)mk(RF[k],this.roofMats[k]);
  // neon signs on facades
  for(const sg of signs){if(sg.x<x0||sg.x>x1||sg.y<y0||sg.y>y1+2)continue;const m=this.signMesh(sg);if(m)grp.add(m)}
  this.scene.add(grp);return{grp,tex,gm}},
 signCache:{},
 signMesh(sg){const T3=THREE,key=sg.text+sg.col+(sg.big?1:0);let e=this.signCache[key];
  if(!e){const fs=sg.big?56:34,c=document.createElement('canvas'),g=c.getContext('2d');g.font=(sg.big?'':'700 ')+fs+'px '+(sg.big?'Bangers':'Oswald')+', sans-serif';const w=Math.ceil(g.measureText(sg.text).width)+24;c.width=w;c.height=fs+20;
   g.font=(sg.big?'':'700 ')+fs+'px '+(sg.big?'Bangers':'Oswald')+', sans-serif';g.fillStyle='rgba(10,8,16,.85)';g.fillRect(0,0,w,c.height);g.strokeStyle=sg.col;g.lineWidth=3;g.strokeRect(2,2,w-4,c.height-4);g.fillStyle=sg.col;g.textAlign='center';g.textBaseline='middle';g.shadowColor=sg.col;g.shadowBlur=10;g.fillText(sg.text,w/2,c.height/2+2);
   const t=new T3.CanvasTexture(c);t.colorSpace=T3.SRGBColorSpace;e=this.signCache[key]={mat:new T3.MeshBasicMaterial({map:t,transparent:true,side:T3.DoubleSide}),w:c.width,h:c.height}}
  const sc=(sg.big?.9:.55),m=new T3.Mesh(new T3.PlaneGeometry(e.w*sc,e.h*sc),e.mat);const H=Math.max(14,Math.min((sg.ht||.1)*this.HK*.8,sg.big?120:34));
  m.position.set(sg.x,H+e.h*sc/2,sg.y+(sg.top?-1.5:1.5));if(sg.top)m.rotation.y=Math.PI;return m},
 updChunks(cx,cy,rad){const CH=this.CH,S=CH*T,ncx=Math.ceil(MAPPX/S),ncy=Math.ceil(MAPPY/S);const want=[];
  const c0x=Math.floor(cx/S),c0y=Math.floor(cy/S),r=Math.ceil(rad/S);
  for(let y=c0y-r;y<=c0y+r;y++)for(let x=c0x-r;x<=c0x+r;x++){if(x<0||y<0||x>=ncx||y>=ncy)continue;const d=Math.hypot((x+.5)*S-cx,(y+.5)*S-cy);if(d>rad+S)continue;want.push([d,x,y])}
  want.sort((a,b)=>a[0]-b[0]);let made=0;const keep=new Set();
  for(const[d,x,y]of want){const k=this.chunkKey(x,y);keep.add(k);if(!this.chunks.has(k)&&made<(this.chunks.size<6?12:2)){this.chunks.set(k,this.makeChunk(x,y));made++}}
  for(const[k,c]of this.chunks){if(keep.has(k))continue;const[x,y]=k.split(',').map(Number);if(Math.hypot((x+.5)*S-cx,(y+.5)*S-cy)<rad+S*2.5)continue;
   this.scene.remove(c.grp);c.grp.traverse(o=>{if(o.geometry&&o.geometry!==this.groundGeo)o.geometry.dispose()});c.gm.material.dispose();c.tex.dispose();this.chunks.delete(k)}},
 // ---------- dynamic objects ----------
 carMesh(c){const T3=THREE,g=new T3.Group(),L=c.L,W=c.Wd;
  const body=new T3.Mesh(this.carBox,new T3.MeshLambertMaterial({color:c.col}));body.scale.set(L,12,W);body.position.y=8;g.add(body);
  const cab=new T3.Mesh(this.carBox,this.glass);cab.scale.set(L*.48,8,W*.84);cab.position.set(-L*.05,17.5,0);g.add(cab);
  const roof=new T3.Mesh(this.carBox,body.material);roof.scale.set(L*.36,1.5,W*.8);roof.position.set(-L*.07,22,0);g.add(roof);
  if(c.stripe){const s=new T3.Mesh(this.carBox,new T3.MeshBasicMaterial({color:c.stripe}));s.scale.set(L*1.01,2,4);s.position.y=14.2;g.add(s)}
  for(const sd of[-1,1]){const h=new T3.Mesh(this.carBox,this.hlMat);h.scale.set(1.5,3,4);h.position.set(L/2+.5,9,sd*W*.3);g.add(h);const t=new T3.Mesh(this.carBox,this.tlMat);t.scale.set(1.5,3,4);t.position.set(-L/2-.5,10,sd*W*.3);g.add(t)}
  if(c.st&&c.st.police){body.material.color.set(0xe9ecef);const s=new T3.Mesh(this.carBox,new T3.MeshLambertMaterial({color:0x1e4bd6}));s.scale.set(L*1.01,3,W*1.01);s.position.y=9;g.add(s);
   const lr=new T3.Mesh(this.carBox,this.redMat),lb=new T3.Mesh(this.carBox,this.bluMat);lr.scale.set(4,3,W*.4);lb.scale.set(4,3,W*.4);lr.position.set(-L*.05,24.5,-W*.22);lb.position.set(-L*.05,24.5,W*.22);g.add(lr,lb);g.userData.bar=[lr,lb]}
  if(c.st&&c.st.spoiler){const sp=new T3.Mesh(this.carBox,new T3.MeshLambertMaterial({color:0x111111}));sp.scale.set(3,2,W);sp.position.set(-L/2+1,19,0);g.add(sp)}
  const beam=new T3.Mesh(this.beamGeo,this.beamMat);beam.position.set(L/2,1.6,0);g.add(beam);g.userData.beam=beam;g.userData.body=body;
  this.scene.add(g);return g},
 pedMesh(p){const T3=THREE,g=new T3.Group();const b=new T3.Mesh(this.pedBody,new T3.MeshLambertMaterial({color:p.col}));b.position.y=6.5;g.add(b);
  const h=new T3.Mesh(this.pedHead,new T3.MeshLambertMaterial({color:p.hair}));h.position.y=15.5;g.add(h);g.userData.b=b;this.scene.add(g);return g},
 mkParticles(){const T3=THREE,N=520;const mk=(blend,size)=>{const g=new T3.BufferGeometry();g.setAttribute('position',new T3.BufferAttribute(new Float32Array(N*3),3));g.setAttribute('color',new T3.BufferAttribute(new Float32Array(N*3),3));g.setDrawRange(0,0);
   const m=new T3.PointsMaterial({size,vertexColors:true,transparent:true,depthWrite:false,blending:blend,map:this.glowTex('rgba(255,255,255,1)'),sizeAttenuation:true});const pts=new T3.Points(g,m);pts.frustumCulled=false;this.scene.add(pts);return pts};
  this.hot=mk(T3.AdditiveBlending,26);this.smoke=mk(T3.NormalBlending,48);this.smoke.material.opacity=.55},
 mkSkids(){const T3=THREE,g=new T3.BufferGeometry();g.setAttribute('position',new T3.BufferAttribute(new Float32Array(1300*6),3));g.setDrawRange(0,0);this.skid=new T3.LineSegments(g,new T3.LineBasicMaterial({color:0x050505,transparent:true,opacity:.6}));this.skid.frustumCulled=false;this.scene.add(this.skid)},
 mkArrow(){const T3=THREE,sh=new T3.Shape();sh.moveTo(16,0);sh.lineTo(-8,-11);sh.lineTo(-3,0);sh.lineTo(-8,11);sh.lineTo(16,0);const ge=new T3.ExtrudeGeometry(sh,{depth:3,bevelEnabled:false});ge.rotateX(Math.PI/2);
  this.arrow=new T3.Mesh(ge,new T3.MeshBasicMaterial({color:0xffcc1a}));this.arrow.visible=false;this.scene.add(this.arrow);
  this.ringGeo=new T3.RingGeometry(34,42,32);this.ringGeo.rotateX(-Math.PI/2);this.beamCyl=new T3.CylinderGeometry(30,30,420,16,1,true);this.beamCyl.translate(0,210,0);
  this.mkMat=new T3.MeshBasicMaterial({color:0xffcc1a,transparent:true,opacity:.9,side:T3.DoubleSide});this.mkBeamMat=new T3.MeshBasicMaterial({color:0xffcc1a,transparent:true,opacity:.16,blending:T3.AdditiveBlending,depthWrite:false,side:T3.DoubleSide});
  this.mkGray=new T3.MeshBasicMaterial({color:0x888888,transparent:true,opacity:.7,side:T3.DoubleSide});
  const fc=document.createElement('canvas');fc.width=fc.height=64;const fg=fc.getContext('2d');for(let a=0;a<8;a++)for(let b=0;b<8;b++){fg.fillStyle=(a+b)%2?'#eee':'#111';fg.fillRect(a*8,b*8,8,8)}
  const fp=new T3.PlaneGeometry(96,96);fp.rotateX(-Math.PI/2);this.finish=new T3.Mesh(fp,new T3.MeshBasicMaterial({map:new T3.CanvasTexture(fc)}));this.finish.visible=false;this.scene.add(this.finish);
  this.finBeam=new T3.Mesh(this.beamCyl,this.mkBeamMat);this.finBeam.visible=false;this.scene.add(this.finBeam);
  this.next=new T3.Mesh(this.ringGeo,this.mkMat);this.next.visible=false;this.scene.add(this.next)},
 // ---------- camera ----------
 camFor(w,dt){const C=this.cam,p=w.player,chase=this.camMode==='chase'&&p&&(G.mode==='roam'||G.mode==='race');
  if(chase){const sp=Math.hypot(p.vx,p.vy);let va=sp>40?Math.atan2(p.vy,p.vx):p.a;if(p.v<-5)va=p.a;
   this.ca=this.ca===undefined?p.a:this.ca+wrapA(va-this.ca)*Math.min(1,dt*3.2);const back=150+sp*.18,hh=78+sp*.05,fx=Math.cos(this.ca),fz=Math.sin(this.ca);
   const tx=p.x-fx*back,tz=p.y-fz*back;this.cp=this.cp||{x:tx,y:hh,z:tz};this.cp.x=lerp(this.cp.x,tx,Math.min(1,dt*6));this.cp.z=lerp(this.cp.z,tz,Math.min(1,dt*6));this.cp.y=lerp(this.cp.y,hh,Math.min(1,dt*3));
   C.fov=lerp(C.fov,60+Math.min(14,sp/22)+(p.boost?8:0),Math.min(1,dt*3));C.updateProjectionMatrix();C.position.set(this.cp.x,this.cp.y,this.cp.z);C.lookAt(p.x+fx*90,18,p.y+fz*90);this.focus={x:p.x+fx*500,y:p.y+fz*500,r:1500}}
  else{this.ca=undefined;this.cp=null;const Z=w.zoom||baseZoom(),fov=50;if(C.fov!==fov){C.fov=fov;C.updateProjectionMatrix()}const visH=VH/Z,d=visH/(2*Math.tan(fov*Math.PI/360)),tilt=.42;
   const sx=shakeA?rr(-shakeA,shakeA):0,sy=shakeA?rr(-shakeA,shakeA):0;C.position.set(w.cam.x+sx,d*Math.cos(tilt),w.cam.y+d*Math.sin(tilt)+sy);C.lookAt(w.cam.x+sx,0,w.cam.y+sy);this.focus={x:w.cam.x,y:w.cam.y-visH*.15,r:Math.max(VW,VH)/Z*.85+300}}},
 proj(x,y,h){const v=this.tmp||(this.tmp=new THREE.Vector3());v.set(x,h||0,y).project(this.cam);return[(v.x+1)/2*VW,(1-v.y)/2*VH,v.z<1&&v.z>-1]},
 // ---------- per-frame ----------
 render(w,opts,dt){const T3=THREE,t=w.t;this.camFor(w,dt);this.updChunks(this.focus.x,this.focus.y,this.focus.r);
  this.hemi.intensity=.55+w.flash*1.6;this.scene.fog.density=G.mode==='roam'||G.mode==='race'?(this.camMode==='chase'?.0007:.00035):.0003;
  // cars
  const seen=new Set();for(const c of w.cars){let g=this.cars.get(c);if(!g){g=this.carMesh(c);this.cars.set(c,g)}seen.add(c);g.position.set(c.x,0,c.y);g.rotation.y=-c.a;
   g.userData.body.material.color.set(c.wreck?0x2a2522:(c.st&&c.st.police)?0xe9ecef:c.hitT>0?0xffffff:c.col);g.userData.beam.visible=!c.wreck;
   if(g.userData.bar){const ph=Math.floor(t*8)%2;g.userData.bar[0].material=ph?this.redMat:this.offMat;g.userData.bar[1].material=ph?this.offMat:this.bluMat}}
  for(const[c,g]of this.cars)if(!seen.has(c)){this.scene.remove(g);g.traverse(o=>{if(o.material&&o.material!==this.glass&&!this.shared(o.material))o.material.dispose()});this.cars.delete(c)}
  // peds
  const ps=new Set();for(const p of w.peds){let g=this.peds.get(p);if(!g){g=this.pedMesh(p);this.peds.set(p,g)}ps.add(p);g.position.set(p.x,0,p.y);g.rotation.y=-p.a;
   if(p.down>0){g.rotation.z=Math.PI/2;g.position.y=4}else{g.rotation.z=0;g.position.y=Math.abs(Math.sin(p.walk))*1.5}}
  for(const[p,g]of this.peds)if(!ps.has(p)){this.scene.remove(g);g.traverse(o=>{if(o.material)o.material.dispose()});this.peds.delete(p)}
  // particles
  {const hp=this.hot.geometry.attributes.position.array,hc=this.hot.geometry.attributes.color.array,sp=this.smoke.geometry.attributes.position.array,sc=this.smoke.geometry.attributes.color.array;let nh=0,ns=0;
   for(const q of w.parts){const a=q.life/q.max;if(q.type==='smoke'){if(ns>=520)continue;sp.set([q.x,12+q.z*this.HK+(1-a)*40,q.y],ns*3);const v=q.col?.55:.3;sc.set([v*a+.1,v*a+.1,v*a+.12],ns*3);ns++}
    else{if(nh>=520)continue;hp.set([q.x,q.type==='fire'?10+(1-a)*25:6,q.y],nh*3);if(q.type==='fire')hc.set([1,.45+a*.4,.15],nh*3);else hc.set([1,.85,.45],nh*3);nh++}}
   for(const b of w.bullets){if(nh>=520)break;hp.set([b.x,10,b.y],nh*3);hc.set([1,.95,.6],nh*3);nh++}
   if(w.muzzle>0&&w.player){const p=w.player;hp.set([p.x+Math.cos(p.a)*(p.L*.5+8),14,p.y+Math.sin(p.a)*(p.L*.5+8)],nh*3);hc.set([1,.9,.5],nh*3);nh++}
   this.hot.geometry.setDrawRange(0,nh);this.smoke.geometry.setDrawRange(0,ns);this.hot.geometry.attributes.position.needsUpdate=this.hot.geometry.attributes.color.needsUpdate=true;this.smoke.geometry.attributes.position.needsUpdate=this.smoke.geometry.attributes.color.needsUpdate=true}
  // skids
  {const a=this.skid.geometry.attributes.position.array,n=Math.min(w.skids.length,1300);for(let i=0;i<n;i++){const s=w.skids[w.skids.length-n+i];a.set([s[0],.8,s[1],s[2],.8,s[3]],i*6)}this.skid.geometry.setDrawRange(0,n*2);this.skid.geometry.attributes.position.needsUpdate=true}
  // markers & route
  const ms=opts.markers||[];while(this.markers.length<ms.length){const r=new THREE.Mesh(this.ringGeo,this.mkMat),b=new THREE.Mesh(this.beamCyl,this.mkBeamMat);this.scene.add(r,b);this.markers.push([r,b])}
  this.markers.forEach((m,i)=>{const k=ms[i];m[0].visible=m[1].visible=!!k;if(k){const pu=1+Math.sin(t*4)*.1;m[0].position.set(k.x,2,k.y);m[0].scale.set(pu,1,pu);m[1].position.set(k.x,0,k.y);m[0].material=k.open?this.mkMat:this.mkGray}});
  const rt=opts.arrow&&w.route;this.finish.visible=this.finBeam.visible=this.next.visible=!!rt;
  if(rt){const F=w.route[w.route.length-1];this.finish.position.set(F.x,1.5,F.y);this.finBeam.position.set(F.x,0,F.y);const nx=w.route[Math.min(w.player.seg+1,w.route.length-1)];this.next.visible=nx!==F;this.next.position.set(nx.x,2,nx.y);this.next.scale.setScalar(1.25+Math.sin(t*5)*.08)}
  // 3D guide arrow above car
  const tg=opts.arrowTo||(rt?w.route[Math.min(w.player.seg+1,w.route.length-1)]:null);this.arrow.visible=!!(tg&&w.player);
  if(this.arrow.visible){const p=w.player,a=Math.atan2(tg.y-p.y,tg.x-p.x);this.arrow.position.set(p.x,40+Math.sin(t*4)*2,p.y);this.arrow.rotation.y=-a;const s=this.camMode==='chase'?1:1.5;this.arrow.scale.setScalar(s)}
  // lights
  const p=w.player;if(p&&!p.wreck&&!G.engineOff){const ca=Math.cos(p.a),sa=Math.sin(p.a);this.head.position.set(p.x+ca*p.L*.4,16,p.y+sa*p.L*.4);this.head.target.position.set(p.x+ca*260,0,p.y+sa*260);this.head.intensity=p.boost?3.2:2.4}else this.head.intensity=0;
  const fx=this.focus.x,fy=this.focus.y,cx=p?p.x:w.cam.x,cy=p?p.y:w.cam.y;const near=[];for(const l of lamps){const d=(l.x-cx)*(l.x-cx)+(l.y-cy)*(l.y-cy);if(d<640000)near.push([d,l])}near.sort((a,b)=>a[0]-b[0]);
  this.lampL.forEach((L,i)=>{const n=near[i];if(n){L.position.set(n[1].x,44,n[1].y);L.intensity=1.5}else L.intensity=0});
  let pol=null,pd=1e12;for(const c of w.cars)if(c.st&&c.st.police&&!c.wreck){const d=(c.x-cx)**2+(c.y-cy)**2;if(d<pd){pd=d;pol=c}}
  const ph=Math.floor(t*8)%2;if(pol&&pd<700*700){this.polL[0].position.set(pol.x,30,pol.y);this.polL[1].position.set(pol.x,30,pol.y);this.polL[0].intensity=ph?2.2:0;this.polL[1].intensity=ph?0:2.6}else{this.polL[0].intensity=this.polL[1].intensity=0}
  this.renderer.render(this.scene,this.cam)},
 shared(m){return m===this.hlMat||m===this.tlMat||m===this.redMat||m===this.bluMat||m===this.offMat||m===this.beamMat||this.skin.includes(m)},
 reset(){for(const[c,g]of this.cars){this.scene.remove(g)}this.cars.clear();for(const[p,g]of this.peds)this.scene.remove(g);this.peds.clear()}
};

/* overlay drawn on the 2D canvas over the 3D view */
function overlay3D(c2,w,vw,vh,opts){c2.clearRect(0,0,vw,vh);const t=w.t,P=(x,y,h)=>R3.proj(x,y,h);
  if(opts.labels){const fs=Math.min(48,Math.max(20,26*(w.zoom||1)*2));c2.font=fs+'px Bangers, sans-serif';c2.textAlign='center';c2.textBaseline='middle';c2.lineWidth=fs/7;c2.strokeStyle='rgba(0,0,0,.85)';c2.fillStyle='rgba(255,220,90,.95)';
   for(const d of DLABELS){const q=P(d.x,d.y,60);if(!q[2]||q[0]<-200||q[0]>vw+200||q[1]<-60||q[1]>vh+60)continue;c2.strokeText(d.n,q[0],q[1]);c2.fillText(d.n,q[0],q[1])}}
  const bfs=G.mode==='promo'?19:isTouch?14:13;c2.font='600 '+bfs+'px Oswald, sans-serif';c2.textAlign='center';c2.textBaseline='middle';const placed=[];
  for(const p of w.cars.concat(w.peds)){if(!p.say)continue;const q=P(p.x,p.y,p.L?34:26);if(!q[2])continue;const X=q[0];let Y=q[1]-10;if(X<-80||X>vw+80||Y<-40||Y>vh+40)continue;
   const tw=c2.measureText(p.say).width+14,BX2=clamp(X,tw/2+4,vw-tw/2-4),bh2=bfs+9;for(let k=0;k<4;k++){if(!placed.some(r=>Math.abs(r[0]-BX2)<(r[2]+tw)/2&&Math.abs(r[1]-Y)<bh2+2))break;Y-=bh2+3}placed.push([BX2,Y,tw]);
   c2.fillStyle='rgba(255,255,255,.96)';rrect(c2,BX2-tw/2,Y-bh2/2-1,tw,bh2,8);c2.fill();c2.beginPath();c2.moveTo(X-4,Y+bh2/2-2);c2.lineTo(X,Y+bh2/2+6);c2.lineTo(X+4,Y+bh2/2-2);c2.fill();c2.fillStyle='#111';c2.fillText(p.say,BX2,Y)}
  if(opts.markers){c2.font='700 13px Oswald, sans-serif';for(const m of opts.markers){const q=P(m.x,m.y,90);if(!q[2]||q[0]<-100||q[0]>vw+100||q[1]<-60||q[1]>vh+60)continue;const tx=(m.open?'MISE: ':'')+m.L.name;const tw=c2.measureText(tx).width+16;c2.fillStyle=m.open?'rgba(255,204,26,.95)':'rgba(60,60,70,.9)';rrect(c2,q[0]-tw/2,q[1]-12,tw,24,6);c2.fill();c2.fillStyle=m.open?'#111':'#ddd';c2.fillText(tx,q[0],q[1])}}
  if(opts.arrow&&w.route){const F=w.route[w.route.length-1],q=P(F.x,F.y,110);if(q[2]&&q[0]>-80&&q[0]<vw+80&&q[1]>-40&&q[1]<vh+40){c2.font='bold 24px Bangers, sans-serif';c2.fillStyle='#fff';c2.strokeStyle='#000';c2.lineWidth=4;c2.strokeText('🏁 CÍL',q[0],q[1]);c2.fillText('🏁 CÍL',q[0],q[1])}}
  if(w.rain){c2.strokeStyle='rgba(170,195,230,.3)';c2.lineWidth=1;c2.beginPath();const n=isTouch?110:160;for(let i=0;i<n;i++){const d=rainDrops[i];const y=((d.y+t*1.6*d.s)%1)*(vh+60)-30,x=((d.x+t*.25*d.s)%1)*(vw+60)-30;c2.moveTo(x,y);c2.lineTo(x-5*d.s,y-18*d.s)}c2.stroke()}
  if(w.flash>0){c2.fillStyle=`rgba(200,215,255,${w.flash*.25})`;c2.fillRect(0,0,vw,vh)}
  const vg=c2.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.35,vw/2,vh/2,Math.max(vw,vh)*.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');c2.fillStyle=vg;c2.fillRect(0,0,vw,vh)}
R3.init();
