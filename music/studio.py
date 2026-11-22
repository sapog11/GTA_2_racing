# All radio stations + game SFX, composed procedurally (original, no samples). Run: python3 music/studio.py
import numpy as np, subprocess, os, wave, sys
sys.path.insert(0,os.path.dirname(__file__))
SR=44100;rng=np.random.default_rng(11);OUT=os.path.join(os.path.dirname(__file__),'..','public')
def F(x,fc,hp=False,o=4):
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR)
    X*= (1/(1+(fc/np.maximum(f,1))**o)) if hp else (1/(1+(f/fc)**o));return np.fft.irfft(X,len(x))
def verb(x,sec=2.0,mix=.25):
    n=int(sec*SR);ir=F(rng.standard_normal(n),5500)*np.exp(-np.arange(n)/SR*6.9/sec);ir/=np.sqrt((ir**2).sum())
    N=1<<int(np.ceil(np.log2(len(x)+n)));y=np.fft.irfft(np.fft.rfft(x,N)*np.fft.rfft(ir,N),N)[:len(x)];return x*(1-mix)+y*mix*2.5
def put(b,s,t,g=1.0):
    i=int(t*SR)
    if i>=len(b):return
    j=min(len(b),i+len(s));b[i:j]+=s[:j-i]*g
def T(d):return np.arange(int(d*SR))/SR
def mtof(m):return 440*2**((m-69)/12)
# ---- drums
def kick(f0=150,f1=45,dec=7,drive=1.8,d=.5):
    t=T(d);f=f1+(f0-f1)*np.exp(-t*30);return np.tanh(np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*dec)*drive)
def snare(tone=190,dec=17,body=.5,d=.35):
    t=T(d);return F(rng.standard_normal(len(t)),1600,True)*np.exp(-t*dec)*.6+np.sin(2*np.pi*tone*t)*np.exp(-t*24)*body
def clap(d=.3):
    t=T(d);e=sum(np.exp(-np.maximum(t-k*.011,0)*60)*(t>=k*.011) for k in range(3))+np.exp(-t*12)*.6
    return F(F(rng.standard_normal(len(t)),900,True),5000)*e*.5
def hat(o=False,lvl=.1):
    t=T(.35 if o else .06);return F(rng.standard_normal(len(t)),7000,True)*np.exp(-t*(8 if o else 60))*lvl
# ---- instruments
def inst(kind,f,d,v=.3):
    t=T(d);n=len(t)
    if n==0:return t
    if kind=='piano':s=sum(np.sin(2*np.pi*f*k*t)*(.55**(k-1))*np.exp(-t*(1+k*.8)) for k in range(1,7))*np.minimum(1,t/.004)
    elif kind=='epiano':s=(np.sin(2*np.pi*f*t+np.sin(2*np.pi*f*t)*1.2*np.exp(-t*3)))*np.exp(-t*1.6)*np.minimum(1,t/.003)
    elif kind=='pad':s=sum(np.sin(2*np.pi*f*(1+dd)*t+rng.random()*6) for dd in(-.005,0,.004,.008))/3*np.minimum(1,t/.5)*np.minimum(1,(d-t)/.4)
    elif kind=='saw':s=sum(2*((f*(1+dd)*t+rng.random())%1)-1 for dd in(-.007,0,.007))/3*np.minimum(1,t/.01)*np.minimum(1,(d-t)/.05)
    elif kind=='808':fg=f*(1+.6*np.exp(-t*35));s=np.tanh(np.sin(2*np.pi*np.cumsum(fg)/SR)*2)*np.exp(-t*1.2)
    elif kind=='sub':s=np.sin(2*np.pi*f*t)*np.minimum(1,t/.01)*np.minimum(1,(d-t)/.03)
    elif kind=='reese':s=sum(2*((f*(1+dd)*t+rng.random())%1)-1 for dd in(-.013,-.005,.005,.013))/4*np.minimum(1,t/.02)*np.minimum(1,(d-t)/.04)
    elif kind=='pluck':s=((2*((f*t)%1)-1)*np.exp(-t*8)+np.sin(4*np.pi*f*t)*np.exp(-t*12)*.4)
    elif kind=='funk':s=np.tanh((2*((f*t)%1)-1)*3)*np.exp(-t*6)*np.minimum(1,t/.003)
    elif kind=='strings':s=sum((2*((f*(1+dd)*t+rng.random())%1)-1) for dd in(-.004,0,.004))/3*np.minimum(1,t/.25)*np.minimum(1,(d-t)/.3)*(1+.04*np.sin(2*np.pi*5.5*t))
    elif kind=='brass':s=np.tanh(sum(np.sin(2*np.pi*f*k*t)/k for k in range(1,9))*1.4)*np.minimum(1,t/.03)*np.minimum(1,(d-t)/.05)*(1+.03*np.sin(2*np.pi*5*t))
    elif kind=='accordion':s=sum((2*((f*(1+dd)*t)%1)-1)*.33 for dd in(-.006,0,.006))*np.minimum(1,t/.02)*np.minimum(1,(d-t)/.04)
    elif kind=='bell':s=sum(np.sin(2*np.pi*f*r*t)*a*np.exp(-t*dd) for r,a,dd in((1,1,2),(2.76,.5,4),(5.4,.25,6),(8.9,.1,9)))
    return s*v
