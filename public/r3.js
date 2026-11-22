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
   r.useLegacyLights=true;r.outputColorSpace=T3.SRGBColorSpace;r.toneMapping=T3.ACESFilmicToneMapping;r.toneMappingExposure=.85;r.setPixelRatio(Math.min(window.devicePixelRatio||1,isTouch?1.5:2));r.setSize(VW,VH,false);
  }catch(e){console.warn('WebGL off',e);return}
  const S=this.scene=new T3.Scene();S.background=new T3.Color(0x1a0b2a);S.fog=new T3.FogExp2(0x2a1238,.00045);
  {const sg=new T3.SphereGeometry(4000,24,16),sm=new T3.ShaderMaterial({side:T3.BackSide,depthWrite:false,fog:false,uniforms:{uStars:{value:null},uSt:{value:0},uTop:{value:new T3.Color(.05,.02,.12)},uMid:{value:new T3.Color(.28,.06,.32)},uHor:{value:new T3.Color(1,.32,.45)},uSun:{value:new T3.Color(1,.62,.3)}},
    vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 uTop,uMid,uHor,uSun;uniform sampler2D uStars;uniform float uSt;varying vec3 vP;void main(){float h=vP.y;vec3 top=uTop,mid=uMid,hor=uHor,sun=uSun;vec3 c=mix(mid,top,smoothstep(.05,.6,h));c=mix(hor,c,smoothstep(-.02,.16,h));c+=sun*.55*exp(-pow((h-.02)*14.,2.));if(uSt>0.){float u=atan(vP.z,vP.x)/6.2832+.5;u=abs(fract(u*2.)-.5)*2.;float v=1.-clamp(h,0.,1.);vec3 st=texture2D(uStars,vec2(u,1.-v*.92)).rgb;st=pow(st,vec3(1.2))*1.1;c=mix(c,st+c*.25,uSt*smoothstep(-.01,.12,h));}gl_FragColor=vec4(c,1.);}'});
   new T3.TextureLoader().load('art/tex/sky_night.jpg',t=>{t.colorSpace=T3.SRGBColorSpace;t.wrapS=T3.MirroredRepeatWrapping;sm.uniforms.uStars.value=t;sm.uniforms.uSt.value=this.tod==='night'||!this.tod?1:0});{const R=3600,seg=8,H=(2*Math.PI*R/seg)/3,ring=this.skyline=new T3.Group();ring.userData.H=H;const L=new T3.TextureLoader();this.slMats=[];
   for(let i=0;i<seg;i++){const g=new T3.CylinderGeometry(R,R,H,24,1,true,i*Math.PI*2/seg,Math.PI*2/seg),m=new T3.MeshBasicMaterial({transparent:true,alphaTest:.04,depthWrite:false,fog:false,side:T3.BackSide,color:0xffffff,visible:false});
    L.load('art/tex/skyline_'+(i%4+1)+'.webp',t=>{t.colorSpace=T3.SRGBColorSpace;if(i>=4){t.wrapS=T3.RepeatWrapping;t.repeat.x=-1}m.map=t;m.visible=true;m.needsUpdate=true});this.slMats.push(m);
    const me=new T3.Mesh(g,m);me.position.y=H/2;me.renderOrder=-.5;ring.add(me)}S.add(ring)}
   this.sky=new T3.Mesh(sg,sm);this.sky.renderOrder=-1;S.add(this.sky)}
  this.cam=new T3.PerspectiveCamera(50,VW/VH,8,5200);
  // neon environment map for glossy reflections
  {const pm=new T3.PMREMGenerator(this.renderer),es=new T3.Scene();es.background=new T3.Color(0x04050a);
   const pan=(r,g,b,x,y,z,w,h)=>{const m=new T3.Mesh(new T3.PlaneGeometry(w,h),new T3.MeshBasicMaterial({side:T3.DoubleSide}));m.material.color.setRGB(r,g,b);m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m)};
   pan(4,.4,2,-6,2,1,4,1.5);pan(.4,3,4,6,1.5,-2,3,1.2);pan(4,2,.6,1,2.5,6,5,1);pan(.5,.6,1,0,9,0,10,10);pan(3,1.4,.4,-2,1,-6,3,.8);pan(.6,.2,2.5,4,3,5,2,1);
   this.env=pm.fromScene(es,.03).texture;S.environment=this.env;pm.dispose()}
  // post-processing: bloom (adaptive)
  this.q=SAVE.gfx||'high';this.setupComposer();
  this.hemi=new T3.HemisphereLight(0x7f90d0,0x141626,.6);S.add(this.hemi);
  const moon=this.sun=new T3.DirectionalLight(0x9fb0ff,.35);moon.position.set(-400,900,-300);S.add(moon);
  // player headlights
  this.head=new T3.SpotLight(0xfff1c8,1.5,560,.5,.6,1.4);S.add(this.head);S.add(this.head.target);
  // nearest street lamps (fixed count to avoid shader recompiles)
  this.lampL=[];for(let i=0;i<(isTouch?4:6);i++){const l=new T3.PointLight(0xffa850,1,260,1.8);l.position.set(-9999,40,-9999);S.add(l);this.lampL.push(l)}
  this.polL=[new T3.PointLight(0xff2a3a,0,260,1.5),new T3.PointLight(0x2a5aff,0,260,1.5)];for(const l of this.polL)S.add(l);
  // shared materials & textures
  this.mkTex();
  this.wallMat=new T3.MeshLambertMaterial({map:this.winTex,emissiveMap:this.winEm,emissive:0xffffff,emissiveIntensity:1.6,vertexColors:true});
  {const TL=new T3.TextureLoader(),ld=f=>{const t=TL.load('art/tex/'+f+'.jpg');t.wrapS=t.wrapT=T3.RepeatWrapping;t.colorSpace=T3.SRGBColorSpace;t.anisotropy=4;return t};this.facMats={};
   this.facBase={value:.22};for(const k of['plaster','brick','panel','shops','modern','industrial','stone','baroque']){const m=this.facMats[k]=new T3.MeshLambertMaterial({map:ld('fac_'+k),emissiveMap:ld('fac_'+k+'_em'),emissive:0xffffff,emissiveIntensity:1.2,vertexColors:true});
    m.onBeforeCompile=sh=>{sh.uniforms.uBase=this.facBase;sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uBase;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*uBase;')};m.customProgramCacheKey=()=>'fac'}
   this.facMats.plain=new T3.MeshLambertMaterial({color:0xffffff,vertexColors:true})}
  this.roofMats={};for(const k of['roof_tar','roof_tiles','roof_metal','plain'])this.roofMats[k]=new T3.MeshLambertMaterial({vertexColors:true,map:this.imgTex(k)});
  this.groundGeo=new T3.PlaneGeometry(this.CH*T,this.CH*T);
  this.carBox=new T3.BoxGeometry(1,1,1);
  this.glass=new T3.MeshLambertMaterial({color:0x1a2a3a,emissive:0x05080c});
  this.hlMat=new T3.MeshBasicMaterial({color:0xfff6cc});this.hlMat.color.multiplyScalar(3);this.tlMat=new T3.MeshBasicMaterial({color:0xff1a28});this.tlMat.color.multiplyScalar(3.2);
  this.redMat=new T3.MeshBasicMaterial({color:0xff2a3a});this.redMat.color.multiplyScalar(3);this.bluMat=new T3.MeshBasicMaterial({color:0x2a6aff});this.bluMat.color.multiplyScalar(3);this.offMat=new T3.MeshBasicMaterial({color:0x221418});
  this.beamMat=new T3.MeshBasicMaterial({map:this.beamTex(),transparent:true,blending:T3.AdditiveBlending,depthWrite:false,opacity:.22});
  this.beamGeo=new T3.PlaneGeometry(260,170);this.beamGeo.rotateX(-Math.PI/2);this.beamGeo.translate(130,0,0);
  this.skin=[0xe8b896,0xd79c74,0xc08060,0xf0c8a8].map(c=>new T3.MeshLambertMaterial({color:c}));
  this.pedBody=new T3.CylinderGeometry(4,4.5,13,6);this.pedHead=new T3.SphereGeometry(3.6,8,6);
  this.staticObjs();
  // dynamic buffers
  this.mkParticles();this.mkSkids();this.mkArrow();
  this.loadAssets();
  this.ok=true;document.body.classList.add('r3on');this.setTOD(SAVE.tod||'night');
 },
 TODS:{night:{sky:[[.05,.02,.12],[.28,.06,.32],[1,.32,.45],[1,.62,.3]],fog:0x3a2448,fd:.7,hemi:[0x9aa8e0,0x3a3448,1.05],sun:[0xb8c4ff,.6,-400,900,-300],em:1.2,neon:2.2,pool:1,exp:1.05,bloom:.7,lamp:1},
  golden:{sky:[[.16,.3,.6],[.95,.62,.42],[1,.82,.55],[1,.92,.6]],fog:0xd49a78,fd:.75,hemi:[0xffdcb8,0x5a4030,1.05],sun:[0xffb070,1.4,900,380,-200],em:.15,neon:1.1,pool:0,exp:1,bloom:.35,lamp:0},
  day:{sky:[[.2,.45,.85],[.55,.75,.95],[.88,.93,.98],[1,1,1]],fog:0xa9c4dd,fd:.7,hemi:[0xe8f2ff,0x6b6455,1.25],sun:[0xffffff,1.35,400,1200,300],em:0,neon:.5,pool:0,exp:1.05,bloom:.2,lamp:0}},
 setTOD(k){const D=this.TODS[k]||this.TODS.night;this.tod=k;const U=this.sky.material.uniforms;['uTop','uMid','uHor','uSun'].forEach((n,i)=>U[n].value.setRGB(...D.sky[i]));U.uSt.value=U.uStars.value?(k==='night'?1:0):0;if(this.slMats)for(const m of this.slMats)m.color.setRGB(...(k==='night'?[1,1,1]:k==='golden'?[.8,.72,.7]:[.62,.68,.78]));
  this.scene.fog.color.set(D.fog);this.scene.background.set(D.fog);this.fogMul=D.fd;this.hemi.color.set(D.hemi[0]);this.hemi.groundColor.set(D.hemi[1]);this.hemiBase=D.hemi[2];
  this.sun.color.set(D.sun[0]);this.sun.intensity=D.sun[1];this.sun.position.set(D.sun[2],D.sun[3],D.sun[4]);for(const k2 in this.facMats)this.facMats[k2].emissiveIntensity=D.em;if(this.facBase)this.facBase.value=k==='night'?.22:k==='golden'?.08:0;this.wallMat.emissiveIntensity=D.em*1.3;
  if(this.neonM){this.neonM.pink.emissive.set(0x1a120c).multiplyScalar(D.neon>1?1:.3);this.neonM.orange.emissive.set(0x1a120c).multiplyScalar(D.neon>1?1:.3)}this.neonMul=D.neon;
  this.pool.visible=!!D.pool;this.lbar.material.color.set(0xff6a3a).multiplyScalar(D.neon*1.2);this.renderer.toneMappingExposure=D.exp;if(this.bloom)this.bloom.strength=D.bloom;this.lampOn=D.lamp;this.beamMat.opacity=D.pool?.22:.06;this.envFor(k)},
 loadAssets(){const A=window.TADD;if(!A||!A.GLTFLoader)return;
  if(A.MeshoptDecoder){const kl=new A.GLTFLoader();kl.setMeshoptDecoder(A.MeshoptDecoder);this.km={};this.kInfo={};const L=['hatchback_sports','sedan','sedan_sports','police_car','taxi','suv','suv_luxury','van','delivery_van','truck','garbage_truck'];let n=0;
   for(const nm of L)kl.load('models/cars/'+nm+'.glb',g=>{const sc=g.scene;sc.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(sc);this.km[nm]=sc;this.kInfo[nm]={ct:b.getCenter(new THREE.Vector3()),minY:b.min.y,len:b.max.z-b.min.z,wid:b.max.x-b.min.x,h:b.max.y-b.min.y};if(++n===L.length){this.kReady=true;console.info('Kenney cars ready')}},undefined,e=>{console.warn('car',nm,e);if(++n===L.length)this.kReady=true})}
  try{const gl=new A.GLTFLoader(),dr=new A.DRACOLoader();dr.setDecoderPath('vendor/jsm/libs/draco/gltf/');gl.setDRACOLoader(dr);const kt=new A.KTX2Loader();kt.setTranscoderPath('vendor/jsm/libs/basis/');kt.detectSupport(this.renderer);gl.setKTX2Loader(kt);
   this.loadGarageSpecs();{const pl=new A.GLTFLoader();this.parts={};for(const n of['rim_five','rim_multi','rim_mesh','rim_deep','rim_turbine','headlight_slim','rear_diffuser'])pl.load('models/parts/'+n+'.glb',g=>{this.parts[n]=g.scene;this.partsV=(this.partsV||0)+1},undefined,()=>{})}gl.load('models/koncept/CarConcept.gltf',g=>this.prepConcept(g.scene),undefined,e=>console.warn('koncept',e))}catch(e){console.warn('koncept loader',e)}
 {const ml=new A.GLTFLoader();if(A.MeshoptDecoder)ml.setMeshoptDecoder(A.MeshoptDecoder);this.mini=[];const N=['female_a','female_b','female_c','female_d','female_e','female_f','male_a','male_b','male_c','male_d','male_e','male_f'];
   for(const n of N)ml.load('models/people/mini_'+n+'.glb',g=>{const sc=g.scene;sc.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(sc),cl={};for(const c of g.animations)cl[c.name]=c;sc.traverse(o=>{if(o.isMesh){o.frustumCulled=false;if(o.material){o.material=new THREE.MeshLambertMaterial({map:o.material.map})}}});this.mini.push({sc,cl,h:b.max.y-b.min.y,minY:b.min.y,f:n[0]==='f'})},undefined,e=>console.warn('ped',n,e))}
  new A.GLTFLoader().load('models/xbot.glb',g=>{this.pedProto=g.scene;this.pedClips={};for(const c of g.animations)this.pedClips[c.name]=c},undefined,e=>console.warn('xbot',e))},
 prepConcept(root){const T3=THREE;root.traverse(o=>{if(/License|Emblem/i.test(o.name))o.visible=false;if(o.isMesh){o.castShadow=false;const m=o.material;if(m&&/Khronos/i.test(JSON.stringify(m.userData||{})))o.visible=false}});
  root.updateMatrixWorld(true);const bb=new T3.Box3().setFromObject(root),sz=bb.getSize(new T3.Vector3()),ct=bb.getCenter(new T3.Vector3());const alongZ=sz.z>sz.x;
  let hl=null;root.traverse(o=>{if(o.name==='BodyHeadlights')hl=o});const hp=hl?new T3.Box3().setFromObject(hl).getCenter(new T3.Vector3()):ct.clone().add(new T3.Vector3(alongZ?0:1,0,alongZ?1:0));
  const fwd=alongZ?Math.sign(hp.z-ct.z)||1:Math.sign(hp.x-ct.x)||1;const len=Math.max(sz.x,sz.z),k=46/len;
  const inner=new T3.Group();inner.add(root);root.position.set(-ct.x,-bb.min.y,-ct.z);const piv=new T3.Group();piv.add(inner);inner.scale.setScalar(k);
  inner.rotation.y=alongZ?(fwd>0?Math.PI/2:-Math.PI/2):(fwd>0?0:Math.PI);this.concept=piv;
  piv.updateMatrixWorld(true);let sw=null;root.traverse(o=>{if(!sw&&/InteriorSteeringWheel0?1|InteriorSteeringBase/.test(o.name))sw=o});if(sw){const bx=new T3.Box3().setFromObject(sw);this.swPos=bx.getCenter(new T3.Vector3());this.swTop=bx.max.y}const tb=new T3.Box3().setFromObject(piv);this.cTop=tb.max.y;const zb=this.zB={len:tb.max.x-tb.min.x,fx:tb.max.x,rx:tb.min.x,hw:tb.max.z,top:tb.max.y};root.traverse(o=>{const nm=o.name;if(/^(BodyRoofPanel|BodyRearPanelsColor1|BodyTaillightsPanels|BodyHood|BodyRearwindow|BodyWindshield|WheelRearL|WheelFrontL|BodyPanelsColor2|BodyHeadlights)$/.test(nm)){const b=new T3.Box3().setFromObject(o);zb[nm]=[b.min.x,b.max.x,b.min.y,b.max.y,b.min.z,b.max.z].map(v=>+v.toFixed(2))}});this.cAxis=alongZ?'x':'z';console.info('Koncept ready',sz,alongZ,fwd)},
 hdrCache:{},envFor(k){const A=window.TADD,T3=THREE;if(k==='night'||!A||!A.RGBELoader){this.scene.environment=this.env;return}
  if(this.hdrCache[k]){this.scene.environment=this.hdrCache[k];return}new A.RGBELoader().load('hdr/'+k+'.hdr',t=>{t.mapping=T3.EquirectangularReflectionMapping;const pm=new T3.PMREMGenerator(this.renderer);this.hdrCache[k]=pm.fromEquirectangular(t).texture;pm.dispose();t.dispose();if(this.tod===k)this.scene.environment=this.hdrCache[k]},undefined,e=>console.warn('hdr',e))},
 ms:{},matS(col){return this.ms[col]||(this.ms[col]=new THREE.MeshStandardMaterial({color:col,roughness:.55,metalness:.15}))},
 resize(){if(!this.ok)return;this.renderer.setSize(VW,VH,false);this.cam.aspect=VW/VH;this.cam.updateProjectionMatrix();if(this.comp){this.comp.setSize(VW,VH);this.bloom.setSize(VW*.5,VH*.5)}},
 setupComposer(){const A=window.TADD,T3=THREE;this.comp=null;if(!A||this.q!=='high')return;try{const c=new A.EffectComposer(this.renderer);c.setPixelRatio(this.renderer.getPixelRatio());c.setSize(VW,VH);c.addPass(new A.RenderPass(this.scene,this.cam));
   this.bloom=new A.UnrealBloomPass(new T3.Vector2(VW*.5,VH*.5),.7,.45,.92);c.addPass(this.bloom);c.addPass(new A.OutputPass());this.comp=c}catch(e){console.warn('bloom off',e);this.comp=null}},
 perf(dt){this.fs=(this.fs||0)+1;this.ft=(this.ft||0)+dt;if(this.ft<3)return;const fps=this.fs/this.ft;this.fs=0;this.ft=0;
  if(fps<26&&this.q==='high'&&!SAVE.gfx){this.q='low';this.comp=null;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1));this.renderer.setSize(VW,VH,false);console.info('R3: low quality',fps.toFixed(1))}},
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
  const pg=new T3.PlaneGeometry(1,1);pg.rotateX(-Math.PI/2);const pool=this.pool=new T3.InstancedMesh(pg,new T3.MeshBasicMaterial({map:this.glowTex('rgba(255,160,70,.3)'),transparent:true,blending:T3.AdditiveBlending,depthWrite:false}),n);
  for(let i=0;i<n;i++){const l=lamps[i];M.makeTranslation(l.x,23,l.y);pole.setMatrixAt(i,M);M.makeTranslation(l.x,47,l.y);bulb.setMatrixAt(i,M);M.compose(V.set(l.x,1.2,l.y),Q.identity(),SC.set(230,1,230));pool.setMatrixAt(i,M)}
  const bar=this.lbar=new T3.InstancedMesh(new T3.BoxGeometry(30,2.4,3.2),new T3.MeshBasicMaterial({color:new T3.Color(0xff6a3a).multiplyScalar(2.6)}),n);
  for(let i=0;i<n;i++){const l=lamps[i];Q.setFromAxisAngle(V.set(0,1,0),(i%2)*Math.PI/2);M.compose(V.set(l.x,46,l.y),Q,SC.set(1,1,1));bar.setMatrixAt(i,M)}
  S.add(pole,bulb,pool,bar);
  // trees
  const tg=new T3.IcosahedronGeometry(1,1);const tm=new T3.InstancedMesh(tg,new T3.MeshLambertMaterial({color:0xffffff}),trees.length);
  trees.forEach((t,i)=>{M.compose(V.set(t.x,t.r*1.3,t.y),Q.identity(),SC.set(t.r,t.r*1.25,t.r));tm.setMatrixAt(i,M);tm.setColorAt(i,C.set(t.c))});S.add(tm);
  // parked cars
  const pb=new T3.InstancedMesh(this.carBox,new T3.MeshLambertMaterial({color:0xffffff}),parked.length),pc=new T3.InstancedMesh(this.carBox,this.glass,parked.length);
  parked.forEach((p,i)=>{Q.setFromAxisAngle(V.set(0,1,0),-p.a);M.compose(V.set(p.x,7,p.y),Q,SC.set(p.L,12,p.Wd));pb.setMatrixAt(i,M);pb.setColorAt(i,C.set(p.col));M.compose(V.set(p.x,15,p.y),Q,SC.set(p.L*.5,8,p.Wd*.84));pc.setMatrixAt(i,M)});S.add(pb,pc);this.parkedBox=[pb,pc];
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
  const grp=new T3.Group();const gm=new T3.Mesh(this.groundGeo,this.groundMat(tex));gm.rotation.x=-Math.PI/2;gm.position.set(x0+S/2,0,y0+S/2);grp.add(gm);
  // buildings whose centre lies in this chunk
  const W={pos:[],nor:[],uv:[],col:[]},WF={},RF={};const rk=b=>b.panel?'roof_tar':b.factory?'roof_metal':(b.castle||b.church)?'roof_tiles':(b.chimney||b.pylon||b.tower)?'plain':b.shop?'roof_metal':(((b.x*7+b.y*13)/T|0)%3===0?'roof_tiles':'roof_tar');
  const C=new T3.Color();
  for(const b of buildings){const mx=b.x+b.w/2,my=b.y+b.h/2;if(mx<x0||mx>x1||my<y0||my>y1)continue;
   const H=Math.min(b.ht*this.HK,b.pylon?560:900),X0=b.x,X1=b.x+b.w,Z0=b.y,Z1=b.y+b.h;C.set(b.col);const wc=C.clone().lerp(new T3.Color(0xbdb8ae),.35);
   const quad=(o,a,bq,c,d,n,uv)=>{o.pos.push(...a,...bq,...c,...a,...c,...d);for(let q=0;q<6;q++)o.nor.push(...n);o.uv.push(uv[0],uv[1],uv[2],uv[3],uv[4],uv[5],uv[0],uv[1],uv[4],uv[5],uv[6],uv[7])};
   const hsh=((b.x*13+b.y*7)/T|0),fk=b.panel?'panel':b.factory?'industrial':b.chimney?'brick':b.pylon?'plain':(b.tower||b.hotel)?'modern':(b.castle||b.church)?'stone':['brick','plaster','baroque','plaster','brick','baroque'][hsh%6],FW=fk==='stone'?140:fk==='modern'?170:160,FH=fk==='panel'?150:fk==='modern'?150:fk==='stone'?110:120;
   const band=!b.panel&&!b.factory&&!b.chimney&&!b.pylon&&!b.tower&&!b.castle&&!b.church&&H>50&&(b.shop||b.bar||b.hotel||hsh%3!==0)?40:0;
   const acc=k=>WF[k]||(WF[k]={pos:[],nor:[],uv:[],col:[]}),tc=fk==='plain'?C.clone().lerp(new T3.Color(0xffffff),.7):new T3.Color(0xffffff).lerp(C,.22);
   const wall=(ax,az,bx,bz,n)=>{const L=Math.hypot(bx-ax,bz-az),u0=((ax+az)%997)/FW,u1=u0+L/FW;
    if(band){const o=acc('shops'),su0=((ax*3+az)%991)/120,su1=su0+L/120;quad(o,[ax,0,az],[bx,0,bz],[bx,band,bz],[ax,band,az],n,[su0,0,su1,0,su1,1,su0,1]);for(let q=0;q<6;q++)o.col.push(1,1,1)}
    const o=acc(fk),v1=(H-band)/FH;quad(o,[ax,band,az],[bx,band,bz],[bx,H,bz],[ax,H,az],n,[u0,0,u1,0,u1,v1,u0,v1]);for(let q=0;q<6;q++)o.col.push(tc.r,tc.g,tc.b)};
   wall(X0,Z1,X1,Z1,[0,0,1]);wall(X1,Z1,X1,Z0,[1,0,0]);wall(X1,Z0,X0,Z0,[0,0,-1]);wall(X0,Z0,X0,Z1,[-1,0,0]);
   const key=rk(b),o=RF[key]||(RF[key]={pos:[],nor:[],uv:[],col:[]}),sc=key==='plain'?1:1/192;
   quad(o,[X0,H,Z1],[X1,H,Z1],[X1,H,Z0],[X0,H,Z0],[0,1,0],[X0*sc,Z1*sc,X1*sc,Z1*sc,X1*sc,Z0*sc,X0*sc,Z0*sc]);const rc=key==='roof_tiles'?C.clone().lerp(new T3.Color(0xffffff),.5):C;for(let q=0;q<6;q++)o.col.push(rc.r,rc.g,rc.b);
   if(b.chimney){const sm=new T3.Mesh(new T3.CylinderGeometry(b.w*.3,b.w*.3,4,8),new T3.MeshBasicMaterial({color:0x1a1010}));sm.position.set(mx,H+2,my);grp.add(sm)}}
  const mk=(o,mat)=>{if(!o.pos.length)return;const bg=new T3.BufferGeometry();bg.setAttribute('position',new T3.Float32BufferAttribute(o.pos,3));bg.setAttribute('normal',new T3.Float32BufferAttribute(o.nor,3));bg.setAttribute('uv',new T3.Float32BufferAttribute(o.uv,2));bg.setAttribute('color',new T3.Float32BufferAttribute(o.col,3));grp.add(new T3.Mesh(bg,mat))};
  mk(W,this.wallMat);for(const k in WF)mk(WF[k],this.facMats[k]);for(const k in RF)mk(RF[k],this.roofMats[k]);
  {const WP=[],RL={pos:[]},PO={pos:[]},tx0=Math.floor(x0/T),ty0=Math.floor(y0/T),isW=t=>t===WATER,bx=(o,a0,b0,a1,b1,h0,h1)=>{const v=[[a0,h0,b0],[a1,h0,b0],[a1,h0,b1],[a0,h0,b1],[a0,h1,b0],[a1,h1,b0],[a1,h1,b1],[a0,h1,b1]],f=[[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];for(const q of f)o.pos.push(...v[q[0]],...v[q[1]],...v[q[2]],...v[q[0]],...v[q[2]],...v[q[3]])};
   const rail=(a0,b0,a1,b1,horiz)=>{const r=.7;if(horiz){bx(RL,a0,b0-r,a1,b0+r,11,13);bx(RL,a0,b0-.4,a1,b0+.4,6,7);for(let x=a0;x<a1;x+=12)bx(PO,x-.8,b0-.8,x+.8,b0+.8,0,13)}else{bx(RL,a0-r,b0,a0+r,b1,11,13);bx(RL,a0-.4,b0,a0+.4,b1,6,7);for(let z=b0;z<b1;z+=12)bx(PO,a0-.8,z-.8,a0+.8,z+.8,0,13)}};
   for(let ty=ty0;ty<ty0+CH;ty++)for(let tx=tx0;tx<tx0+CH;tx++){const t0=tileAt(tx,ty),X=tx*T,Y=ty*T;
    if(isW(t0)){WP.push(X,Y);continue}
    if(t0===BRIDGE||t0===WALK||t0===ROAD||t0===PLAZA||t0===GRASS){const e=t0===BRIDGE?1.5:3;
     if(isW(tileAt(tx,ty-1)))rail(X,Y+e,X+T,Y+e,1);if(isW(tileAt(tx,ty+1)))rail(X,Y+T-e,X+T,Y+T-e,1);if(isW(tileAt(tx-1,ty)))rail(X+e,Y,X+e,Y+T,0);if(isW(tileAt(tx+1,ty)))rail(X+T-e,Y,X+T-e,Y+T,0)}}
   if(WP.length){const pos=[],uv=[];for(let i=0;i<WP.length;i+=2){const X=WP[i],Y=WP[i+1],h=.6;pos.push(X,h,Y,X+T,h,Y+T,X+T,h,Y,X,h,Y,X,h,Y+T,X+T,h,Y+T);uv.push(X,Y,X+T,Y+T,X+T,Y,X,Y,X,Y+T,X+T,Y+T)}
    const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T3.Float32BufferAttribute(uv.map(v=>v/T),2));g.computeVertexNormals();grp.add(new T3.Mesh(g,this.waterMat()));
    // sunken ground under water so the river reads as lower than the road
   }
   const mkR=(o,mat)=>{if(!o.pos.length)return;const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(o.pos,3));g.computeVertexNormals();grp.add(new T3.Mesh(g,mat))};
   if(!this.railM){this.railM=new T3.MeshStandardMaterial({color:0xb8bcc4,metalness:.8,roughness:.35,emissive:0x202226});this.postM=new T3.MeshStandardMaterial({color:0x50545c,metalness:.6,roughness:.5,emissive:0x101114})}
   mkR(RL,this.railM);mkR(PO,this.postM)}
  {const NE={pink:{pos:[]},orange:{pos:[]}},box=(o,x0b,z0b,x1b,z1b,h0,h1)=>{const v=[[x0b,h0,z0b],[x1b,h0,z0b],[x1b,h0,z1b],[x0b,h0,z1b],[x0b,h1,z0b],[x1b,h1,z0b],[x1b,h1,z1b],[x0b,h1,z1b]],f=[[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];for(const q of f){o.pos.push(...v[q[0]],...v[q[1]],...v[q[2]],...v[q[0]],...v[q[2]],...v[q[3]])}};
   const isR=t=>t===ROAD||t===BRIDGE,tx0=Math.floor(x0/T),ty0=Math.floor(y0/T);
   for(let ty=ty0;ty<ty0+CH;ty++)for(let tx=tx0;tx<tx0+CH;tx++){const t0=tileAt(tx,ty);if(!isR(t0))continue;const o=t0===BRIDGE?NE.orange:NE.pink,X=tx*T,Y=ty*T,w=1.6,h1=2.6;
    if(!isR(tileAt(tx,ty-1)))box(o,X,Y,X+T,Y+w,.5,h1);if(!isR(tileAt(tx,ty+1)))box(o,X,Y+T-w,X+T,Y+T,.5,h1);if(!isR(tileAt(tx-1,ty)))box(o,X,Y,X+w,Y+T,.5,h1);if(!isR(tileAt(tx+1,ty)))box(o,X+T-w,Y,X+T,Y+T,.5,h1)}
   if(!this.neonM){const mk=(tint)=>{const m=new T3.MeshLambertMaterial({color:tint,emissive:0x1a120c});const tx=this.curbTex||(this.curbTex=new T3.TextureLoader().load('art/tex/curb.jpg',t=>{t.colorSpace=T3.SRGBColorSpace}));tx.wrapS=tx.wrapT=T3.RepeatWrapping;m.map=tx;
     m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCW=(modelMatrix*vec4(position,1.)).xyz;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCW;').replace('#include <map_fragment>','vec4 sampledDiffuseColor=texture2D(map,vec2((vCW.x+vCW.z)/72.,vCW.y/3.2+.05));diffuseColor*=sampledDiffuseColor;')};m.customProgramCacheKey=()=>'curb';return m};
    this.neonM={pink:mk(0xffffff),orange:mk(0xd8d2c8)}}
   for(const k in NE){if(!NE[k].pos.length)continue;const bg=new T3.BufferGeometry();bg.setAttribute('position',new T3.Float32BufferAttribute(NE[k].pos,3));bg.computeVertexNormals();grp.add(new T3.Mesh(bg,this.neonM[k]))}}
  // neon signs on facades
  for(const sg of signs){if(sg.x<x0||sg.x>x1||sg.y<y0||sg.y>y1+2)continue;const m=this.signMesh(sg);if(m)grp.add(m)}
  this.scene.add(grp);return{grp,tex,gm}},
 signCache:{},
 detail(){if(this.detTex)return this.detTex;const T3=THREE,cv=document.createElement('canvas');cv.width=cv.height=512;const x=cv.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,512,512);
  const t=this.detTex=new T3.CanvasTexture(cv);t.wrapS=t.wrapT=T3.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
  const im=new Image();im.onload=()=>{x.drawImage(im,0,0,512,512);const d=x.getImageData(0,0,512,512),a=d.data;let sum=0;for(let i=0;i<a.length;i+=4)sum+=a[i]*.3+a[i+1]*.59+a[i+2]*.11;const mean=sum/(a.length/4);
   for(let i=0;i<a.length;i+=4){const l=a[i]*.3+a[i+1]*.59+a[i+2]*.11,v=clamp(128+(l-mean)*1.6,0,255);a[i]=a[i+1]=a[i+2]=v}x.putImageData(d,0,0);t.needsUpdate=true};im.src='art/tex/asphalt.jpg';return t},
 groundMat(tex){const T3=THREE,m=new T3.MeshLambertMaterial({map:tex}),det=this.detail();
  m.onBeforeCompile=sh=>{sh.uniforms.uDet={value:det};sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vGW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGW=(modelMatrix*vec4(position,1.)).xz;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D uDet;varying vec2 vGW;').replace('#include <map_fragment>','#include <map_fragment>\n{float d1=texture2D(uDet,vGW/64.).r,d2=texture2D(uDet,vGW/23.+.37).r;diffuseColor.rgb*=clamp(.55+d1*.62+(d2-.5)*.45,.4,1.6);}')};
  m.customProgramCacheKey=()=>'gdet';return m},
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
 mc:{},matC(col){return this.mc[col]||(this.mc[col]=new THREE.MeshLambertMaterial({color:col}))},
 carGeo:{},carShape(kind,L,W){const key=kind+L+'_'+W;if(this.carGeo[key])return this.carGeo[key];const T3=THREE;
  const P={hatch:{low:[[-.5,3],[-.5,11.5],[-.45,13.2],[.28,13.2],[.46,11.6],[.5,9.5],[.5,3]],cab:[[-.44,13],[-.41,21],[-.02,21.6],[.26,13]]},
   sedan:{low:[[-.5,3],[-.5,12.6],[-.32,13.6],[.27,13.4],[.46,11.8],[.5,9.5],[.5,3]],cab:[[-.33,13.4],[-.24,20.6],[.06,21.1],[.27,13.4]]},
   coupe:{low:[[-.5,3],[-.5,11.8],[-.36,12.6],[.25,12.4],[.47,10.6],[.5,8.5],[.5,3]],cab:[[-.34,12.4],[-.18,19],[.04,19.4],[.25,12.4]]}}[kind];
  const ex=(pts,depth,bev)=>{const sh=new T3.Shape();pts.forEach((q,i)=>i?sh.lineTo(q[0]*L,q[1]):sh.moveTo(q[0]*L,q[1]));sh.closePath();
   const ge=new T3.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:2,curveSegments:2});ge.translate(0,0,-depth/2);ge.computeVertexNormals();return ge};
  const c=P.cab;return this.carGeo[key]={low:ex(P.low,W-3,1.5),cab:ex(c,W*.8-2,1),roofX:[c[1][0]*L,c[2][0]*L],roofY:Math.max(c[1][1],c[2][1])}},
 carMesh(c){if(c.kind==='player'&&c.st&&c.st.kenney&&this.kReady&&this.km[c.st.kenney]){const t=(typeof SAVE!=='undefined'&&SAVE.tune&&SAVE.tune[c.st.id])||{};const g=this.kenneyMesh(Object.assign({},c,{col:t.p1||c.col}),c.st.kenney);g.userData.tk=this.tuneKey(c.st.id);return g}
  if(c.kind==='player'&&this.concept&&c.st&&!c.st.kenney)return this.zMesh(c,this.zSpec(c.st.id,(typeof SAVE!=='undefined'&&SAVE.tune&&SAVE.tune[c.st.id])||null));{const km=this.kModelFor(c);if(km)return this.kenneyMesh(c,km)}const T3=THREE,g=new T3.Group(),L=c.L,W=c.Wd,st=c.st||{},pol=!!st.police;
  const kind=pol?'sedan':st.id==='bavorak'||st.id==='imprezka'?'sedan':st.id==='supka'?'coupe':c.kind==='civ'?((c.L*7|0)%3===0?'sedan':'hatch'):'hatch';
  const geo=this.carShape(kind,L,W),paint=new T3.MeshPhysicalMaterial({color:pol?0xe9ecef:c.col,metalness:.35,roughness:.32,clearcoat:1,clearcoatRoughness:.06,envMapIntensity:.85});
  if(!this.shTex){this.shTex=this.glowTex('rgba(0,0,0,.85)');this.shGeo=new T3.PlaneGeometry(1,1);this.shGeo.rotateX(-Math.PI/2);this.shMat=new T3.MeshBasicMaterial({map:this.shTex,transparent:true,depthWrite:false})}
  {const sh=new T3.Mesh(this.shGeo,this.shMat);sh.scale.set(L*1.5,1,W*1.9);sh.position.y=.7;sh.userData.keep=1;g.add(sh)}
  const low=new T3.Mesh(geo.low,paint);g.add(low);const cab=new T3.Mesh(geo.cab,this.glassP||(this.glassP=new T3.MeshPhysicalMaterial({color:0x0a1018,metalness:.6,roughness:.05,envMapIntensity:2.2,clearcoat:1})));g.add(cab);
  const rw=geo.roofX[1]-geo.roofX[0];const roof=new T3.Mesh(this.carBox,paint);roof.scale.set(rw*.92,1.4,W*.78);roof.position.set((geo.roofX[0]+geo.roofX[1])/2,geo.roofY+.6,0);g.add(roof);
  const dark=this.matC(0x16171a);for(const sx of[-1,1]){const bp=new T3.Mesh(this.carBox,dark);bp.scale.set(2,3.4,W-1);bp.position.set(sx*(L/2+1.4),4.6,0);g.add(bp)}
  if(!this.tireG){this.tireG=new T3.CylinderGeometry(5.6,5.6,4.2,14);this.tireG.rotateX(Math.PI/2);this.rimG=new T3.CylinderGeometry(3.4,3.4,4.5,8);this.rimG.rotateX(Math.PI/2);this.rimM=new T3.MeshStandardMaterial({color:0xd0d4dc,metalness:1,roughness:.22,envMapIntensity:1.6})}
  const wheels=[];for(const sx of[-1,1])for(const sz of[-1,1]){const wg=new T3.Group();wg.add(new T3.Mesh(this.tireG,dark));const rim=new T3.Mesh(this.rimG,st.id==='imprezka'?this.matC(0xc9a227):this.rimM);wg.add(rim);
   wg.position.set(sx*L*.31,5.6,sz*(W/2-1.6));g.add(wg);wheels.push(wg)}
  for(const sd of[-1,1]){const h=new T3.Mesh(this.carBox,this.hlMat);h.scale.set(1.2,2.4,4.6);h.position.set(L/2+1.9,9.2,sd*W*.31);g.add(h);
   const t=new T3.Mesh(this.carBox,this.tlMat);t.scale.set(1.4,3.4,6.4);t.position.set(-L/2-2,10.4,sd*W*.28);g.add(t);
   const mi=new T3.Mesh(this.carBox,paint);mi.scale.set(2.4,1.8,1.6);mi.position.set(L*.22,14,sd*(W/2+.6));g.add(mi)}
  if(c.stripe){const sm=this.matC(c.stripe);for(const z of[-2.6,2.6]){const s1=new T3.Mesh(this.carBox,sm);s1.scale.set(L*.24,.4,2.2);s1.position.set(L*.37,12.8,z);g.add(s1);const s2=new T3.Mesh(this.carBox,sm);s2.scale.set(rw*.9,.4,2.2);s2.position.set((geo.roofX[0]+geo.roofX[1])/2,geo.roofY+1.4,z);g.add(s2)}}
  if(pol){const band=new T3.Mesh(this.carBox,this.matC(0x1e4bd6));band.scale.set(L*.98,2.6,W+.2);band.position.y=8.2;g.add(band);const yel=new T3.Mesh(this.carBox,this.matC(0xd6e21e));yel.scale.set(L*.98,.8,W+.25);yel.position.y=10;g.add(yel);
   const lr=new T3.Mesh(this.carBox,this.redMat),lb=new T3.Mesh(this.carBox,this.bluMat);lr.scale.set(4,2.4,W*.36);lb.scale.set(4,2.4,W*.36);const rx=(geo.roofX[0]+geo.roofX[1])/2,ry=geo.roofY+2.6;lr.position.set(rx,ry,-W*.2);lb.position.set(rx,ry,W*.2);g.add(lr,lb);g.userData.bar=[lr,lb]}
  if(st.spoiler){const sp=new T3.Mesh(this.carBox,dark);sp.scale.set(4,1,W*.95);sp.position.set(-L/2+2,geo.roofY-1,0);g.add(sp);for(const z of[-1,1]){const lg=new T3.Mesh(this.carBox,dark);lg.scale.set(1.2,4,1.2);lg.position.set(-L/2+2,geo.roofY-3.5,z*W*.35);g.add(lg)}}
  const beam=new T3.Mesh(this.beamGeo,this.beamMat);beam.position.set(L/2,1.6,0);g.add(beam);
  beam.userData.keep=1;for(const wg of wheels)wg.userData.keep=1;const ch=new T3.Group();for(const o of[...g.children])if(!o.userData.keep)ch.add(o);g.add(ch);
  let glow=null;if(c.kind==='player'||c.kind==='rival'){if(!this.ugTex)this.ugTex=this.glowTex('rgba(255,255,255,.9)');glow=new T3.Mesh(this.shGeo,new T3.MeshBasicMaterial({map:this.ugTex,color:c.kind==='player'?0xff2e88:c.col,transparent:true,blending:T3.AdditiveBlending,depthWrite:false}));glow.scale.set(L*2,1,W*2.6);glow.position.y=1;g.add(glow)}
  if(!this.flG){this.flG=new T3.ConeGeometry(3.2,16,8);this.flG.rotateZ(Math.PI/2);this.flM=new T3.MeshBasicMaterial({color:new T3.Color(0x66aaff).multiplyScalar(3),transparent:true,opacity:.85,blending:T3.AdditiveBlending,depthWrite:false})}
  const fl=new T3.Mesh(this.flG,this.flM);fl.position.set(-L/2-9,5.5,W*.25);fl.visible=false;g.add(fl);
  const pl=new T3.Mesh(this.carBox,this.matC(0xeeeeee));pl.scale.set(.6,3,8);pl.position.set(-L/2-1.6,7,0);ch.add(pl);const ex=new T3.Mesh(this.carBox,this.matC(0x555a60));ex.scale.set(3,1.8,1.8);ex.position.set(-L/2-1,3.6,-W*.28);ch.add(ex);
  g.userData={beam,paint,wheels,bar:g.userData.bar,ch,glow,fl};this.scene.add(g);return g},
 kModelFor(c){if(!this.kReady)return null;const st=c.st||{},id=st.id;let m=null;
  if(st.police)m='police_car';else if(st.gang)m='suv_luxury';else if(c.kind==='player'||id)m={civka:'hatchback_sports',felda:'hatchback_sports',golfik:'hatchback_sports',bavorak:'sedan_sports',imprezka:'sedan_sports',supka:'sedan_sports'}[id]||(c.kind==='player'?'hatchback_sports':null);
  if(!m&&c.kind==='rival')m=(c.name||'').length%2?'sedan_sports':'hatchback_sports';
  if(!m&&c.kind==='civ'){const L=['sedan','suv','van','sedan','taxi','suv_luxury','delivery_van','truck','sedan'];m=L[Math.floor((c.L*97)%L.length)]}
  return m&&this.km[m]?m:null},
 atlas:new Map(),kTex(srcTex,uvs,col){const key=srcTex.uuid+'|'+col;if(this.atlas.has(key))return this.atlas.get(key);const img=srcTex.image,w=img.width,h=img.height,cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');g.drawImage(img,0,0);const id=g.getImageData(0,0,w,h),d=id.data;
  const cnt=new Map();for(let i=0;i<uvs.length;i+=2){const x=Math.min(w-1,Math.max(0,Math.floor((uvs[i]%1+1)%1*w))),y=Math.min(h-1,Math.max(0,Math.floor((uvs[i+1]%1+1)%1*h))),o=(y*w+x)*4,r=d[o],gg=d[o+1],b=d[o+2],mx=Math.max(r,gg,b),mn=Math.min(r,gg,b);if(mx-mn<40||mx>235&&mn>200)continue;const k=(r>>4)+','+(gg>>4)+','+(b>>4);cnt.set(k,(cnt.get(k)||0)+1)}
  let best=null,bn=0;for(const[k,v]of cnt)if(v>bn){bn=v;best=k}if(!best){this.atlas.set(key,srcTex);return srcTex}const[br,bg,bb]=best.split(',').map(v=>v*16+8),bl=(br*.3+bg*.59+bb*.11)||1;const T=new THREE.Color(col);const tr=T.r*255,tg=T.g*255,tb=T.b*255;
  const hue=(r,g2,b)=>{const mx=Math.max(r,g2,b),mn=Math.min(r,g2,b),dd=mx-mn;if(!dd)return-1;let h=mx===r?((g2-b)/dd)%6:mx===g2?(b-r)/dd+2:(r-g2)/dd+4;return(h*60+360)%360},H0=hue(br,bg,bb);
  for(let i=0;i<d.length;i+=4){const r=d[i],g2=d[i+1],b=d[i+2],mx=Math.max(r,g2,b),mn=Math.min(r,g2,b);if(mx-mn<35||mx<30)continue;const h=hue(r,g2,b);let dh=Math.abs(h-H0);dh=Math.min(dh,360-dh);if(dh<22){const l=(r*.3+g2*.59+b*.11)/bl;d[i]=Math.min(255,tr*l);d[i+1]=Math.min(255,tg*l);d[i+2]=Math.min(255,tb*l)}}
  g.putImageData(id,0,0);const t=new THREE.CanvasTexture(cv);t.flipY=srcTex.flipY;t.colorSpace=THREE.SRGBColorSpace;t.magFilter=srcTex.magFilter;t.minFilter=srcTex.minFilter;this.atlas.set(key,t);return t},
 kenneyMesh(c,nm){const T3=THREE,g=new T3.Group(),L=c.L,W=c.Wd,info=this.kInfo[nm],m=this.km[nm].clone(true),k=L/info.len,keepCol=nm==='taxi'||nm==='police_car';const wheels=[];const sp=c.st&&c.st.id==='imprezka';
  m.traverse(o=>{if(/^wheel-/.test(o.name)){o.rotation.order='YXZ';o.userData.front=/front/.test(o.name);wheels.push(o)}if(o.name==='spoiler'&&!(sp||c.kind==='rival'))o.visible=false;
   if(o.isMesh&&o.material&&o.material.map&&!/^wheel/.test(o.name)&&!keepCol){const uv=o.geometry.attributes.uv,mp=o.material.map,ua=[];if(uv){mp.updateMatrix&&mp.updateMatrix();const v=new T3.Vector2();for(let i=0;i<uv.count;i++){v.set(uv.getX(i),uv.getY(i));if(mp.matrixAutoUpdate!==undefined)v.applyMatrix3(mp.matrix);ua.push(v.x,v.y)}}const mat=new T3.MeshPhysicalMaterial({map:this.kTex(mp,ua,c.col),metalness:.25,roughness:.38,clearcoat:.9,clearcoatRoughness:.08,envMapIntensity:.9});o.material=mat}
   else if(o.isMesh&&o.material&&o.material.map&&keepCol){o.material=new T3.MeshPhysicalMaterial({map:o.material.map,metalness:.2,roughness:.4,clearcoat:.8,clearcoatRoughness:.1})}});
  const inner=new T3.Group();m.position.set(-info.ct.x,-info.minY,-info.ct.z);inner.add(m);inner.rotation.y=Math.PI/2;inner.scale.setScalar(k);const ch=new T3.Group();ch.add(inner);g.add(ch);const H=info.h*k,Wm=info.wid*k;
  if(!this.shTex){this.shTex=this.glowTex('rgba(0,0,0,.85)');this.shGeo=new T3.PlaneGeometry(1,1);this.shGeo.rotateX(-Math.PI/2);this.shMat=new T3.MeshBasicMaterial({map:this.shTex,transparent:true,depthWrite:false})}
  const sh=new T3.Mesh(this.shGeo,this.shMat);sh.scale.set(L*1.5,1,Wm*1.9);sh.position.y=.7;g.add(sh);const beam=new T3.Mesh(this.beamGeo,this.beamMat);beam.position.set(L/2,1.6,0);g.add(beam);
  for(const sd of[-1,1]){const h=new T3.Mesh(this.carBox,this.hlMat);h.scale.set(.2,.9,2.2);h.position.set(L/2-.02,H*.42,sd*Wm*.32);ch.add(h);const tl=new T3.Mesh(this.carBox,this.tlMat);tl.scale.set(.2,1,2.4);tl.position.set(-L/2+.02,H*.48,sd*Wm*.32);ch.add(tl)}
  let bar=null;if(nm==='police_car'){const lr=new T3.Mesh(this.carBox,this.redMat),lb=new T3.Mesh(this.carBox,this.bluMat);lr.scale.set(3,2,Wm*.3);lb.scale.set(3,2,Wm*.3);lr.position.set(-L*.04,H+.6,-Wm*.18);lb.position.set(-L*.04,H+.6,Wm*.18);ch.add(lr,lb);bar=[lr,lb]}
  let glow=null;if(c.kind==='player'||c.kind==='rival'){if(!this.ugTex)this.ugTex=this.glowTex('rgba(255,255,255,.9)');glow=new T3.Mesh(this.shGeo,new T3.MeshBasicMaterial({map:this.ugTex,color:c.kind==='player'?0xff2e88:c.col,transparent:true,blending:T3.AdditiveBlending,depthWrite:false}));glow.scale.set(L*2,1,Wm*2.6);glow.position.y=1;g.add(glow)}
  if(!this.flG){this.flG=new T3.ConeGeometry(3.2,16,8);this.flG.rotateZ(Math.PI/2);this.flM=new T3.MeshBasicMaterial({color:new T3.Color(0x66aaff).multiplyScalar(3),transparent:true,opacity:.85,blending:T3.AdditiveBlending,depthWrite:false})}
  const fl=new T3.Mesh(this.flG,this.flM);fl.position.set(-L/2-8,H*.3,Wm*.25);fl.visible=false;g.add(fl);
  g.userData={beam,paint:new T3.Color(),wheels:[],kw:wheels,ch,glow,fl,bar,k:true};this.scene.add(g);return g},
 conceptMesh(c){const T3=THREE,g=new T3.Group(),L=c.L,W=c.Wd,m=this.concept.clone(true);const paint=new T3.MeshPhysicalMaterial({color:c.col,metalness:.5,roughness:.28,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1});
  const wheels=[];m.traverse(o=>{if(o.isMesh&&o.material&&/^Paint 1/.test(o.material.name))o.material=paint;if(/^Wheel(Front|Rear)[LR]$/.test(o.name)){o.userData.front=/Front/.test(o.name);wheels.push(o)}});
  const ch=new T3.Group();ch.add(m);g.add(ch);if(!this.shTex){this.shTex=this.glowTex('rgba(0,0,0,.85)');this.shGeo=new T3.PlaneGeometry(1,1);this.shGeo.rotateX(-Math.PI/2);this.shMat=new T3.MeshBasicMaterial({map:this.shTex,transparent:true,depthWrite:false})}
  const sh=new T3.Mesh(this.shGeo,this.shMat);sh.scale.set(L*1.5,1,W*1.9);sh.position.y=.7;g.add(sh);const beam=new T3.Mesh(this.beamGeo,this.beamMat);beam.position.set(L/2,1.6,0);g.add(beam);
  if(!this.ugTex)this.ugTex=this.glowTex('rgba(255,255,255,.9)');const glow=new T3.Mesh(this.shGeo,new T3.MeshBasicMaterial({map:this.ugTex,color:0x2ef0ff,transparent:true,blending:T3.AdditiveBlending,depthWrite:false}));glow.scale.set(L*2,1,W*2.6);glow.position.y=1;g.add(glow);
  if(!this.flG){this.flG=new T3.ConeGeometry(3.2,16,8);this.flG.rotateZ(Math.PI/2);this.flM=new T3.MeshBasicMaterial({color:new T3.Color(0x66aaff).multiplyScalar(3),transparent:true,opacity:.85,blending:T3.AdditiveBlending,depthWrite:false})}
  const fl=new T3.Mesh(this.flG,this.flM);fl.position.set(-L/2-8,5,0);fl.visible=false;g.add(fl);
  g.userData={beam,paint,wheels:[],cw:wheels,ch,glow,fl,concept:true};this.scene.add(g);return g},
 // ---------- Z platform: our garage cars built on the detailed Koncept Z model ----------
 ZB:{civka:{p1:'#16181c',p2:'#2a2c33',rim:'#9aa0a8',fin:'metal',glow:'off',w:.95,sx:.86,sy:1.17,kit:['lip','duck'],hl:'oval',cls:'hatch'},
  felda:{p1:'#3b5d3a',p2:'#cfcbc0',rim:'#cfcbc0',fin:'gloss',glow:'off',w:.95,sx:.85,sy:1.15,kit:['rally','flaps'],cls:'hatch'},
  golfik:{p1:'#b8bcc2',p2:'#7a1e2a',rim:'#2a2a2e',fin:'metal',glow:'off',w:.97,sx:.86,sy:1.14,kit:['lip','skirts'],hl:'blade',cls:'hatch'},
  bavorak:{p1:'#1f3a5f',p2:'#0e0f14',rim:'#c9ccd2',fin:'metal',glow:'off',w:1,sx:1,sy:1.07,kit:['duck','skirts'],hl:'angel',cls:'sedan'},
  imprezka:{p1:'#2a4a8a',p2:'#1a2a5a',rim:'#c9a227',fin:'gloss',glow:'off',w:1,sx:.96,sy:1.09,kit:['wing','scoop','flaps'],hl:'oval',cls:'rally'},
  koncept:{p1:'#7a1e2a',p2:'#14151a',rim:'#d8dbe0',fin:'gloss',glow:'#2a9d8f',w:1,sy:1.09,kit:[],hl:'led',cls:'sport'},
  mini:{p1:'#c9b458',p2:'#14151a',rim:'#e9ecef',fin:'gloss',glow:'off',w:.93,sx:.8,sy:1.16,kit:[],hl:'oval',cls:'hatch'},
  kupe:{p1:'#5b4a8a',p2:'#14151a',rim:'#d8dbe0',fin:'metal',glow:'off',w:1,sx:.92,sy:1.08,kit:['duck','skirts'],rims:'five',hl:'popup',cls:'sport'},
  sedan:{p1:'#d8d8d4',p2:'#2a2c33',rim:'#8a8f98',fin:'metal',glow:'off',w:1.02,sx:1.1,sy:1.08,kit:['lip'],hl:'rings',cls:'sedan'},
  kombi:{p1:'#3b5d3a',p2:'#14151a',rim:'#c9ccd2',fin:'metal',glow:'off',w:1.02,sx:1.14,sy:1.13,kit:['flaps'],rails:1,hl:'blade',cls:'wagon'},
  vitka:{p1:'#c8c8c4',p2:'#2a2c33',rim:'#8a8f98',fin:'gloss',glow:'off',w:1.06,sx:1.12,sy:1.42,kit:[],ladder:1,hl:'blade',cls:'van'},
  muscle:{p1:'#7a1e2a',p2:'#14151a',rim:'#d8dbe0',fin:'gloss',glow:'off',w:1,sx:1.06,sy:1.04,kit:['blower','duck'],rims:'deep',hood:'#111214',roof:'#111214',cal:'#c9a227',hl:'oval',cls:'muscle'},
  blower:{p1:'#1b1c20',p2:'#14151a',rim:'#c9a227',fin:'matte',glow:'off',w:1,sx:1.02,sy:1.02,kit:['blower','duck'],rims:'five',hood:'#8a5a2a',cal:'#b8541a',hl:'popup',cls:'muscle'},
  supka:{p1:'#c08a2a',p2:'#14151a',rim:'#8a8f98',fin:'gloss',glow:'off',w:1.02,sy:1.1,kit:['wing','skirts'],hl:'popup',cls:'sport'}},
 dashMat(orig){if(this.dMat)return this.dMat;const T3=THREE,cv=this.dCv=document.createElement('canvas');cv.width=1024;cv.height=256;const t=this.dTex=new T3.CanvasTexture(cv);t.flipY=false;t.colorSpace=T3.SRGBColorSpace;
  const m=this.dMat=orig.clone();m.emissiveMap=t;m.emissive=new T3.Color(1,1,1);m.emissiveIntensity=1.5;this.dashDraw(0,1,0);return m},
 dashDraw(k,gear,rpm){const cv=this.dCv;if(!cv)return;let rn='';try{rn=Snd.style&&STY[Snd.style]?STY[Snd.style].name:''}catch(e){}const key=k+'|'+gear+'|'+Math.round(rpm*12)+rn;if(key===this.dKey)return;this.dKey=key;const x=cv.getContext('2d');
  x.fillStyle='#000';x.fillRect(0,0,1024,256);const O='#ff7a1a',C='#2ef0ff';
  // rpm segments (left)
  const n=12,lit=Math.round(rpm*n);for(let i=0;i<n;i++){x.fillStyle=i<lit?(i>=10?'#ff2040':i>=8?'#ffd02e':O):'#2a1608';x.fillRect(70+i*24,170-i*9,18,40+i*9)}
  x.fillStyle=O;x.font='bold 30px Oswald,Arial';x.textAlign='left';x.fillText('RPM ×1000',70,236);
  // speed (center)
  x.textAlign='center';x.fillStyle='#fff';x.shadowColor=O;x.shadowBlur=18;x.font='bold 150px Audiowide,Oswald,Arial';x.fillText(String(k),560,178);x.shadowBlur=0;
  x.fillStyle=O;x.font='bold 30px Oswald,Arial';x.fillText('km/h',560,232);
  // gear (right)
  x.strokeStyle=C;x.lineWidth=6;x.strokeRect(800,50,150,150);x.fillStyle=C;x.font='bold 120px Audiowide,Oswald,Arial';x.fillText(gear?String(gear):'N',875,172);
  x.font='bold 26px Oswald,Arial';x.fillText('GEAR',875,236);if(rn){x.fillStyle=C;x.font='bold 30px Oswald,Arial';x.fillText('♪ '+rn,560,40)}this.dTex.needsUpdate=true},
 furTex(col){const k='fur'+col;if(this[k])return this[k];const T3=THREE,cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d');x.fillStyle=col;x.fillRect(0,0,256,256);
  for(let i=0;i<5200;i++){const px=Math.random()*256,py=Math.random()*256,l=Math.random();x.strokeStyle=l<.5?'rgba(255,255,255,'+(.08+l*.25)+')':'rgba(0,0,0,'+((l-.5)*.35)+')';x.lineWidth=1+Math.random()*1.4;x.beginPath();x.moveTo(px,py);x.lineTo(px+(Math.random()-.5)*9,py+3+Math.random()*7);x.stroke()}
  const t=this[k]=new T3.CanvasTexture(cv);t.wrapS=t.wrapT=T3.RepeatWrapping;t.repeat.set(6,1);t.colorSpace=T3.SRGBColorSpace;return t},
 woodTex(){if(this.wTex)return this.wTex;const T3=THREE,cv=document.createElement('canvas');cv.width=512;cv.height=64;const x=cv.getContext('2d');x.fillStyle='#6b3a1c';x.fillRect(0,0,512,64);
  for(let i=0;i<70;i++){x.strokeStyle='rgba('+(30+Math.random()*60|0)+','+(12+Math.random()*25|0)+',5,'+(.25+Math.random()*.4)+')';x.lineWidth=1+Math.random()*2.5;x.beginPath();const y=Math.random()*64;x.moveTo(0,y);for(let q=0;q<=512;q+=32)x.lineTo(q,y+Math.sin(q/40+i)*3);x.stroke()}
  const t=this.wTex=new T3.CanvasTexture(cv);t.wrapS=t.wrapT=T3.RepeatWrapping;t.repeat.set(4,1);t.colorSpace=T3.SRGBColorSpace;return t},
 roundWheel(R,style){const T3=THREE,g=new T3.Group();
  const rimM=style==='fur'?new T3.MeshStandardMaterial({map:this.furTex('#ff4fa3'),roughness:1,metalness:0,color:0xffffff})
   :style==='wood'?new T3.MeshPhysicalMaterial({map:this.woodTex(),roughness:.35,clearcoat:1,clearcoatRoughness:.1})
   :style==='race'?new T3.MeshStandardMaterial({color:0x3a3c42,roughness:.95,metalness:0})
   :new T3.MeshPhysicalMaterial({color:0x16171b,roughness:.62,metalness:0,sheen:1,sheenColor:new T3.Color(0x55585f),sheenRoughness:.6});
  const tube=style==='fur'?R*.15:R*.1,rim=new T3.Mesh(new T3.TorusGeometry(R,tube,12,40),rimM);rim.rotation.y=Math.PI/2;g.add(rim);
  if(style==='fur'){for(let i=0;i<46;i++){const a=i/46*Math.PI*2,b=new T3.Mesh(new T3.IcosahedronGeometry(tube*(.55+Math.random()*.35),0),rimM);b.position.set((Math.random()-.5)*tube*.8,Math.sin(a)*R,Math.cos(a)*R);b.scale.setScalar(1);g.add(b)}}
  const spM=style==='wood'?new T3.MeshStandardMaterial({color:0xd8dbe0,metalness:1,roughness:.18}):new T3.MeshStandardMaterial({color:0x1a1b20,metalness:.6,roughness:.35});
  for(const a of[-Math.PI/2,-.18,Math.PI+.18]){const s=new T3.Mesh(this.carBox,spM);s.scale.set(R*.08,R*.92,R*.16);s.position.set(0,Math.sin(a)*R*.46,Math.cos(a)*R*.46);s.rotation.x=-a+Math.PI/2;g.add(s)}
  {const tr=new T3.Mesh(new T3.TorusGeometry(R*.33,R*.025,8,32),new T3.MeshStandardMaterial({color:0xc8ccd4,metalness:1,roughness:.2}));tr.rotation.y=Math.PI/2;tr.position.x=-R*.12;g.add(tr)}
  const hub=new T3.Mesh(new T3.CylinderGeometry(R*.3,R*.34,R*.22,24),new T3.MeshStandardMaterial({color:0x15161b,metalness:.5,roughness:.4}));hub.rotation.z=Math.PI/2;g.add(hub);
  const mk=new T3.Mesh(this.carBox,new T3.MeshBasicMaterial({color:style==='race'?0xffd400:style==='fur'?0xffffff:0xff2e88}));mk.scale.set(tube*1.2,tube*.9,tube*1.6);mk.position.set(0,R,0);g.add(mk);
  return g},
 interior(sp){if(!sp.dice&&!sp.amb)return null;const T3=THREE,g=new T3.Group();
  if(sp.dice){const hang=new T3.Group();hang.position.set(.2,13.1,0);g.add(hang);const str=new T3.Mesh(this.carBox,new T3.MeshBasicMaterial({color:0x222222}));str.scale.set(.08,2.2,.08);str.position.y=-1.1;hang.add(str);
   const dm=new T3.MeshStandardMaterial({map:this.furTex(sp.dice),roughness:1});for(const z of[-.75,.75]){const d=new T3.Mesh(new T3.BoxGeometry(1.3,1.3,1.3),dm);d.position.set(0,-2.9+(z>0?-.4:0),z);d.rotation.set(.4*z,.6,.3);hang.add(d)}g.userData.dice=hang}
  if(sp.amb){const am=new T3.MeshBasicMaterial({color:new T3.Color(sp.amb).multiplyScalar(.9)});for(const[x,y,zz,len]of[[10.4,8.72,0,13]]){const b=new T3.Mesh(this.carBox,am);if(len===17)b.scale.set(.12,.1,len);else b.scale.set(len,.1,.12);b.position.set(x,y,zz);g.add(b)}}
  return g},
 infoScreen(){const T3=THREE;if(!this.iCv){const cv=this.iCv=document.createElement('canvas');cv.width=640;cv.height=300;const t=this.iTex=new T3.CanvasTexture(cv);t.colorSpace=T3.SRGBColorSpace;
   this.iMat=new T3.MeshBasicMaterial({map:t,toneMapped:false,side:T3.DoubleSide});this.iMat.color.setScalar(.85);this.iFrame=new T3.MeshStandardMaterial({color:0x0c0d10,metalness:.6,roughness:.35})}
  const g=new T3.Group();g.position.set(13.6,10.75,4.4);g.rotation.order='YXZ';g.rotation.y=-Math.PI/2-.42;g.rotation.x=-.12;g.scale.setScalar(.62);
  const fr=new T3.Mesh(this.carBox,this.iFrame);fr.scale.set(6.3,3.05,.12);fr.position.z=-.09;g.add(fr);const sc=new T3.Mesh(new T3.PlaneGeometry(6,2.8),this.iMat);g.add(sc);g.userData.sc=sc;return g},
 infoDraw(t){const cv=this.iCv;if(!cv||t-(this.iT||0)<.25)return;this.iT=t;const x=cv.getContext('2d'),W=640,H=300;x.fillStyle='#161b28';x.fillRect(0,0,W,H);
  const mm=document.getElementById('mm');if(mm){x.save();x.beginPath();x.roundRect?x.roundRect(10,10,370,280,14):x.rect(10,10,370,280);x.clip();x.drawImage(mm,0,(mm.height-mm.width*280/370)/2,mm.width,mm.width*280/370,10,10,370,280);x.restore()}
  x.fillStyle='#e9ecf2';x.font='600 26px Oswald,Arial';x.textAlign='left';const d=new Date(),lo=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');let pr=lo;try{pr=new Intl.DateTimeFormat('cs-CZ',{timeZone:'Europe/Prague',hour:'2-digit',minute:'2-digit'}).format(d)}catch(e){}
  x.fillText(lo,400,40);x.fillStyle='#8a90a6';x.font='500 18px Oswald,Arial';x.fillText(pr===lo?'Praha':'Praha '+pr,476,40);
  let rn='';try{rn=Snd.style&&STY[Snd.style]?STY[Snd.style].name:''}catch(e){}x.fillStyle='#2ef0ff';x.font='700 24px Oswald,Arial';x.fillText('♪ RÁDIO',400,96);x.fillStyle='#fff';x.font='700 30px Oswald,Arial';x.fillText(rn.slice(0,16),400,132);
  let ins=null;try{ins=NAV.ins}catch(e){}if(ins){x.fillStyle='#ffcc1a';x.fillRect(392,160,240,128);x.fillStyle='#111';x.font='700 54px Arial';x.fillText(ins.a,402,222);x.font='700 34px Oswald,Arial';x.fillText(ins.s==='Otoč se'?'OTOČ':ins.d<1000?Math.max(10,Math.round(ins.d/10)*10)+' m':(ins.d/1000).toFixed(1)+' km',466,214);
   x.font='600 18px Oswald,Arial';x.fillText((ins.s||'').slice(0,24),402,252);x.fillText(('→ '+(ins.c||'')).slice(0,24),402,276)}else{x.fillStyle='#8a90a6';x.font='600 20px Oswald,Arial';x.fillText('🧭 Klepni pro navigaci',400,210)}
  x.strokeStyle='#2a2e3c';x.lineWidth=2;x.beginPath();x.moveTo(390,150);x.lineTo(630,150);x.stroke();this.iTex.needsUpdate=true},
 setNav(P){const T3=THREE;if(this.navM){this.scene.remove(this.navM);this.navM.geometry.dispose();this.navM=null}if(!P||P.length<2)return;
  const pos=[],uv=[],W=4.5,Y=1.4;let acc=0;for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,nx=-dy/l*W,ny=dx/l*W,u0=acc/60,u1=(acc+l)/60;acc+=l;
   pos.push(a.x+nx,Y,a.y+ny,b.x+nx,Y,b.y+ny,b.x-nx,Y,b.y-ny,a.x+nx,Y,a.y+ny,b.x-nx,Y,b.y-ny,a.x-nx,Y,a.y-ny);uv.push(u0,0,u1,0,u1,1,u0,0,u1,1,u0,1)}
  const g=new T3.BufferGeometry();g.setAttribute('position',new T3.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T3.Float32BufferAttribute(uv,2));
  if(!this.navMat){const cv=document.createElement('canvas');cv.width=64;cv.height=32;const x=cv.getContext('2d');x.fillStyle='rgba(255,204,26,.55)';x.fillRect(0,0,64,32);x.fillStyle='rgba(255,236,150,1)';x.beginPath();x.moveTo(16,4);x.lineTo(40,16);x.lineTo(16,28);x.lineTo(24,16);x.closePath();x.fill();
   const t=this.navTex=new T3.CanvasTexture(cv);t.wrapS=T3.RepeatWrapping;t.colorSpace=T3.SRGBColorSpace;this.navMat=new T3.MeshBasicMaterial({map:t,color:new T3.Color(1,1,1).multiplyScalar(1.4),transparent:true,depthWrite:false,side:T3.DoubleSide,fog:false})}
  this.navM=new T3.Mesh(g,this.navMat);this.navM.renderOrder=3;this.scene.add(this.navM)},
 // parked cars: real Kenney models, instanced per (model, colour) so the whole city costs a few draw calls
 parkedKenney(){if(this.pkDone||!this.kReady||!parked.length)return;this.pkDone=1;const T3=THREE,mods=['sedan','hatchback_sports','suv','sedan_sports','van'].filter(n=>this.km[n]);if(!mods.length)return;
  const cols=['#8a1c1c','#d8d8d8','#2a3d6b','#3b3b3b','#1f5a4f','#c9a227'],grp=new Map();parked.forEach((p,i)=>{const k=mods[(i*7)%mods.length]+'|'+cols[(i*5+3)%cols.length];if(!grp.has(k))grp.set(k,[]);grp.get(k).push(p)});
  const M=new T3.Matrix4(),Q=new T3.Quaternion(),V=new T3.Vector3(),ONE=new T3.Vector3(1,1,1),AX=new T3.Vector3(0,1,0);
  for(const[k,list]of grp){const[nm,col]=k.split('|');const proto=this.kenneyMesh({L:38,Wd:19,col,kind:'civ',st:{}},nm);this.scene.remove(proto);proto.updateMatrixWorld(true);const U=proto.userData;
   proto.traverse(o=>{if(!o.isMesh||o===U.beam||o===U.fl||o===U.glow||o.material===this.hlMat)return;const im=new T3.InstancedMesh(o.geometry,o.material,list.length);
    list.forEach((p,i)=>{Q.setFromAxisAngle(AX,-p.a);M.compose(V.set(p.x,0,p.y),Q,ONE);M.multiply(o.matrixWorld);im.setMatrixAt(i,M)});im.computeBoundingSphere&&im.computeBoundingSphere();this.scene.add(im)})}
  if(this.parkedBox){for(const m of this.parkedBox)this.scene.remove(m)}},
 // number plates (Czech style, region U = Ústí), made once per text
 plateMat(txt){this.plates=this.plates||{};if(this.plates[txt])return this.plates[txt];const T3=THREE,cv=document.createElement('canvas');cv.width=256;cv.height=56;const x=cv.getContext('2d');
  x.fillStyle='#f4f4f0';x.fillRect(0,0,256,56);x.strokeStyle='#111';x.lineWidth=3;x.strokeRect(2,2,252,52);x.fillStyle='#1d3fa8';x.fillRect(3,3,30,50);x.fillStyle='#ffd400';for(let i=0;i<8;i++){const a=i/8*6.283;x.fillRect(16+Math.cos(a)*8-1,16+Math.sin(a)*8-1,2.4,2.4)}
  x.fillStyle='#fff';x.font='bold 13px Arial';x.textAlign='center';x.fillText('CZ',18,46);x.fillStyle='#111';let fs=36;do{x.font='bold '+fs+'px Arial';fs-=2}while(x.measureText(txt).width>212&&fs>12);x.fillText(txt,146,40);
  const t=new T3.CanvasTexture(cv);t.colorSpace=T3.SRGBColorSpace;t.anisotropy=4;return this.plates[txt]=new T3.MeshStandardMaterial({map:t,roughness:.45,metalness:.1})},
 loadGarageSpecs(){for(const id in this.ZB)fetch('models/garage/'+id+'/car.json').then(r=>r.ok?r.json():null).then(j=>{if(j){const o=Object.assign({},j);delete o.parts;delete o.id;delete o.platform;delete o.name;Object.assign(this.ZB[id],o)}}).catch(()=>{})},
 calM(col){this.cals=this.cals||{};return this.cals[col]||(this.cals[col]=new THREE.MeshStandardMaterial({color:col,metalness:.3,roughness:.35}))},
 // procedural rims in the Koncept wheel's local space (axle = x, radius 0.30, outer face at +x)
 rimSet(style,face){const T3=THREE,g=new T3.Group();const BP=this.parts&&this.parts['rim_'+style];if(BP){const r=BP.clone(true);r.scale.setScalar(.292);r.traverse(o=>{if(o.isMesh&&o.material&&o.material.name==='Face')o.material=face});const out=new T3.Group(),mir=r.clone(true);mir.scale.x=-.292;out.add(r,mir);return out}const k=style;this.rimG=this.rimG||{};const RG=this.rimG;
  if(!RG.barrel){RG.barrel=new T3.CylinderGeometry(.292,.292,.2,32,1,true);RG.barrel.rotateZ(Math.PI/2);RG.lip=new T3.TorusGeometry(.292,.014,6,40);RG.lip.rotateY(Math.PI/2);RG.hub=new T3.CylinderGeometry(.065,.075,.05,16);RG.hub.rotateZ(Math.PI/2);RG.nut=new T3.CylinderGeometry(.012,.012,.03,6);RG.nut.rotateZ(Math.PI/2);
   RG.dish=new T3.CylinderGeometry(.292,.22,.07,32,1,true);RG.dish.rotateZ(-Math.PI/2);RG.box=new T3.BoxGeometry(1,1,1)}
  const inner=this.rimIn||(this.rimIn=new T3.MeshStandardMaterial({color:0x2a2b30,metalness:.8,roughness:.4,side:T3.DoubleSide})),chrome=this.chromeM||(this.chromeM=new T3.MeshStandardMaterial({color:0xd8dbe0,metalness:1,roughness:.15}));
  const add=(geo,mat,x,y,z,sx,sy,sz,rx)=>{const m=new T3.Mesh(geo,mat);m.position.set(x,y,z);if(sx)m.scale.set(sx,sy,sz);if(rx)m.rotation.x=rx;g.add(m);return m};
  if(!RG.back){RG.back=new T3.CircleGeometry(.285,32);RG.back.rotateY(Math.PI/2)}const dark=this.rimDark||(this.rimDark=new T3.MeshStandardMaterial({color:0x18191e,metalness:.5,roughness:.55,side:T3.DoubleSide}));
  add(RG.barrel,inner,.0,0,0);add(RG.back,dark,.03,0,0);add(RG.lip,k==='deep'?chrome:face,.1,0,0);add(RG.hub,face,.08,0,0);
  for(let i=0;i<5;i++){const a=i/5*6.283;add(RG.nut,chrome,.1,Math.sin(a)*.04,Math.cos(a)*.04)}
  const spoke=(n,w,t,x,twist,len)=>{for(let i=0;i<n;i++){const a=i/n*6.283,r=(len||.24)/2+.05;const m=add(RG.box,face,x,Math.sin(a)*r,Math.cos(a)*r,t,len||.24,w,-a);if(twist)m.rotation.y=twist}};
  if(k==='five'){spoke(5,.11,.05,.075);for(let i=0;i<5;i++){const a=(i+.5)/5*6.283,r=.17;add(RG.box,face,.08,Math.sin(a)*r,Math.cos(a)*r,.02,.12,.018,-a)}}
  else if(k==='mesh'){for(const off of[.18,-.18]){for(let i=0;i<10;i++){const a=i/10*6.283+off;const m=add(RG.box,face,.075,Math.sin(a)*.17,Math.cos(a)*.17,.03,.25,.04,-a-off*2)}}add(RG.lip,face,.09,0,0,.75,.75,.75)}
  else if(k==='deep'){add(RG.dish,chrome,.08,0,0);spoke(6,.06,.04,.05,0,.17)}
  else if(k==='turbine'){for(let i=0;i<14;i++){const a=i/14*6.283,r=.17;const m=add(RG.box,face,.075,Math.sin(a)*r,Math.cos(a)*r,.035,.24,.06,-a);m.rotation.y=.5}}
  const mir=g.clone();mir.scale.x=-1;const out=new T3.Group();out.add(g,mir);return out},
 // locked "coming soon" vehicles: dark silhouettes in the garage
 soonMesh(def){const T3=THREE,g=new T3.Group(),D=this.silM||(this.silM=new T3.MeshStandardMaterial({color:0x08080b,metalness:.6,roughness:.35}));
  const box=(sx,sy,sz,x,y,z,rx,ry,rz)=>{const m=new T3.Mesh(this.carBox,D);m.scale.set(sx,sy,sz);m.position.set(x,y,z);m.rotation.set(rx||0,ry||0,rz||0);g.add(m);return m};
  const cyl=(r1,r2,h,x,y,z,rz,rx)=>{const m=new T3.Mesh(new T3.CylinderGeometry(r1,r2,h,16),D);m.position.set(x,y,z);if(rz)m.rotation.z=rz;if(rx)m.rotation.x=rx;g.add(m);return m};
  const wheel=(r,w,x,y,z)=>{const m=new T3.Mesh(new T3.CylinderGeometry(r,r,w,20),D);m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m)};
  const t=def.soon;
  if(t==='kenney'){if(!this.kReady||!this.km[def.kenney])return null;const k=this.kenneyMesh({L:def.L,Wd:def.Wd,col:'#111',kind:'civ',st:{}},def.kenney);k.userData.beam.visible=false;k.traverse(o=>{if(o.isMesh&&o.material!==this.shMat)o.material=D});return k}
  if(t==='tank'){if(false&&this.tankM){const m=this.tankM.clone(true),b=new T3.Box3().setFromObject(m),sz=b.getSize(new T3.Vector3()),k=def.L/Math.max(sz.x,sz.z);m.scale.setScalar(k);m.position.y=-b.min.y*k;if(sz.z>sz.x)m.rotation.y=Math.PI/2;m.traverse(o=>{if(o.isMesh)o.material=D});g.add(m);return g}
   box(46,10,26,0,7,0);box(28,8,20,-2,16,0);cyl(1.3,1.3,30,16,17,0,Math.PI/2);for(const z of[-12,12])box(48,6,5,0,4,z);return g}
  if(t==='armor'){box(40,12,22,0,11,0);box(22,7,20,-4,20,0);box(10,6,20,18,15,0,0,0,-.5);box(6,5,6,-6,26,0);cyl(.6,.6,14,4,26,0,Math.PI/2);for(const x of[-14,0,14])for(const z of[-11,11])wheel(5,4,x,5,z);return g}
  if(t==='heli'){const b=new T3.Mesh(new T3.SphereGeometry(1,20,14),D);b.scale.set(13,8,7.5);b.position.set(4,14,0);g.add(b);box(28,2.4,2.4,-18,15,0);box(5,8,1,-31,19,0);box(1,7,7,-31,19,2,0,0,0);
   cyl(.6,.6,5,4,23,0);box(60,.4,2.6,4,25.5,0,0,.4,0);box(60,.4,2.6,4,25.5,0,0,-1.17,0);for(const z of[-6,6]){box(26,1,1,4,3,z);box(1,6,1,-2,6,z);box(1,6,1,10,6,z)}return g}
  if(t==='jet'){cyl(.6,3.4,40,6,10,0,-Math.PI/2);cyl(3.4,3.2,14,-17,10,0,Math.PI/2);const w=new T3.Mesh(new T3.CylinderGeometry(0,22,.8,3),D);w.rotation.y=Math.PI/6+Math.PI;w.scale.set(1,1,1.4);w.position.set(-8,9,0);g.add(w);
   box(9,10,.7,-21,16,0,0,0,.45);box(7,7,.6,-20,14,5,.6,0,.4);box(7,7,.6,-20,14,-5,-.6,0,.4);const c=new T3.Mesh(new T3.SphereGeometry(1,14,10),D);c.scale.set(7,2.6,2.6);c.position.set(9,13,0);g.add(c);for(const x of[10,-10])box(1,5,1,x,4,0);return g}
  if(t==='plane'){cyl(3,1.4,30,0,11,0,Math.PI/2);box(9,.8,48,4,16,0);for(const z of[-8,8])box(.8,6,.8,4,13,z,0,0,.3);box(6,6,.6,-15,15,0);box(5,.5,14,-15,12,0);cyl(1.8,1.8,1.4,15.8,11,0,Math.PI/2);box(.5,12,1.4,16.6,11,0);
   for(const z of[-4,4])wheel(1.8,1,6,2,z);wheel(1.2,.8,-13,2,0);return g}
  if(t==='moto'||t==='chopper'){const ch=t==='chopper';wheel(ch?4.6:4.4,1.6,ch?11:9,4.6,0);wheel(4.6,ch?2.6:1.8,ch?-10:-8,4.6,0);
   if(ch){box(14,2,2,0,8,0,0,0,.1);box(2,12,1.2,9,10,0,0,0,-.6);box(1,1,10,6,16,0);box(8,1.6,4,-3,9.5,0);box(6,3,4.6,-9,11,0)}
   else{box(16,6,3.4,0,9,0,0,0,-.15);box(7,4,3.6,7,11,0,0,0,.5);box(8,2,3.6,-6,11.6,0);box(1,1,7,8,13.5,0);box(3,1.6,3,-11,9.6,0)}return g}
  return null},
 waterMat(){if(this.wMat)return this.wMat;const T3=THREE,cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,256,256);
  for(let i=0;i<900;i++){const px=Math.random()*256,py=Math.random()*256,l=Math.random();x.strokeStyle=`rgba(${l>.5?255:0},${l>.5?255:0},${l>.5?255:0},${.08+Math.random()*.15})`;x.lineWidth=1+Math.random()*2;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+8,py-3,px+18+Math.random()*14,py);x.stroke()}
  const t=new T3.CanvasTexture(cv);t.wrapS=t.wrapT=T3.RepeatWrapping;this.wTexW=t;
  const m=this.wMat=new T3.MeshStandardMaterial({color:0x2f6d8c,metalness:.6,roughness:.12,transparent:true,opacity:.92,emissive:0x0a2a3a,envMapIntensity:1.6});
  this.wU={uT:{value:0},uR:{value:t}};m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,this.wU);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWW=(modelMatrix*vec4(position,1.)).xyz;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uT;uniform sampler2D uR;varying vec3 vWW;')
    .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{vec2 q=vWW.xz;float a=texture2D(uR,q/180.+vec2(uT*.02,uT*.013)).r,b=texture2D(uR,q/97.-vec2(uT*.017,-uT*.024)).r;vec3 pn=normalize(vec3((a-.5)*.9,1.,(b-.5)*.9));normal=normalize((viewMatrix*vec4(pn,0.)).xyz);}')
    .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec2 q=vWW.xz;float s=texture2D(uR,q/60.+vec2(uT*.05,0.)).r;totalEmissiveRadiance+=vec3(.35,.55,.7)*smoothstep(.72,.95,s)*.6;}')};
  m.customProgramCacheKey=()=>'water';return m},
 lamps(kit,sp,paint,c){const T3=THREE,st=sp.hl||'stock';if(st==='stock')return;
  const L=this.lampMats||(this.lampMats={on:new T3.MeshBasicMaterial({color:new T3.Color(0xf2f7ff).multiplyScalar(2.6)}),hou:new T3.MeshPhysicalMaterial({color:0x0b0c10,metalness:.9,roughness:.15,clearcoat:1}),lens:new T3.MeshPhysicalMaterial({color:0xcfe4ff,metalness:.1,roughness:.02,transparent:true,opacity:.35,clearcoat:1})});
  const pop=[];for(const sd of[-1,1]){const G=new T3.Group();const hp=kit.userData.snap&&kit.userData.snap([40,7.9,sd*6.4],[-1,0,0]);G.position.set(hp?hp.x-.05:21.15,7.9,sd*6.4);G.rotation.y=sd*.18;kit.add(G);const add=(geo,m,x,y,z,sx,sy,sz,rx,ry,rz)=>{const q=new T3.Mesh(geo,m);q.position.set(x,y,z);q.scale.set(sx||1,sy||1,sz||1);q.rotation.set(rx||0,ry||0,rz||0);G.add(q);return q};
   const S=this.lampG||(this.lampG={sph:new T3.SphereGeometry(1,20,14),tor:new T3.TorusGeometry(.55,.1,8,28),cyl:new T3.CylinderGeometry(1,1,1,20)});
   if(st==='slim'&&this.parts&&this.parts.headlight_slim){const h=this.parts.headlight_slim.clone(true);h.scale.set(1,1,sd);h.traverse(o=>{if(o.isMesh){const n=o.material.name;o.material=n==='Light'?L.on:n==='Chrome'?(this.chromeM||(this.chromeM=new T3.MeshStandardMaterial({color:0xd8dbe0,metalness:1,roughness:.15}))):L.hou}});G.add(h);G.rotation.y=sd*.12;G.position.y=8.1;continue}
   if(st==='rings'){add(this.carBox,L.hou,-.1,0,0,.4,1.5,4.6);for(let i=0;i<3;i++)add(S.tor,L.on,.15,0,(i-1)*1.25,1,1,1,0,Math.PI/2)}
   else if(st==='blade'){add(this.carBox,L.hou,-.1,.1,0,.4,1.2,4.8);add(this.carBox,L.on,.15,.55,-.1,.12,.16,4.6,sd*.12);add(this.carBox,L.on,.15,-.25,sd*.6,.12,.14,2.6,sd*.05);for(let i=0;i<3;i++)add(S.sph,L.on,.15,-.25,-sd*(.8+i*.5),.12,.12,.12)}
   else if(st==='oval'){add(S.sph,L.hou,-.15,0,0,.55,1.05,2.6);add(S.sph,L.lens,.05,0,0,.5,1,2.5);for(const z of[-.95,.95]){add(S.sph,L.on,.1,0,z,.25,.55,.55);add(S.sph,L.hou,.32,0,z,.05,.22,.22)}}
   else if(st==='led'){add(this.carBox,L.hou,-.1,.1,0,.4,1.1,4.4);add(this.carBox,L.on,.15,.5,0,.12,.16,4.2);for(let i=0;i<4;i++)add(this.carBox,L.on,.15,-.1,(i-1.5)*.9,.12,.5,.55)}
   else if(st==='angel'){add(S.sph,L.hou,-.15,0,0,.5,1,2.6);for(const z of[-.95,.95]){add(S.tor,L.on,.2,0,z,1,1,1,0,Math.PI/2);add(S.sph,L.on,.12,0,z,.15,.3,.3)}}
   else if(st==='popup'){const hy=kit.userData.snap&&kit.userData.snap([19.6,30,sd*6.4],[0,-1,0]);G.position.set(19.6,(hy?hy.y:10.2)-.05,sd*6.4);G.rotation.y=0;const hinge=new T3.Group();hinge.position.set(-1.6,0,0);G.add(hinge);const P=new T3.Group();P.position.set(1.6,0,0);hinge.add(P);
    const lid=new T3.Mesh(this.carBox,paint);lid.scale.set(3,.18,3.2);lid.position.set(0,.05,0);P.add(lid);const box2=new T3.Mesh(this.carBox,L.hou);box2.scale.set(.4,1.3,3);box2.position.set(1.4,-.6,0);P.add(box2);
    for(const z of[-.8,.8]){const b=new T3.Mesh(S.sph,L.on);b.scale.set(.15,.5,.5);b.position.set(1.62,-.55,z);P.add(b)}pop.push(hinge)}}
  kit.userData.pop=pop.length?pop:null},
 PATS:{},patTex(k){if(this.PATS[k])return this.PATS[k];const T3=THREE,cv=document.createElement('canvas');cv.width=cv.height=512;const x=cv.getContext('2d'),R=Math.random;
  if(k==='army'){x.fillStyle='#5b6340';x.fillRect(0,0,512,512);for(const c of['#3e4630','#7a6e4e','#2a2a22','#8a8460'])for(let i=0;i<26;i++){x.fillStyle=c;x.beginPath();const cx=R()*512,cy=R()*512;for(let a=0;a<6.3;a+=.5){const r=20+R()*35;x.lineTo(cx+Math.cos(a)*r*1.5,cy+Math.sin(a)*r)}x.fill()}}
  else if(k==='zebra'){x.fillStyle='#ecebe6';x.fillRect(0,0,512,512);x.fillStyle='#141414';for(let i=-2;i<22;i++){x.beginPath();const y0=i*26;x.moveTo(0,y0);for(let xx=0;xx<=512;xx+=16)x.lineTo(xx,y0+Math.sin(xx/40+i)*14);for(let xx=512;xx>=0;xx-=16)x.lineTo(xx,y0+11+Math.sin(xx/40+i)*14+Math.sin(xx/17)*4);x.fill()}}
  else if(k==='panter'){x.fillStyle='#1a1a1c';x.fillRect(0,0,512,512);for(let i=0;i<150;i++){const cx=R()*512,cy=R()*512,r=8+R()*10;x.strokeStyle='rgba(60,50,36,.95)';x.lineWidth=4+R()*3;x.beginPath();x.arc(cx,cy,r,R()*2,R()*2+4.6);x.stroke()}}
  else if(k==='leopard'){x.fillStyle='#c8a05a';x.fillRect(0,0,512,512);for(let i=0;i<150;i++){const cx=R()*512,cy=R()*512,r=7+R()*9;x.fillStyle='#8a5a28';x.beginPath();x.arc(cx,cy,r,0,7);x.fill();x.strokeStyle='#1a1410';x.lineWidth=3+R()*2;x.beginPath();x.arc(cx,cy,r+2,R()*2,R()*2+4.4);x.stroke()}}
  else if(k==='croc'){x.fillStyle='#2f4a2a';x.fillRect(0,0,512,512);for(let yy=0;yy<512;yy+=28)for(let xx=(yy/28%2)*20;xx<512;xx+=40){const g=x.createRadialGradient(xx+18,yy+12,2,xx+18,yy+12,22);g.addColorStop(0,'#5a7a44');g.addColorStop(1,'#1c2c18');x.fillStyle=g;x.beginPath();x.ellipse(xx+18,yy+12,18,12,0,0,7);x.fill()}}
  const t=new T3.CanvasTexture(cv);t.wrapS=t.wrapT=T3.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=T3.SRGBColorSpace;return this.PATS[k]=t},
 tuneKey(id){const t=typeof SAVE!=='undefined'&&SAVE.tune&&SAVE.tune[id];return(t?JSON.stringify(t):'')+'#'+(this.partsV||0)},
 zSpec(id,tune){const b=this.ZB[id]||this.ZB.koncept,t=tune||{},o=Object.assign({},b,t);let kit=b.kit.slice();if(t.wing===1&&!kit.includes('wing'))kit=kit.filter(k=>k!=='duck').concat('wing');if(t.wing===0)kit=kit.filter(k=>k!=='wing');o.kit=kit;return o},
 zMesh(c,sp,noAdd){const T3=THREE,L=c.L,bx=sp.sx||1,by=sp.sy||1,zs=L/(46*bx),zw=(sp.w||1)*(sp.armor?1.04:1),g=new T3.Group(),m=this.concept.clone(true),B=this.zB;
  const FIN={gloss:[.3,.22,1,.03],matte:[.05,.7,0,.5],metal:[.8,.28,1,.06],chrome:[1,.04,1,.02]},f=FIN[sp.fin]||FIN.gloss;
  const MET={'#c9a227':[1,.18],'#b76e79':[1,.2],'#d8dbe0':[1,.05]},mt=MET[(sp.p1||'').toLowerCase()];
  const paint=new T3.MeshPhysicalMaterial({color:sp.p1,metalness:mt?mt[0]:f[0],roughness:mt?mt[1]:f[1],clearcoat:f[2],clearcoatRoughness:f[3],envMapIntensity:(sp.fin==='chrome'||mt)?1.6:1.1});
  if(sp.pat&&sp.pat!=='none'){paint.map=this.patTex(sp.pat);paint.color.set(0xffffff);paint.metalness=Math.min(paint.metalness,.3)}
  const paint2=new T3.MeshPhysicalMaterial({color:sp.p2,metalness:.3,roughness:.55,clearcoat:.25,clearcoatRoughness:.3,envMapIntensity:.45});
  const rim=new T3.MeshStandardMaterial({color:sp.rim,metalness:.65,roughness:.28,envMapIntensity:1.6});
  const tint=sp.tint?new T3.MeshPhysicalMaterial({color:0x020305,metalness:.3,roughness:.04,transparent:true,opacity:.93,envMapIntensity:1.6,side:T3.DoubleSide}):null;
  const anc=(o,re)=>{for(let q=o;q;q=q.parent)if(re.test(q.name||''))return true;return false};
  const pm=(col)=>new T3.MeshPhysicalMaterial({color:col,metalness:f[0],roughness:f[1],clearcoat:f[2],clearcoatRoughness:f[3]}),roofM=sp.roof?pm(sp.roof):null,hoodM=sp.hood?pm(sp.hood):null,mirM=sp.mir?pm(sp.mir):null;
  const trimM=sp.trim==='chrome'?(this.chromeM||(this.chromeM=new T3.MeshStandardMaterial({color:0xd8dbe0,metalness:1,roughness:.15}))):sp.trim==='black'?(this.trimBlk||(this.trimBlk=new T3.MeshStandardMaterial({color:0x0c0c0e,metalness:.3,roughness:.5}))):null;
  const wheels=[];m.traverse(o=>{if(o.isMesh&&o.material){const n=o.material.name||'',painted=/^Paint [12]/.test(n);
   if(painted&&roofM&&anc(o,/^BodyRoofPanel$/)){o.material=roofM;return}if(painted&&hoodM&&anc(o,/^BodyHood$/)){o.material=hoodM;return}if(painted&&mirM&&anc(o,/Mirror/)){o.material=mirM;return}
   if(trimM&&anc(o,/Gasket|Handle/)){o.material=trimM;return}
   if(o.name==='BodyUnderside'||n==='Panel Sides'||(n==='Panel'&&anc(o,/^InteriorFloor$/))){o.material=this.undM||(this.undM=new T3.MeshStandardMaterial({color:0x0b0b0d,roughness:.85,metalness:.2}));return}if(/^Paint 1/.test(n))o.material=paint;else if(/^Paint 2/.test(n))o.material=paint2;else if(n==='Rim2')o.material=rim;else if(n==='Brake'&&sp.cal){o.material=this.calM(sp.cal)}else if(n==='Dashboard')o.material=this.dashMat(o.material);else if(tint&&n==='Glass'&&!anc(o,/Windshield/))o.material=tint}
   if(/^Wheel(Front|Rear)[LR]$/.test(o.name)){o.userData.front=/Front/.test(o.name);wheels.push(o)}});
  let swSpin=null;{const parts=[];m.traverse(o=>{if(/^InteriorSteering(Wheel0\d|Handle[LR]|Emblem|Base)$/.test(o.name))parts.push(o)});
   if(parts.length){m.updateMatrixWorld(true);const bb=new T3.Box3();for(const o of parts)bb.expandByObject(o);const ct=bb.getCenter(new T3.Vector3());
    const tilt=new T3.Group();tilt.position.copy(ct);tilt.rotation.z=-.38;m.add(tilt);swSpin=new T3.Group();tilt.add(swSpin);m.updateMatrixWorld(true);for(const o of parts){swSpin.attach(o);o.visible=false}
    const sz=bb.getSize(new T3.Vector3()),R=2.05;swSpin.add(this.roundWheel(R,sp.sw||'sport'))}}
  let scrM=null;if(c.kind==='player'){const scr=this.infoScreen();if(scr){m.add(scr);scrM=scr.userData.sc}}
  let diceG=null;{const it=this.interior(sp);if(it){m.add(it);diceG=it.userData.dice||null}}
  if(sp.seat){const sm=new T3.MeshStandardMaterial({color:sp.seat,roughness:.7,metalness:0});m.traverse(o=>{if(o.isMesh&&o.material&&/^Interior 3/.test(o.material.name||''))o.material=sm})}
  if(sp.rims&&sp.rims!=='stock')for(const wn of wheels){wn.traverse(o=>{if(/Rim$/.test(o.name))o.visible=false});wn.add(this.rimSet(sp.rims,rim))}
  // chassis: wheels hang on knuckles, knuckles on front/rear axles under the body; the body rolls on top
  const lo=sp.low?.8*zs:0,WG=new T3.Group();m.updateMatrixWorld(true);let wy=0;const P=new T3.Vector3(),knF=[],kn=[],ax={f:[],r:[]};
  for(const wn of wheels){wn.getWorldPosition(P);wy=P.y;const k=new T3.Group();k.position.set(P.x*bx,P.y,P.z*zw*1.05);k.scale.z=1.15;const h=new T3.Group();wn.parent.matrixWorld.decompose(h.position,h.quaternion,h.scale);h.position.sub(P);h.add(wn);k.add(h);WG.add(k);kn.push(k);(wn.userData.front?ax.f:ax.r).push(k);if(wn.userData.front)knF.push(k)}
  {if(!this.chasM){this.chasM=new T3.MeshStandardMaterial({color:0x1a1b1e,metalness:.7,roughness:.45});this.chasL=new T3.MeshStandardMaterial({color:0x3a3d44,metalness:.85,roughness:.3})}const B=(m2,sx,sy,sz,x,y,z,ry)=>{const q=new T3.Mesh(this.carBox,m2);q.scale.set(sx,sy,sz);q.position.set(x,y,z);if(ry)q.rotation.y=ry;WG.add(q);return q};
   for(const k of['f','r']){const L2=ax[k];if(L2.length<2)continue;const a=L2[0].position,b=L2[1].position,cx=(a.x+b.x)/2,w2=Math.abs(a.z-b.z)-2.6;
    const shaft=new T3.Mesh(this.axG||(this.axG=new T3.CylinderGeometry(.32,.32,1,10)),this.chasL);shaft.rotation.x=Math.PI/2;shaft.scale.y=w2;shaft.position.set(cx,a.y,0);WG.add(shaft);
    B(this.chasM,2.2,2.2,3.2,cx,a.y,0);for(const s2 of[-1,1]){B(this.chasL,.5,.35,w2*.42,cx+1.2,a.y-.9,s2*w2*.26);B(this.chasL,.5,.35,w2*.42,cx-1.2,a.y-.9,s2*w2*.26);const sh=B(this.chasL,.45,4.2,.45,cx,a.y+2,s2*(w2/2-.6));sh.rotation.x=s2*.25}}
   if(ax.f.length&&ax.r.length){const xf=ax.f[0].position.x,xr=ax.r[0].position.x,y=ax.f[0].position.y;const ds=new T3.Mesh(this.axG,this.chasL);ds.rotation.z=Math.PI/2;ds.scale.y=xf-xr-4;ds.position.set((xf+xr)/2,y-.4,0);WG.add(ds);
    B(this.chasM,xf-xr+6,.5,Math.abs(ax.f[0].position.z)*1.5,(xf+xr)/2,y-1.6,0)}}
  const dy=wy*(by-1)*zs-(sp.lift??.55)*zs;m.scale.set(zs*bx,zs*by,zs*zw);m.position.y=-lo-dy;WG.scale.set(zs,zs,zs);
  const ch=new T3.Group();ch.add(m);g.add(ch,WG);
  const kit=new T3.Group();kit.scale.set(zs*bx,zs*by,zs*zw);kit.position.y=-lo-dy;ch.add(kit);g.userData_kn=knF;
  if(sp.rails){const rm=this.carbon||(this.carbon=new T3.MeshPhysicalMaterial({color:0x0b0c0f,metalness:.4,roughness:.35,clearcoat:1,clearcoatRoughness:.1}));for(const z of[-5.6,5.6]){const r=new T3.Mesh(this.carBox,rm);r.scale.set(16,.45,.5);r.position.set(-6,14,z);kit.add(r)}}
  if(sp.ladder){const rm=this.chromeM||(this.chromeM=new T3.MeshStandardMaterial({color:0xd8dbe0,metalness:1,roughness:.15}));for(let i=0;i<5;i++){const r=new T3.Mesh(this.carBox,rm);r.scale.set(.3,.3,11);r.position.set(-8+i*3.6,14.2,0);kit.add(r)}}
  if(!this.carbon)this.carbon=new T3.MeshPhysicalMaterial({color:0x0b0c0f,metalness:.4,roughness:.35,clearcoat:1,clearcoatRoughness:.1});
  const box=(mat,sx,sy,sz,x,y,z,rz)=>{const b=new T3.Mesh(this.carBox,mat);b.scale.set(sx,sy,sz);b.position.set(x,y,z);if(rz)b.rotation.z=rz;kit.add(b);return b};
  const K=sp.kit||[],wm=sp.wingCol==='paint'?paint:this.carbon;
  if(K.includes('wing')){if(!this.wingG){const af=new T3.Shape();af.moveTo(-2.3,0);af.bezierCurveTo(-2,.55,.6,.62,2.3,.1);af.lineTo(2.3,-.05);af.bezierCurveTo(.6,.15,-1.6,-.18,-2.3,0);
    this.wingG=new T3.ExtrudeGeometry(af,{depth:19.6,bevelEnabled:false,curveSegments:10});this.wingG.translate(0,0,-9.8);
    const ep=new T3.Shape();ep.moveTo(-3.2,-1.2);ep.lineTo(2.6,-1.2);ep.quadraticCurveTo(3.4,-1.1,3.2,.2);ep.lineTo(2.4,1.6);ep.lineTo(-2.4,1.9);ep.quadraticCurveTo(-3.4,1.7,-3.3,.6);ep.closePath();
    this.epG=new T3.ExtrudeGeometry(ep,{depth:.22,bevelEnabled:false});this.epG.translate(0,0,-.11);
    const sn=new T3.Shape();sn.moveTo(-.9,0);sn.lineTo(.9,0);sn.quadraticCurveTo(1.2,2.4,.2,3.4);sn.lineTo(.5,4.4);sn.lineTo(-.6,4.4);sn.lineTo(-.9,3.2);sn.quadraticCurveTo(.2,2.2,-.9,0);
    this.snG=new T3.ExtrudeGeometry(sn,{depth:.5,bevelEnabled:false});this.snG.translate(0,0,-.25)}
   const W=new T3.Group();W.position.set(-19.6,12.1,0);W.scale.set(.85,.62,.72);kit.add(W);const add=(geo,mat,x,y,z,rz)=>{const q=new T3.Mesh(geo,mat);q.position.set(x,y,z);if(rz)q.rotation.z=rz;W.add(q);return q};
   add(this.wingG,wm,0,4.5,0,-.1);const gf=new T3.Mesh(this.carBox,this.carbon);gf.scale.set(.12,.5,19.6);gf.position.set(-2.25,4.95,0);W.add(gf);
   const el2=add(this.wingG,wm,-1.6,5.4,0,-.32);el2.scale.set(.5,.8,1);
   for(const z of[-10,10])add(this.epG,this.carbon,-.4,4.9,z);
   for(const z of[-5.5,5.5]){add(this.snG,this.carbon,.3,.15,z);const bp=new T3.Mesh(this.carBox,this.carbon);bp.scale.set(2.6,.25,1.4);bp.position.set(.3,.1,z);W.add(bp);
    for(const dx of[-.8,.8]){const bo=new T3.Mesh(this.exG||(this.exG=new T3.CylinderGeometry(.42,.42,.9,14,1,true)),this.chromeM||(this.chromeM=new T3.MeshStandardMaterial({color:0xd8dbe0,metalness:1,roughness:.15})));bo.scale.set(.3,.3,.3);bo.position.set(.3+dx,.28,z);W.add(bo)}}}
  if(K.includes('duck'))box(paint,2,.45,16,-20.6,12.45,0,-.18);
  
  if(K.includes('splitter')){0}
  if(K.includes('skirts'))for(const z of[-11.45,11.45])box(this.carbon,18,.6,.5,-1.2,3.1,z)
  if(K.includes('scoop')){box(paint,5,1.1,6,14.5,10.7,0,-.06);box(this.carbon,.4,.8,5,17,10.6,0)}
  if(K.includes('flaps'))for(const z of[-10,10])box(paint2,.4,3.6,3.4,-21.8,2.6,z);
  {const id=(c.st&&c.st.id)||'z',num=(sp.spz&&sp.spz!=='def'?sp.spz:0)||({civka:'DRAGO',felda:'TURBO Z BAZARU',golfik:'KLÍŠE BOY',bavorak:'BOKEM',imprezka:'NA MOKRU KRÁL',koncept:'ZORYX',supka:'LEGENDA',mini:'MRŇOUS',kupe:'NOČNÍ MŮRA',sedan:'STAROSTA',kombi:'NA CHATU',vitka:'ŘEMESLO',muscle:'V8 NEBO NIC',blower:'SOUSEDI ŠÍLÍ'})[id]||sp.plate||('5U'+((id.charCodeAt(0)*7+id.length*3)%9+1)+' '+String(1000+(id.charCodeAt(1)||0)*37%9000).slice(0,4)),pm=this.plateMat(num);
   for(const[x,y,ry]of[[-23.15,5.6,-Math.PI/2],[23.2,3.3,Math.PI/2]]){const pl=new T3.Mesh(this.plateGeo||(this.plateGeo=new T3.PlaneGeometry(5.2,1.15)),pm);pl.position.set(x,y,0);pl.userData.snapX=x>0?1:-1;pl.rotation.y=ry;kit.add(pl)}
   if(!this.chromeM)this.chromeM=new T3.MeshStandardMaterial({color:0xd8dbe0,metalness:1,roughness:.15});if(!this.exG){this.exG=new T3.CylinderGeometry(.42,.42,.9,14,1,true);this.exG.rotateZ(Math.PI/2)}
   if(!kit.userData.rd)for(const z of(K.includes('wing')||K.includes('duck')?[-6.2,-4.6,4.6,6.2]:[-5.4,5.4])){const e=new T3.Mesh(this.exG,this.chromeM);e.position.set(-22.6,4.35,z*.9);e.scale.set(.7,1,1);kit.add(e);if(!this.exIn)this.exIn=new T3.MeshBasicMaterial({color:0x050505});const d=new T3.Mesh(new T3.CircleGeometry(.36,14),this.exIn);d.rotation.y=-Math.PI/2;d.position.set(-22.86,4.35,z*.9);kit.add(d)}
   if(this.parts&&this.parts.rear_diffuser){const rd=this.parts.rear_diffuser.clone(true);rd.position.set(-22.4,2.9,0);rd.userData.rearSnap=1;kit.add(rd);kit.userData.rd=rd}else{if(!this.dfM)this.dfM=new T3.MeshStandardMaterial({color:0x0e0f12,roughness:.6,metalness:.3});const df=new T3.Mesh(this.carBox,this.dfM);df.scale.set(1.2,1.2,15);df.position.set(-22.3,4.35,0);kit.add(df)}
   if(!this.brkM)this.brkM=new T3.MeshBasicMaterial({color:new T3.Color(0xff1a2a).multiplyScalar(3.2)});var brk=new T3.Group();for(const z of[-7.2,7.2]){const b=new T3.Mesh(this.carBox,this.brkM);b.scale.set(.3,.7,4.4);b.position.set(-20.4,11.85,z);brk.add(b)}brk.visible=false;kit.add(brk)}
  g.updateMatrixWorld(true);kit.userData.snap=(o,d)=>{const rc=this._rc||(this._rc=new T3.Raycaster()),O=kit.localToWorld(new T3.Vector3(...o)),D=kit.localToWorld(new T3.Vector3(o[0]+d[0],o[1]+d[1],o[2]+d[2])).sub(O).normalize();rc.set(O,D);const h=rc.intersectObject(m,true).find(q=>q.object.visible&&q.object.material&&q.object.material.name!=='Glass'&&!/Wheel/.test(q.object.parent.name));return h?kit.worldToLocal(h.point.clone()):null};
  this.lamps(kit,sp,paint,c);if(kit.userData.rd){const h=kit.userData.snap([-40,4.2,0],[1,0,0]);if(h)kit.userData.rd.position.x=h.x+.55}for(const o of kit.children)if(o.userData.snapX){const d=o.userData.snapX,h=kit.userData.snap([d*40,o.position.y,0],[-d,0,0]);if(h)o.position.x=h.x+d*.06}
  if(sp.grill==='front'||sp.grill==='both'){const gm=this.grM||(this.grM=new T3.MeshStandardMaterial({color:0x1a1b1f,metalness:.85,roughness:.35}));const tb=(x,y,z,len,rx,rz)=>{const q=new T3.Mesh(this.tubeG||(this.tubeG=new T3.CylinderGeometry(.35,.35,1,10)),gm);q.scale.y=len;q.position.set(x,y,z);q.rotation.set(rx||0,0,rz||0);kit.add(q)};
   tb(23.6,6.8,0,20,Math.PI/2);tb(23.6,4,0,20,Math.PI/2);for(const z of[-9.5,-3,3,9.5])tb(23.6,5.4,z,5.6);for(const z of[-6,6])tb(22.8,7.2,z,2.4,0,Math.PI/2)}
  if(sp.grill==='both'){const gm=this.grM;for(let i=0;i<6;i++){const q=new T3.Mesh(this.carBox,gm);q.scale.set(.25,.25,15);q.position.set(-19.9,12.9+i*.3,0);q.rotation.z=.35;kit.add(q)}for(const z of[-7,-2.3,2.3,7]){const q=new T3.Mesh(this.carBox,gm);q.scale.set(.25,2,.25);q.position.set(-19.8,13.7,z);q.rotation.z=.35;kit.add(q)}}
  if(sp.armor){const am=this.armM||(this.armM=new T3.MeshStandardMaterial({color:0x4a4d52,metalness:.75,roughness:.45}));for(const z of[-12.1,12.1]){for(const x of[-9,-1,7]){const q=new T3.Mesh(this.carBox,am);q.scale.set(7.4,3.4,.45);q.position.set(x,6.2,z);kit.add(q)}
    for(let x=-12;x<=10;x+=2.2){const r=new T3.Mesh(this.boltG||(this.boltG=new T3.SphereGeometry(.18,6,4)),this.chromeM);r.position.set(x,7.7,z*1.02);kit.add(r)}}
   for(const z of[-1,1]){const q=new T3.Mesh(this.carBox,am);q.scale.set(.5,2.6,20);q.position.set(z>0?23.3:-23.2,4.8,0);kit.add(q)}}
  if(false){if(!this.hlM2)this.hlM2=new T3.MeshBasicMaterial({color:new T3.Color(0xdff2ff).multiplyScalar(3)});
   for(const sd of[-1,1]){if(sp.hl==='led'){const b=new T3.Mesh(this.carBox,this.hlM2);b.scale.set(.25,.14,3.6);b.position.set(21.35,8.12,sd*6.4);b.rotation.y=sd*.12;kit.add(b)}
    else{if(!this.angG){this.angG=new T3.TorusGeometry(.62,.09,8,28);this.angG.rotateY(Math.PI/2)}for(const z of[5.5,7.3]){const r=new T3.Mesh(this.angG,this.hlM2);r.position.set(21.25-(z-5.5)*.25,8.62,sd*z);kit.add(r)}}}}
  if(sp.tl==='bar'){if(!this.tlBarM)this.tlBarM=new T3.MeshBasicMaterial({color:new T3.Color(0xff1030).multiplyScalar(1.6)});const b=new T3.Mesh(this.carBox,this.tlBarM);b.scale.set(.2,.18,17.5);b.position.set(-20.35,12.4,0);kit.add(b)}
  if(K.includes('blower')){if(!this.engM){this.engM=new T3.MeshStandardMaterial({color:0x8a8f98,metalness:.9,roughness:.3});this.engD=new T3.MeshStandardMaterial({color:0x141416,metalness:.5,roughness:.5})}
   const bl=new T3.Group();bl.position.set(14.2,10.3,0);kit.add(bl);const B=(m,sx,sy,sz,x,y,z)=>{const q=new T3.Mesh(this.carBox,m);q.scale.set(sx,sy,sz);q.position.set(x,y,z);bl.add(q)};
   B(this.engD,6.5,1.4,5.4,0,.6,0);B(this.engM,5.6,2.4,4.2,0,2.2,0);for(let i=-2;i<=2;i++)B(this.engD,5.7,.18,.25,0,2.5,i*.8);
   const sc=new T3.Mesh(new T3.CylinderGeometry(1.3,1.5,2.2,16),this.chromeM||(this.chromeM=new T3.MeshStandardMaterial({color:0xd8dbe0,metalness:1,roughness:.15})));sc.position.set(.6,4.3,0);bl.add(sc);
   const top=new T3.Mesh(new T3.CylinderGeometry(1.55,1.55,.4,16),this.engD);top.position.set(.6,5.5,0);bl.add(top);B(this.engD,.4,1.6,.3,-2.9,1.6,1.6)}
  if(K.includes('pipes'))for(const z of[-11.6,11.6]){const pp=new T3.Mesh(new T3.CylinderGeometry(.5,.5,12,12),this.chromeM);pp.rotation.z=Math.PI/2;pp.position.set(-2,2.1,z);kit.add(pp)}
  if(K.includes('rally')){box(this.carbon,2,1,13,-1,14.3,0);if(!this.rallyM)this.rallyM=new T3.MeshBasicMaterial({color:new T3.Color(0xfff2c8).multiplyScalar(2.2)});for(const z of[-4.5,-1.5,1.5,4.5]){const l=new T3.Mesh(this.carBox,this.rallyM);l.scale.set(.6,1.8,2.2);l.position.set(.2,15.4,z);kit.add(l)}}
  if(!this.shTex){this.shTex=this.glowTex('rgba(0,0,0,.85)');this.shGeo=new T3.PlaneGeometry(1,1);this.shGeo.rotateX(-Math.PI/2);this.shMat=new T3.MeshBasicMaterial({map:this.shTex,transparent:true,depthWrite:false})}
  const W=B.hw*2*zs*zw;const sh=new T3.Mesh(this.shGeo,this.shMat);sh.scale.set(L*1.12,1,W*1.15);sh.position.y=.25;g.add(sh);const beam=new T3.Mesh(this.beamGeo,this.beamMat);beam.position.set(L/2,1.6,0);g.add(beam);
  if(!this.ugTex)this.ugTex=this.glowTex('rgba(255,255,255,.9)');let glow=null;if(sp.glow&&sp.glow!=='off'){glow=new T3.Mesh(this.shGeo,new T3.MeshBasicMaterial({map:this.ugTex,color:sp.glow,transparent:true,blending:T3.AdditiveBlending,depthWrite:false}));glow.scale.set(L*1.55,1,W*1.5);glow.material.opacity=.4;glow.position.y=1;g.add(glow)}
  if(!this.flG){this.flG=new T3.ConeGeometry(3.2,16,8);this.flG.rotateZ(Math.PI/2);this.flM=new T3.MeshBasicMaterial({color:new T3.Color(0x66aaff).multiplyScalar(3),transparent:true,opacity:.85,blending:T3.AdditiveBlending,depthWrite:false})}
  const fl=new T3.Mesh(this.flG,this.flM);fl.position.set(-L/2-8,5*zs,0);fl.visible=false;g.add(fl);
  g.userData={beam,paint,pc:sp.p1,wheels:[],cw:wheels,ch,glow,fl,concept:true,knF:g.userData_kn,pop:kit.userData.pop,sx:bx,sy:by,sw:swSpin,dice:diceG,scr:scrM,brk,zs,zw,lo,tk:c.st?this.tuneKey(c.st.id):''};if(!noAdd)this.scene.add(g);return g},
 // ---------- 3D garage studio (far away in the same scene, so bloom + reflections work) ----------
 ck:{back:10,up:5.4,upP:5.7,pitchL:-6,pitchP:-9,fovL:60,fovP:74},
 GX:-60000,GZ:-60000,
 garageBuild(){const T3=THREE,S=this.scene,gr=this.gRoom=new T3.Group();gr.position.set(this.GX,0,this.GZ);gr.visible=false;S.add(gr);const TL=new T3.TextureLoader();
  // hangar floor: polished concrete with yellow guide lines
  const ft=TL.load('art/tex/hangar_floor.jpg');ft.colorSpace=T3.SRGBColorSpace;ft.wrapS=ft.wrapT=T3.RepeatWrapping;ft.repeat.set(5,5);ft.anisotropy=8;
  const floor=new T3.Mesh(new T3.CircleGeometry(340,64),new T3.MeshStandardMaterial({map:ft,color:0x8a8a8a,metalness:.3,roughness:.4}));floor.rotation.x=-Math.PI/2;gr.add(floor);
  // hangar walls (Figma panorama) on the arc behind the car, dark steel elsewhere
  const R=330,arc=2.9,H=R*arc/3,ht=TL.load('art/tex/hangar.jpg');ht.colorSpace=T3.SRGBColorSpace;const back=Math.atan2(-.45,-.9);
  const wall=new T3.Mesh(new T3.CylinderGeometry(R,R,H,64,1,true,back-arc/2,arc),new T3.MeshBasicMaterial({map:ht,side:T3.BackSide,color:new T3.Color(1,1,1).multiplyScalar(.95)}));wall.position.y=H/2-6;gr.add(wall);
  const rest=new T3.Mesh(new T3.CylinderGeometry(R,R,H,48,1,true,back+arc/2,Math.PI*2-arc),new T3.MeshStandardMaterial({color:0x1b1e1f,metalness:.6,roughness:.6,side:T3.BackSide}));rest.position.y=H/2-6;gr.add(rest);
  const cap=new T3.Mesh(new T3.CircleGeometry(R,48),new T3.MeshBasicMaterial({color:0x07080a}));cap.rotation.x=Math.PI/2;cap.position.y=H-6;gr.add(cap);
  // turntable: dark steel with a hazard ring
  const dt2=TL.load('art/tex/turntable.jpg');dt2.colorSpace=T3.SRGBColorSpace;const side=new T3.MeshStandardMaterial({color:0x2a2d31,metalness:.85,roughness:.3}),top=new T3.MeshStandardMaterial({map:dt2,metalness:.6,roughness:.35});const disc=this.gDisc=new T3.Mesh(new T3.CylinderGeometry(46,48,2.4,64),[side,top,side]);disc.position.y=1.2;gr.add(disc);
  {const c=document.createElement('canvas');c.width=512;c.height=16;const x=c.getContext('2d');for(let i=0;i<32;i++){x.fillStyle=i%2?'#111':'#ffc21a';x.beginPath();x.moveTo(i*16,0);x.lineTo(i*16+16,0);x.lineTo(i*16+8,16);x.lineTo(i*16-8,16);x.fill()}
   const t=new T3.CanvasTexture(c);t.wrapS=T3.RepeatWrapping;t.repeat.set(3,1);t.colorSpace=T3.SRGBColorSpace;const ring=new T3.Mesh(new T3.CylinderGeometry(48.2,48.2,2.4,96,1,true),new T3.MeshStandardMaterial({map:t,roughness:.6}));ring.position.y=1.2;gr.add(ring)}
  // work lights
  const pl=[[0xffd9a0,-110,150,-60,1.1],[0xffe6c0,110,150,40,.9],[0xffffff,0,190,0,.7],[0xbfd4ff,70,50,150,.6]];this.gLights=pl.map(([c,a,b,d,i])=>{const L=new T3.PointLight(c,i,700,1);L.position.set(a,b,d);gr.add(L);return L});
  {const lg=new T3.CylinderGeometry(0,40,70,24,1,true),lm=new T3.MeshBasicMaterial({color:0xffe2a8,transparent:true,opacity:.06,blending:T3.AdditiveBlending,depthWrite:false,side:T3.DoubleSide});for(const[x,z]of[[-60,-40],[60,-30],[0,50]]){const c=new T3.Mesh(lg,lm);c.position.set(x,150,z);gr.add(c)}}
  this.gYaw=.6;this.gVel=.25},
 garageSet(def,tune){if(!this.concept)return false;if(!this.gRoom)this.garageBuild();if(this.gCar){this.gDisc.remove(this.gCar);this.gCar=null}
  const c={L:def.L,Wd:def.Wd,col:(tune&&tune.p1)||def.col,st:{id:def.id},kind:'player'};let g;if(def.soon){g=this.soonMesh(def);if(!g)return false}else if(def.kenney){if(!this.kReady||!this.km[def.kenney])return false;g=this.kenneyMesh(c,def.kenney);g.userData.beam.visible=false}else g=this.zMesh(c,this.zSpec(def.id,tune),true);g.position.y=2.45;if(g.userData.beam)g.userData.beam.visible=false;g.traverse(o=>{if(o.isMesh&&(o.geometry===this.shGeo||o.geometry===this.beamGeo))o.visible=false});this.gDisc.add(g);this.gCar=g;return true},
 garageRender(dt){if(!this.gRoom||!this.gCar)return false;const C=this.cam;this.gRoom.visible=true;this.sky.visible=false;const fogD=this.scene.fog.density;this.scene.fog.density=0;
  if(!this.gDrag)this.gYaw+=this.gVel*dt;this.gVel=lerp(this.gVel,.25,Math.min(1,dt*1.5));this.gDisc.rotation.y=this.gYaw;
  const V=this.gView||{x:VW/2,y:VH/2,w:VW,h:VH},fov=40,tn=Math.tan(fov*Math.PI/360),av=Math.max(120,Math.min(V.w*.92,V.h*1.75)),d=clamp(74*VH/(2*tn*av),80,340),el=.13;
  C.near=2;C.fov=fov;C.setViewOffset(VW,VH,VW/2-V.x,VH/2-V.y,VW,VH);
  const cx=this.GX,cz=this.GZ;C.position.set(cx+d*Math.cos(el)*.45,d*Math.sin(el)+9,cz+d*Math.cos(el)*.9);C.lookAt(cx,13,cz);
  const bs=this.bloom?this.bloom.strength:0;if(this.bloom)this.bloom.strength=.28;const env=this.scene.environment;if(this.env)this.scene.environment=this.env;
  if(this.comp)this.comp.render();else this.renderer.render(this.scene,C);
  if(this.bloom)this.bloom.strength=bs;this.scene.environment=env;this.scene.fog.density=fogD;this.gRoom.visible=false;this.sky.visible=true;C.clearViewOffset();C.near=8;C.updateProjectionMatrix();return true},
 pedMesh(p){const near=this.focus?Math.hypot(p.x-(G.world&&G.world.player?G.world.player.x:this.focus.x),p.y-(G.world&&G.world.player?G.world.player.y:this.focus.y))<600:true;
  if(this.mini&&this.mini.length>=6&&window.TADD&&near&&(this.skinN||0)<(isTouch?44:70)){const T3=THREE,g=new T3.Group();if(p.mi===undefined)p.mi=Math.floor(Math.random()*1e6);const M=this.mini[p.mi%this.mini.length],m=TADD.SkeletonUtils.clone(M.sc),k=(12.8+(p.mi%5)*.55)/M.h;
   m.scale.setScalar(k);m.position.y=-M.minY*k;m.rotation.y=Math.PI/2;const mixer=new T3.AnimationMixer(m),act={};for(const[a,b]of[['idle','idle'],['walk','walk'],['run','sprint'],['talk',(p.mi%2)?'emote-yes':'emote-no']])if(M.cl[b])act[a]=mixer.clipAction(M.cl[b]);
   if(act.idle)act.idle.play();mixer.update(Math.random()*2);g.add(m);g.userData={skin:true,mixer,act,cur:'idle',body:m,mini:true};this.skinN=(this.skinN||0)+1;this.scene.add(g);return g}if(this.pedProto&&window.TADD&&near&&(this.skinN||0)<(isTouch?22:34)){const T3=THREE,g=new T3.Group(),m=TADD.SkeletonUtils.clone(this.pedProto);m.rotation.y=Math.PI/2;m.scale.setScalar(9.5);
   m.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.material=/Joints/.test(o.material.name)?this.matS(p.type==='worker'?'#ffd02e':p.hair||'#222228'):this.matS(p.type==='worker'?'#ff7a1a':p.col)}});
   const mixer=new T3.AnimationMixer(m),act={};for(const n of['idle','walk','run'])if(this.pedClips[n])act[n]=mixer.clipAction(this.pedClips[n]);if(act.idle)act.idle.play();mixer.update(Math.random()*2);
   g.add(m);g.userData={skin:true,mixer,act,cur:'idle',body:m};this.skinN=(this.skinN||0)+1;this.scene.add(g);return g}
  const T3=THREE,g=new T3.Group(),R=this;if(!this.pg){this.pg={leg:new T3.BoxGeometry(2.4,8.5,2.5).translate(0,-4.25,0),arm:new T3.BoxGeometry(1.9,7,1.9).translate(0,-3.5,0),torso:new T3.BoxGeometry(3.6,8,6.6),head:new T3.SphereGeometry(2.7,10,8),hair:new T3.SphereGeometry(2.9,10,6,0,Math.PI*2,0,Math.PI*.55)}}
  const G2=this.pg,pants=this.matC(p.type==='worker'?0x2a3a5a:[0x1c1d24,0x2a3348,0x3a3a3a,0x23262e][(p.x|0)%4]),shirt=this.matC(p.col),skin=this.matC(p.skin||'#d79c74'),hair=this.matC(p.hair);
  const body=new T3.Group();g.add(body);const legs=[],arms=[];
  for(const z of[-1.5,1.5]){const l=new T3.Mesh(G2.leg,pants);l.position.set(0,8.5,z);body.add(l);legs.push(l)}
  const tor=new T3.Mesh(G2.torso,shirt);tor.position.set(0,12.5,0);body.add(tor);
  if(p.type==='worker'){const v=new T3.Mesh(this.carBox,this.matC(0xe8ff3a));v.scale.set(3.8,1.2,6.8);v.position.set(0,13.5,0);body.add(v)}
  for(const z of[-4.3,4.3]){const a=new T3.Mesh(G2.arm,p.type==='girl'?skin:shirt);a.position.set(0,16.2,z);body.add(a);arms.push(a)}
  const hd=new T3.Mesh(G2.head,skin);hd.position.set(0,19.4,0);body.add(hd);const hr=new T3.Mesh(G2.hair,hair);hr.position.set(-.3,19.7,0);body.add(hr);
  if(p.type==='girl'){const lh=new T3.Mesh(this.carBox,hair);lh.scale.set(1.6,6,5.4);lh.position.set(-2,17.5,0);body.add(lh)}
  if(p.type==='drunk'||p.type==='party'){const bt=new T3.Mesh(this.carBox,this.matC(p.type==='party'?0xc9a04a:0x2f7a2f));bt.scale.set(1.2,3.4,1.2);bt.position.set(0,-7.5,0);arms[1].add(bt)}
  g.scale.setScalar(.82);g.userData={legs,arms,body};this.scene.add(g);return g},
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
 camFor(w,dt){const C=this.cam,p=w.player,drv=p&&(G.mode==='roam'||G.mode==='race'),chase=this.camMode==='chase'&&drv,cock=this.camMode==='cockpit'&&drv;
  const g=p&&this.cars.get(p);if(g)g.userData.ch.visible=!(cock&&!g.userData.concept)||true;
  if(cock){const sp=Math.hypot(p.vx,p.vy),fx=Math.cos(p.a),fz=Math.sin(p.a),lx=fz,lz=-fx,con=g&&g.userData.concept;
   if(C.near!==1){C.near=1;C.updateProjectionMatrix()}const sk=shakeA*.35;
   let fo=p.L*.2,so=0,hh=17.5;if(con&&this.swPos){const zs=g.userData.zs||1,zw=g.userData.zw||1,lo=g.userData.lo||0;const K=this.ck,bx=g.userData.sx||1,by=g.userData.sy||1;fo=(this.swPos.x*bx-K.back)*zs;so=-this.swPos.z*zs*zw;hh=(this.swPos.y+(VH>VW*1.1?K.upP:K.up))*zs*by-lo+.55*zs}this.ca=p.a;this.cp=null;
   const roll=(p.steer||0)*Math.min(1,sp/260)*.04;C.position.set(p.x+fx*fo+lx*so+rr(-sk,sk),hh+rr(-sk,sk)*.4,p.y+fz*fo+lz*so+rr(-sk,sk));
   const port=VH>VW*1.1,K=this.ck;C.up.set(-fz*roll,1,fx*roll).normalize();C.lookAt(p.x+fx*400+lx*so,hh-(con?400*Math.tan((port?K.pitchP:K.pitchL)*Math.PI/180):14),p.y+fz*400+lz*so);C.up.set(0,1,0);
   C.fov=lerp(C.fov,(con?(port?K.fovP:K.fovL):66)+Math.min(12,sp/25)+(p.boost?10:0),Math.min(1,dt*3));C.updateProjectionMatrix();this.focus={x:p.x+fx*500,y:p.y+fz*500,r:1500};return}
  if(C.near!==8){C.near=8;C.updateProjectionMatrix()}
  if(chase){const sp=Math.hypot(p.vx,p.vy);let va=sp>40?Math.atan2(p.vy,p.vx):p.a;if(p.v<-5)va=p.a;
   this.ca=this.ca===undefined?p.a:this.ca+wrapA(va-this.ca)*Math.min(1,dt*3.2);const back=105+sp*.12,hh=44+sp*.03,fx=Math.cos(this.ca),fz=Math.sin(this.ca);
   const tx=p.x-fx*back,tz=p.y-fz*back;this.cp=this.cp||{x:tx,y:hh,z:tz};this.cp.x=lerp(this.cp.x,tx,Math.min(1,dt*6));this.cp.z=lerp(this.cp.z,tz,Math.min(1,dt*6));this.cp.y=lerp(this.cp.y,hh,Math.min(1,dt*3));
   C.fov=lerp(C.fov,62+Math.min(14,sp/22)+(p.boost?10:0),Math.min(1,dt*3));C.updateProjectionMatrix();const sk=shakeA*.7;C.position.set(this.cp.x+rr(-sk,sk),this.cp.y+rr(-sk,sk)*.5,this.cp.z+rr(-sk,sk));C.lookAt(p.x+fx*130,14,p.y+fz*130);this.focus={x:p.x+fx*500,y:p.y+fz*500,r:1500}}
  else{this.ca=undefined;this.cp=null;const Z=w.zoom||baseZoom(),fov=50;if(C.fov!==fov){C.fov=fov;C.updateProjectionMatrix()}const visH=VH/Z,d=visH/(2*Math.tan(fov*Math.PI/360)),tilt=.42;
   const sx=shakeA?rr(-shakeA,shakeA):0,sy=shakeA?rr(-shakeA,shakeA):0;C.position.set(w.cam.x+sx,d*Math.cos(tilt),w.cam.y+d*Math.sin(tilt)+sy);C.lookAt(w.cam.x+sx,0,w.cam.y+sy);this.focus={x:w.cam.x,y:w.cam.y-visH*.15,r:Math.max(VW,VH)/Z*.85+300}}},
 proj(x,y,h){const v=this.tmp||(this.tmp=new THREE.Vector3());v.set(x,h||0,y).project(this.cam);return[(v.x+1)/2*VW,(1-v.y)/2*VH,v.z<1&&v.z>-1]},
 // ---------- per-frame ----------
 render(w,opts,dt){const T3=THREE,t=w.t;this.camFor(w,dt);this.updChunks(this.focus.x,this.focus.y,this.focus.r);
  this.hemi.intensity=(this.hemiBase||.6)*(this.camMode==='cockpit'&&(G.mode==='roam'||G.mode==='race')?1.35:1)+w.flash*1.6;this.scene.fog.density=(G.mode==='roam'||G.mode==='race'?(this.camMode==='chase'?.00055:.00035):.0003)*(this.fogMul||1);
  // cars
  const seen=new Set();for(const c of w.cars){let g=this.cars.get(c);if(g&&((c.kind==='player'&&c.st&&(c.st.kenney?(this.kReady&&(!g.userData.k||g.userData.tk!==this.tuneKey(c.st.id))):(this.concept&&(!g.userData.concept||g.userData.tk!==this.tuneKey(c.st.id)))))||(!g.userData.k&&!g.userData.concept&&this.kReady&&this.kModelFor(c)))){this.scene.remove(g);this.cars.delete(c);g=null}if(!g){g=this.carMesh(c);this.cars.set(c,g)}seen.add(c);g.position.set(c.x,0,c.y);g.rotation.y=-c.a;
   if(g.userData.paint.isMaterial)g.userData.paint.color.set(c.wreck?0x2a2522:(c.st&&c.st.police)?0xe9ecef:c.hitT>0?0xffffff:(g.userData.pc||c.col));g.userData.beam.visible=!c.wreck;for(const wg of g.userData.wheels)wg.rotation.z-=(c.v||0)*dt/5.6;
   {const U=g.userData,sp=Math.abs(c.v||0),lat=(c.steer||0)*Math.min(1,sp/260)*(c.v<0?-1:1)*(c.drift?1.6:1),dv=dt>0?((c.v||0)-(c.pv===undefined?c.v||0:c.pv))/dt:0;c.pv=c.v;
    if(U.pop){const up=sp>8?1:0;for(const q of U.pop)q.rotation.z=lerp(q.rotation.z,up?-1.05:0,Math.min(1,dt*4))}
    if(U.brk)U.brk.visible=!!c.brake||(c.v||0)<-5;
    if(U.dice){U.dice.rotation.x=lerp(U.dice.rotation.x,-(c.steer||0)*Math.min(1,sp/200)*.5,Math.min(1,dt*3))}
    if(U.sw){U.sw.rotation.x=(c.steer||0)*2.2;if(c.kind==='player'&&this.camMode==='cockpit'){const v=this.tmp2||(this.tmp2=new THREE.Vector3());U.sw.getWorldPosition(v);v.project(this.cam);this.swScr={x:(v.x+1)/2*VW,y:(1-v.y)/2*VH};
     v.set(0,2.05,0);U.sw.localToWorld(v);v.project(this.cam);this.swRpx=Math.hypot((v.x+1)/2*VW-this.swScr.x,(1-v.y)/2*VH-this.swScr.y);
     if(U.scr){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,ok=true;for(const[a,b]of[[-3,-1.4],[3,-1.4],[3,1.4],[-3,1.4]]){v.set(a,b,0);U.scr.localToWorld(v);v.project(this.cam);if(v.z>1)ok=false;const X=(v.x+1)/2*VW,Y=(1-v.y)/2*VH;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y)}this.iRect=ok&&x1>0&&x0<VW?{x0,x1,y0,y1}:null}}else if(c.kind==='player')this.iRect=null}
    if(c.kind==='player'&&U.concept&&this.camMode==='cockpit')this.infoDraw(t);
    if(c.kind==='player'&&U.concept&&this.dCv){const k=Math.round(sp*.42),gb=c.v<-5?'R':(sp<3?'N':(c.gear||1));this.dashDraw(k,gb==='N'?0:gb,clamp(c.rpm||0,0,1)*(sp<3?.08:1))}
    U.ch.rotation.x=lerp(U.ch.rotation.x,lat*.075,Math.min(1,dt*7));U.ch.rotation.z=lerp(U.ch.rotation.z,clamp(dv/5000,-.05,.035),Math.min(1,dt*6));
    for(const wg of U.wheels)if(wg.position.x>0)wg.rotation.y=-(c.steer||0)*.45;
    if(U.kw){for(const wn of U.kw){wn.rotation.x+=(c.v||0)*dt/5.5;if(wn.userData.front)wn.rotation.y=(c.steer||0)*.45}}if(U.cw){const ax=this.cAxis;for(const wn of U.cw){wn.rotation[ax]-=(c.v||0)*dt/5.5*(ax==='x'?1:1)}}if(U.knF)for(const k of U.knF)k.rotation.y=lerp(k.rotation.y,-(c.steer||0)*.42,Math.min(1,dt*12));U.fl.visible=!!c.boost;if(c.boost){const k=.8+Math.random()*.5;U.fl.scale.set(k,1,1)}if(U.glow)U.glow.material.opacity=.55+.1*Math.sin(t*3)}
   if(g.userData.bar){const ph=Math.floor(t*8)%2;g.userData.bar[0].material=ph?this.redMat:this.offMat;g.userData.bar[1].material=ph?this.offMat:this.bluMat}}
  for(const[c,g]of this.cars)if(!seen.has(c)){this.scene.remove(g);g.traverse(o=>{if(o.material===g.userData.paint||(g.userData.k&&o.isMesh&&o.material&&o.material.isMeshPhysicalMaterial))o.material.dispose()});this.cars.delete(c)}
  // peds
  const ps=new Set();for(const p of w.peds){let g=this.peds.get(p);if(g&&!g.userData.skin&&(this.pedProto||this.mini)&&(this.skinN||0)<(isTouch?44:70)&&w.player&&Math.hypot(p.x-w.player.x,p.y-w.player.y)<420){this.scene.remove(g);g=null}if(!g){g=this.pedMesh(p);this.peds.set(p,g)}ps.add(p);g.position.set(p.x,0,p.y);g.rotation.y=-p.a;
   const U=g.userData;if(U.skin){U.mixer.update(dt);if(p.down>0){U.body.rotation.z=Math.PI/2;g.position.y=3}else{U.body.rotation.z=0;const want=p.flee>0?'run':(p.sp>0?'walk':((p.say||p.mate)&&U.act.talk&&Math.floor(w.t/4+p.x)%3===0?'talk':'idle'));
     if(want!==U.cur&&U.act[want]){U.act[want].reset().play();U.act[U.cur]&&U.act[U.cur].crossFadeTo(U.act[want],.25,false);U.cur=want}if(U.act.walk)U.act.walk.timeScale=Math.max(.5,(p.sp||20)/22);
     if(p.type==='drunk'||p.type==='party')U.body.rotation.x=Math.sin((p.wob||0)*2)*.12}continue}
   if(p.down>0){U.body.rotation.z=Math.PI/2;U.body.position.y=3}else{U.body.rotation.z=0;U.body.position.y=0;const mv=(p.sp>0||p.flee>0)?1:.12,sw=Math.sin(p.walk)*.7*mv;
    U.legs[0].rotation.z=sw;U.legs[1].rotation.z=-sw;U.arms[0].rotation.z=-sw*.9;U.arms[1].rotation.z=sw*.9;if(p.punch)U.arms[0].rotation.z=-1.5;
    U.body.rotation.x=(p.type==='drunk'||p.type==='party')?Math.sin((p.wob||0)*2)*.16:0;if(p.type==='fight'&&!p.punch)U.arms[0].rotation.z=U.arms[1].rotation.z=-.8}}
  for(const[p,g]of this.peds)if(!ps.has(p)){this.scene.remove(g);if(g.userData.skin){g.userData.mixer.stopAllAction();this.skinN--}this.peds.delete(p)}
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
  if(this.arrow.visible){const p=w.player,a=Math.atan2(tg.y-p.y,tg.x-p.x);if(this.camMode==='cockpit'&&(G.mode==='roam'||G.mode==='race')){this.arrow.position.set(p.x+Math.cos(p.a)*110,30+Math.sin(t*4)*1.5,p.y+Math.sin(p.a)*110);this.arrow.scale.setScalar(.55);this.arrow.rotation.y=-a;this.arrow.visible=true}else this.arrow.position.set(p.x,40+Math.sin(t*4)*2,p.y);this.arrow.rotation.y=-a;const s=this.camMode==='chase'?1:this.camMode==='cockpit'?.55:1.5;this.arrow.scale.setScalar(s)}
  if(this.navTex)this.navTex.offset.x=-(t*1.6%1);
  this.parkedKenney();if(this.wU)this.wU.uT.value=t;
  // lights
  const p=w.player;if(p&&!p.wreck&&!G.engineOff){const ca=Math.cos(p.a),sa=Math.sin(p.a);this.head.position.set(p.x+ca*p.L*.4,16,p.y+sa*p.L*.4);this.head.target.position.set(p.x+ca*260,0,p.y+sa*260);this.head.intensity=p.boost?2:1.5}else this.head.intensity=0;
  const fx=this.focus.x,fy=this.focus.y,cx=p?p.x:w.cam.x,cy=p?p.y:w.cam.y;const near=[];for(const l of lamps){const d=(l.x-cx)*(l.x-cx)+(l.y-cy)*(l.y-cy);if(d<640000)near.push([d,l])}near.sort((a,b)=>a[0]-b[0]);
  this.lampL.forEach((L,i)=>{const n=near[i];if(n){L.position.set(n[1].x,44,n[1].y);L.intensity=this.lampOn?1:0}else L.intensity=0});
  let pol=null,pd=1e12;for(const c of w.cars)if(c.st&&c.st.police&&!c.wreck){const d=(c.x-cx)**2+(c.y-cy)**2;if(d<pd){pd=d;pol=c}}
  const ph=Math.floor(t*8)%2;if(pol&&pd<700*700){this.polL[0].position.set(pol.x,30,pol.y);this.polL[1].position.set(pol.x,30,pol.y);this.polL[0].intensity=ph?2.2:0;this.polL[1].intensity=ph?0:2.6}else{this.polL[0].intensity=this.polL[1].intensity=0}
  this.sky.position.copy(this.cam.position);if(this.skyline){const c=this.cam.position;this.skyline.position.set(c.x,Math.min(c.y,120)-this.skyline.userData.H*.16,c.z)}this.perf(dt);if(this.comp)this.comp.render();else this.renderer.render(this.scene,this.cam)},
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
  {const p=w.player;if(p&&(G.mode==='roam'||G.mode==='race')){const sp=Math.hypot(p.vx,p.vy),k=clamp((sp-p.st.max*.9)/(p.st.max*.6),0,1)+(p.boost?.6:0);if(k>0){c2.save();c2.strokeStyle='rgba(255,255,255,'+(.22*Math.min(1,k))+')';c2.lineWidth=1.5;c2.beginPath();const cx=vw/2,cy=vh*.45,n=isTouch?26:40;
    for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2+((t*7+i*13.7)%1)*.2,r0=Math.max(vw,vh)*(.42+((t*3.1+i*.37)%1)*.25),r1=r0+40+90*k;c2.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);c2.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1)}c2.stroke();c2.restore()}}}
  if(w.rain){c2.strokeStyle='rgba(170,195,230,.3)';c2.lineWidth=1;c2.beginPath();const n=isTouch?110:160;for(let i=0;i<n;i++){const d=rainDrops[i];const y=((d.y+t*1.6*d.s)%1)*(vh+60)-30,x=((d.x+t*.25*d.s)%1)*(vw+60)-30;c2.moveTo(x,y);c2.lineTo(x-5*d.s,y-18*d.s)}c2.stroke()}
  if(w.flash>0){c2.fillStyle=`rgba(200,215,255,${w.flash*.25})`;c2.fillRect(0,0,vw,vh)}
  const vg=c2.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.35,vw/2,vh/2,Math.max(vw,vh)*.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');c2.fillStyle=vg;c2.fillRect(0,0,vw,vh)}
R3.init();