def master(x,name,folder='music',tgt=-14,br='112k'):
    x=x-np.mean(x);x=x/(np.max(np.abs(x))+1e-9);x=np.tanh(x*1.3)/np.tanh(1.3);rms=np.sqrt((x**2).mean());x=np.clip(x*min(10**(tgt/20)/max(rms,1e-6),3),-.99,.99)
    fade=int(.02*SR);x[:fade]*=np.linspace(0,1,fade);x[-fade:]*=np.linspace(1,0,fade)
    st=np.stack([x,np.roll(x,int(.009*SR))*.96+x*.04],1);w='/tmp/_s.wav'
    with wave.open(w,'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((st*32767).astype('<i2').tobytes())
    out=os.path.join(OUT,folder,name+'.mp3');os.makedirs(os.path.dirname(out),exist_ok=True)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',w,'-codec:a','libmp3lame','-b:a',br,out]);print(folder,name,round(len(x)/SR,1),'s',flush=True)
# ---- generic song builder
def song(name,bpm,bars,prog,drums,bass,keys,extra=None,swing=0,mix=None):
    b=60/bpm;N=int((bars*4*b+2.5)*SR);D=np.zeros(N);B=np.zeros(N);K=np.zeros(N);E=np.zeros(N)
    for bar in range(bars):
        t0=bar*4*b;root,ch=prog[(bar//2)%len(prog)];part=0 if bar<4 else (2 if bar>=bars-2 else 1)
        if part==1 or bar>=bars-2:pass
        keys(K,bar,t0,b,root,ch,part)
        if part==1:drums(D,bar,t0,b,swing);bass(B,bar,t0,b,root,ch)
        if extra:extra(E,bar,t0,b,root,ch,part)
    m=mix or (1,1,1,1);out=F(D,11000)*m[0]+F(B,500)*m[1]+verb(F(K,5000),2.2,.3)*m[2]+verb(E,2.6,.35)*m[3];master(out,name)
def sw(i,b,s):return (s*b/4 if i%2 else 0)
# ================== STATIONS ==================
AM=[(57,[57,60,64]),(53,[53,57,60]),(55,[55,59,62]),(52,[52,55,59])]
DM=[(50,[62,65,69]),(46,[58,62,65]),(53,[65,69,72]),(48,[60,64,67])]
CM=[(48,[60,64,67]),(45,[57,60,64]),(41,[53,57,60]),(43,[55,59,62])]
FM=[(41,[53,57,60,64]),(38,[50,53,57,60]),(46,[58,62,65,69]),(48,[60,64,67,70])]
def st_labe():  # LABE FM: chill lo-fi hip hop
    KK,SS,HH=kick(120,45,8,1.2),snare(180,20,.3),hat()
    def dr(D,bar,t0,b,s):
        for x in(0,2.5):put(D,KK,t0+x*b)
        for x in(1,3):put(D,SS,t0+x*b,.8)
        for i in range(8):put(D,HH,t0+i*b/2+sw(i,b,.35),.8 if i%2 else 1)
    def bs(B,bar,t0,b,r,ch):
        for x,l in((0,1.5),(2.5,1.2)):put(B,inst('sub',mtof(r-12),l*b,.5),t0+x*b)
    def ky(K,bar,t0,b,r,ch,p):
        for k,c in enumerate(ch+[ch[1]+12]):put(K,inst('epiano',mtof(c),2.5,.12),t0+k*.04)
        if bar%2:put(K,inst('epiano',mtof(ch[2]+12),1.2,.08),t0+2.5*b)
    song('labe_fm',84,36,FM,dr,bs,ky,swing=.3)
def st_rap():
    KK,SS,HH=kick(140,42,6,2),snare(200,15,.5),hat(lvl=.12)
    def dr(D,bar,t0,b,s):
        for x in(0,.75,2.5):put(D,KK,t0+x*b)
        for x in(1,3):put(D,SS,t0+x*b)
        for i in range(8):put(D,HH,t0+i*b/2+sw(i,b,.2))
    def bs(B,bar,t0,b,r,ch):
        for x,l in((0,.7),(.75,1.6),(2.5,1.4)):put(B,inst('808',mtof(r-24),l*b,.6),t0+x*b)
    def ky(K,bar,t0,b,r,ch,p):
        for i,c in enumerate([ch[0],ch[2],ch[1],ch[2]]):put(K,inst('piano',mtof(c+12),1.2,.12),t0+i*b)
    song('rap_predlice',90,36,AM,dr,bs,ky)
def st_trap():
    KK,CL,HH=kick(130,38,4,2.2,.8),clap(),hat(lvl=.09)
    def dr(D,bar,t0,b,s):
        put(D,KK,t0);put(D,KK,t0+1.75*b,.8);put(D,CL,t0+2*b)
        n=16 if bar%2 else 8
        for i in range(n):put(D,HH,t0+i*4*b/n)
        if bar%4==3:
            for i in range(6):put(D,HH,t0+3*b+i*b/6,.8)
    def bs(B,bar,t0,b,r,ch):
        put(B,inst('808',mtof(r-24),2*b,.75),t0);put(B,inst('808',mtof(r-21),1.5*b,.7),t0+2.5*b)
    def ky(K,bar,t0,b,r,ch,p):
        for i in range(4):put(K,inst('bell',mtof(ch[i%3]+24),1.0,.07),t0+i*b+(b/2 if i%2 else 0))
        put(K,inst('pad',mtof(ch[0]),4*b,.06),t0)
    song('bass_usti',140,48,DM,dr,bs,ky)
def st_old():
    KK,SS,HH=kick(110,50,9,1.4),snare(220,14,.6),hat(lvl=.12)
    def dr(D,bar,t0,b,s):
        for x in(0,1.5,2.5):put(D,KK,t0+x*b)
        for x in(1,3):put(D,SS,t0+x*b)
        for i in range(8):put(D,HH,t0+i*b/2+sw(i,b,.5))
    def bs(B,bar,t0,b,r,ch):
        for i,(x,o) in enumerate(((0,0),(.75,12),(1.5,7),(2.5,0),(3.25,10))):put(B,inst('funk',mtof(r-12+o),.35*b,.4),t0+x*b)
    def ky(K,bar,t0,b,r,ch,p):
        for x in(.5,2.5):
            for c in ch:put(K,inst('brass',mtof(c),.25*b,.05),t0+x*b)
    song('oldschool',94,36,CM,dr,bs,ky,swing=.5)
def st_synth():
    KK,SS=kick(150,48,7,1.6),snare(200,12,.4)
    def dr(D,bar,t0,b,s):
        for x in range(4):put(D,KK,t0+x*b)
        for x in(1,3):put(D,SS,t0+x*b,.9)
    def bs(B,bar,t0,b,r,ch):
        for i in range(8):put(B,inst('saw',mtof(r-12+(12 if i%2 else 0)),b/2*.9,.35),t0+i*b/2)
    def ky(K,bar,t0,b,r,ch,p):
        put(K,inst('pad',mtof(ch[0]),4*b,.08),t0)
        for i in range(16):put(K,inst('pluck',mtof(ch[i%3]+12+(12 if i%8>5 else 0)),.2,.07),t0+i*b/4)
    song('nocni_usti',108,40,DM,dr,bs,ky)
def st_dnb(name,reese=True,liquid=False,jungle=False):
    bpm=168 if jungle else 174
    KK,SS,HH=kick(180,48,9,2.2,.35),snare(210,15,.6,.3),hat(lvl=.09)
    def dr(D,bar,t0,b,s):
        if jungle:pat=[(0,'K'),(.5,'K'),(1,'S'),(1.75,'S'),(2.5,'K'),(2.75,'K'),(3,'S'),(3.5,'S')]
        else:pat=[(0,'K'),(1,'S'),(2.5,'K'),(3,'S')]+([(3.75,'S')] if bar%4==3 else [])
        for x,k in pat:put(D,KK if k=='K' else SS,t0+x*b,1 if float(x).is_integer() or k=='K' else .55)
        for i in range(8):put(D,HH,t0+i*b/2,1 if i%2 else .6)
    def bs(B,bar,t0,b,r,ch):
        if reese:
            for x,l in((0,1.5),(1.5,.5),(2,2)):put(B,inst('reese',mtof(r-24),l*b,.45),t0+x*b)
        else:put(B,inst('sub',mtof(r-24),4*b,.55),t0)
    def ky(K,bar,t0,b,r,ch,p):
        put(K,inst('pad',mtof(ch[0]-12),4*b,.06),t0)
        if liquid:
            for i,c in enumerate(ch):put(K,inst('epiano',mtof(c),2,.1),t0+i*b*.66)
    def ex(E,bar,t0,b,r,ch,p):
        if bar%2==0 and p==1:
            for i,a in enumerate([0,2,1,2,0,2,1,2]):put(E,inst('pluck',mtof(ch[a]+12),.2,.05),t0+i*b/2)
    song(name,bpm,64,DM if not liquid else FM,dr,bs,ky,ex)
def st_classic():
    b=60/66;bars=24;N=int((bars*4*b+4)*SR);S=np.zeros(N);P=np.zeros(N)
    prog=[(48,[48,52,55,60,64]),(48,[48,50,57,62,65]),(47,[47,50,55,62,65]),(48,[48,52,55,60,64]),(48,[48,52,57,64,69]),(48,[48,50,54,57,62]),(47,[47,50,55,62,67]),(47,[47,48,52,55,60])]
    for bar in range(bars):
        r,ch=prog[bar%8];t0=bar*4*b
        put(S,inst('strings',mtof(r-12),4*b,.12),t0);put(S,inst('strings',mtof(ch[2]),4*b,.08),t0);put(S,inst('strings',mtof(ch[4]+12),4*b,.06),t0)
        for i in range(8):put(P,inst('piano',mtof(ch[1+(i%4)]),1.5,.1),t0+i*b/2)
    master(verb(S,3.5,.5)+verb(P,2.5,.35),'klasika_fm',tgt=-17)
def st_polka():
    b=60/120;bars=32;N=int((bars*4*b+2)*SR);D=np.zeros(N);B=np.zeros(N);A=np.zeros(N)
    prog=[(48,[60,64,67]),(43,[55,59,62]),(43,[55,59,62]),(48,[60,64,67]),(48,[60,64,67]),(41,[53,57,60]),(43,[55,59,62]),(48,[60,64,67])]
    mel=[72,71,72,74,76,76,74,72, 71,72,74,71,67,67,69,71, 74,72,71,72,74,76,77,76, 74,74,72,71,72,72,72,0]
    KK,SS=kick(120,60,12,1),snare(250,20,.2)
    for bar in range(bars):
        r,ch=prog[bar%8];t0=bar*4*b
        for x in(0,2):put(B,inst('brass',mtof(r-12),.8*b,.25),t0+x*b);put(D,KK,t0+x*b)
        for x in(1,3):
            for c in ch:put(A,inst('accordion',mtof(c),.6*b,.06),t0+x*b)
            put(D,SS,t0+x*b,.6)
        if bar>=4:
            for i in range(4):
                m=mel[((bar-4)*4+i)%len(mel)]
                if m:put(A,inst('brass',mtof(m),.9*b,.1),t0+i*b)
    master(F(D,9000)+F(B,1200)+verb(A,1.2,.2),'dechovka')
def st_chase():
    KK,SS,HH=kick(170,50,9,2,.35),snare(230,14,.6),hat(lvl=.1)
    def dr(D,bar,t0,b,s):
        for x in(0,.75,1.5,2,2.75,3.5):put(D,KK,t0+x*b)
        for x in(1,3):put(D,SS,t0+x*b)
        for i in range(16):put(D,HH,t0+i*b/4,.7 if i%2 else 1)
    def bs(B,bar,t0,b,r,ch):
        for i in range(16):put(B,inst('saw',mtof(r-24+(12 if i%4==3 else 0)),b/4*.8,.4),t0+i*b/4)
    def ky(K,bar,t0,b,r,ch,p):
        for i in range(4):put(K,inst('brass',mtof(ch[i%3]+(12 if bar%2 else 0)),.35*b,.07),t0+i*b+.0)
    def ex(E,bar,t0,b,r,ch,p):
        if bar%4==0:put(E,inst('strings',mtof(r+12),8*b,.06),t0)
    song('honicka',146,48,[(45,[57,60,64]),(46,[58,62,65]),(45,[57,60,64]),(44,[56,60,63])],dr,bs,ky,ex)
def st_race():
    KK,SS,HH=kick(160,50,8,1.8),clap(),hat(o=True,lvl=.07)
    def dr(D,bar,t0,b,s):
        for x in range(4):put(D,KK,t0+x*b)
        for x in(1,3):put(D,SS,t0+x*b,.8)
        for x in range(4):put(D,HH,t0+x*b+b/2)
    def bs(B,bar,t0,b,r,ch):
        for i in range(8):put(B,inst('reese',mtof(r-12),b/2*.85,.35),t0+i*b/2+b/4)
    def ky(K,bar,t0,b,r,ch,p):
        put(K,inst('pad',mtof(ch[0]),4*b,.08),t0)
        for i in range(16):put(K,inst('saw',mtof(ch[(i*2)%3]+12),.12,.05),t0+i*b/4)
    song('zavod',132,48,DM,dr,bs,ky)
# ================== SFX ==================
def sfx():
    o=lambda x,n:master(x,n,'sfx',-16,'96k')
    t=T(.9);x=F(rng.standard_normal(len(t)),300)*np.exp(-t*5)*1.4+np.sin(2*np.pi*np.cumsum(70*np.exp(-t*4)+30)/SR)*np.exp(-t*6)
    x+=F(F(rng.standard_normal(len(t)),1200,True),5000)*np.exp(-t*9)*.7
    for k in range(10):tt=rng.random()*.35;put(x,F(rng.standard_normal(int(.05*SR)),3000,True)*np.exp(-T(.05)*60)*.5,tt)
    for k in range(4):put(x,inst('bell',800+rng.random()*1800,.4,.12),.05+rng.random()*.3)
    o(x,'crash')
    t=T(2.2);x=F(rng.standard_normal(len(t)),180)*np.exp(-t*2)*2+F(rng.standard_normal(len(t)),900)*np.exp(-t*6)+np.sin(2*np.pi*np.cumsum(55*np.exp(-t*2)+25)/SR)*np.exp(-t*2.5)*1.2
    o(verb(np.tanh(x*1.5),2.5,.3),'explosion')
    t=T(.35);x=F(rng.standard_normal(len(t)),900,True)*np.exp(-t*40)+F(rng.standard_normal(len(t)),400)*np.exp(-t*14)*1.2+np.sin(2*np.pi*np.cumsum(160*np.exp(-t*30)+60)/SR)*np.exp(-t*25)
    o(verb(np.tanh(x*2),.6,.2),'shot')
    t=T(.9);x=sum((2*((f*t)%1)-1) for f in(349,440));x=F(x,1800)*np.minimum(1,t/.015)*np.minimum(1,(.9-t)/.05);o(x,'horn')
    t=T(1.4);f=900+2600*np.minimum(1,t/1.0);x=F(rng.standard_normal(len(t)),2000,True)*np.sin(np.pi*np.minimum(1,t/1.4))+np.sin(2*np.pi*np.cumsum(f)/SR)*.08*np.exp(-t*1.2)
    x+=np.sin(2*np.pi*np.cumsum(80+40*t)/SR)*.4*np.sin(np.pi*np.minimum(1,t/1.4));o(x,'nitro')
    t=T(2.0);x=np.zeros(len(t))
    for f0 in(1050,1180,1320):x+=np.sin(2*np.pi*np.cumsum(f0*(1+.03*np.sin(2*np.pi*13*t)+.02*rng.standard_normal(len(t)).cumsum()/len(t)))/SR)
    x=x/3*.6+F(F(rng.standard_normal(len(t)),900,True),3500)*.5;o(x,'skid')
    t=T(.45);x=F(rng.standard_normal(len(t)),1500,True)*np.exp(-t*9)*np.minimum(1,t/.01)+F(rng.standard_normal(len(t)),300)*np.exp(-t*20)*.6;o(x,'blowoff')
    t=T(.25);x=F(rng.standard_normal(len(t)),300)*np.exp(-t*22)*1.4+np.sin(2*np.pi*90*t)*np.exp(-t*25);o(x,'thud')
    t=T(1.6);x=np.zeros(len(t))
    for k in range(int(1.6*2)):
        s=np.sin(2*np.pi*(960 if k%2 else 770)*T(.5))*np.minimum(1,T(.5)/.01);put(x,s*.3,k*.5)
    o(x,'siren')
    t=T(.12);o(np.sin(2*np.pi*np.cumsum(1400-600*t/.12)/SR)*np.exp(-t*30)*.6+F(rng.standard_normal(len(t)),3000,True)*np.exp(-t*60)*.2,'click')
    t=T(1.2);x=sum(inst('bell',mtof(m),1.2,.3) for m in(72,76,79))+inst('bell',mtof(84),1.2,.2)*0;o(x,'cash')
which=sys.argv[1:] or ['all']
jobs={'labe':st_labe,'rap':st_rap,'trap':st_trap,'old':st_old,'synth':st_synth,'dnb':lambda:st_dnb('chemicka_dnb'),'liquid':lambda:st_dnb('liquid_labe',False,True),'jungle':lambda:st_dnb('jungle_strekov',True,False,True),
 'classic':st_classic,'polka':st_polka,'chase':st_chase,'race':st_race,'sfx':sfx}
for k,f in jobs.items():
    if 'all' in which or k in which:f()
