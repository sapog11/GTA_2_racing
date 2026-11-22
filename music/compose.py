# Original procedural tracks for ÚSTÍ racing (no samples, no third-party audio). Run: python3 music/compose.py
import numpy as np, subprocess, os
SR=44100;rng=np.random.default_rng(7)
def env(n,a,d,s=0.0,r=0.0,sus=None):
    sus=n if sus is None else sus;e=np.zeros(n);A=int(a*SR);D=int(d*SR)
    t=np.arange(n)
    e=np.where(t<A,t/max(A,1),np.exp(-(t-A)/max(D,1)*3)*(1-s)+s)
    return e
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR);y=np.empty_like(x);acc=0.0
    for i in range(len(x)):acc=(1-a)*x[i]+a*acc;y[i]=acc
    return y
def lp_fast(x,fc,block=2048):
    # FFT brickwall-ish lowpass (smooth rolloff) for long signals
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);X*=1/(1+(f/fc)**4);return np.fft.irfft(X,len(x))
def hp_fast(x,fc):
    X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);X*=1/(1+(fc/np.maximum(f,1))**4);return np.fft.irfft(X,len(x))
def reverb(x,sec=2.2,mix=.25):
    n=int(sec*SR);ir=rng.standard_normal(n)*np.exp(-np.arange(n)/SR*3.2/sec*2.3);ir=lp_fast(ir,6000);ir/=np.sqrt((ir**2).sum())
    L=len(x)+n;N=1<<int(np.ceil(np.log2(L)));y=np.fft.irfft(np.fft.rfft(x,N)*np.fft.rfft(ir,N),N)[:len(x)]
    return x*(1-mix)+y*mix*3
def place(buf,snd,t):
    i=int(t*SR);j=min(len(buf),i+len(snd));buf[i:j]+=snd[:j-i]
def kick(dur=.45,f0=140,f1=42,drive=1.6):
    n=int(dur*SR);t=np.arange(n)/SR;f=f1+(f0-f1)*np.exp(-t*28);ph=2*np.pi*np.cumsum(f)/SR
    return np.tanh(np.sin(ph)*np.exp(-t*7)*drive)*.95
def snare(dur=.3,tone=190):
    n=int(dur*SR);t=np.arange(n)/SR;nz=hp_fast(rng.standard_normal(n),1500)*np.exp(-t*18)*.8
    return (nz*.55+np.sin(2*np.pi*tone*t)*np.exp(-t*22)*.5)
def hat(dur=.06,open_=False):
    n=int((.3 if open_ else dur)*SR);t=np.arange(n)/SR;nz=hp_fast(rng.standard_normal(n),7500)
    return nz*np.exp(-t*(9 if open_ else 55))*.11
def note(f,dur,kind='piano',vol=.3):
    n=int(dur*SR);t=np.arange(n)/SR
    if kind=='piano':
        s=sum(np.sin(2*np.pi*f*k*t)*(.6**(k-1))*np.exp(-t*(1.2+k*.7)) for k in range(1,7))
        s*=np.minimum(1,t/.004)
    elif kind=='pad':
        s=sum(np.sin(2*np.pi*f*(1+d)*t+rng.random()*6) for d in(-.004,0,.0035,.007))/3
        s*=np.minimum(1,t/.6)*np.minimum(1,(dur-t)/.5)
    elif kind=='808':
        fg=f*(1+.5*np.exp(-t*30));s=np.tanh(np.sin(2*np.pi*np.cumsum(fg)/SR)*1.8)*np.exp(-t*1.1)
    elif kind=='reese':
        s=sum(2*((f*(1+d)*t+rng.random())%1)-1 for d in(-.012,-.004,.004,.012))/4
        s*=np.minimum(1,t/.02)*np.minimum(1,(dur-t)/.05)
    elif kind=='pluck':
        s=(2*((f*t)%1)-1)*np.exp(-t*9)+np.sin(2*np.pi*f*2*t)*np.exp(-t*12)*.4
    return s*vol
def mtof(m):return 440*2**((m-69)/12)
def master(x,name,tgt=-14):
    x=x/np.max(np.abs(x))*.98;x=np.tanh(x*1.4)/np.tanh(1.4)
    rms=np.sqrt((x**2).mean());g=10**(tgt/20)/max(rms,1e-6);x=np.clip(x*min(g,3),-.99,.99)
    st=np.stack([x,np.roll(x,int(.011*SR))*.97+x*.03],1)
    w=os.path.join(os.path.dirname(__file__),name+'.wav');import wave
    with wave.open(w,'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((st*32767).astype('<i2').tobytes())
    out=os.path.join(os.path.dirname(__file__),'..','public','music',name+'.mp3');os.makedirs(os.path.dirname(out),exist_ok=True)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',w,'-codec:a','libmp3lame','-b:a','128k',out]);os.remove(w);print(name,round(len(x)/SR),'s')

# ---------------- Track 1: "Noc na Klíši" — dark boom-bap, 88 bpm ----------------
def track1():
    bpm=88;b=60/bpm;bars=40;T=bars*4*b+2;N=int(T*SR);drums=np.zeros(N);bass=np.zeros(N);keys=np.zeros(N);pad=np.zeros(N)
    prog=[(57,[57,60,64]),(53,[53,57,60]),(55,[55,59,62]),(52,[52,55,59,62])]  # Am F G Em7
    K=kick();S=snare();H=hat();HO=hat(open_=True)
    for bar in range(bars):
        t0=bar*4*b;root,ch=prog[(bar//2)%4];intro=bar<4;outro=bar>=bars-2
        for c in ch:place(pad,note(mtof(c),4*b,'pad',.09),t0)
        if bar%2==0 or bar>8:
            for k,c in enumerate(ch+[ch[0]+12]):place(keys,note(mtof(c+12),1.6,'piano',.12),t0+k*b*.5*(bar%4==3)+ (0 if k<3 else 2*b))
        if intro or outro:continue
        for s in(0,1.75,2.5) if bar%4!=3 else (0,1.5,2.25,2.75):place(drums,K,t0+s*b)
        for s in(1,3):place(drums,S,t0+s*b+ .012)
        for i in range(8):place(drums,(HO if i==7 and bar%2 else H)*(.8 if i%2 else 1),t0+i*b/2+(.018 if i%2 else 0))
        for s,ln in((0,1.4),(1.75,.6),(2.5,1.3)):place(bass,note(mtof(root-24),ln*b,'808',.55),t0+s*b)
    crack=hp_fast(rng.standard_normal(N),3000)*(rng.random(N)>.9995)*.25+lp_fast(rng.standard_normal(N),5000)*.0015
    mix=lp_fast(drums,9000)*.9+lp_fast(bass,180)*.9+reverb(lp_fast(keys,4200),2.4,.35)*.8+reverb(lp_fast(pad,2500),3,.5)*.6+crack
    master(mix,'noc_na_klisi')

# ---------------- Track 2: "Chemička 174" — liquid/neuro DnB ----------------
def track2():
    bpm=174;b=60/bpm;bars=64;T=bars*4*b+2;N=int(T*SR);drums=np.zeros(N);bass=np.zeros(N);pad=np.zeros(N);lead=np.zeros(N)
    K=kick(.35,180,48,2.2);S=snare(.28,210);H=hat(.04)
    prog=[(50,[62,65,69]),(46,[58,62,65]),(53,[65,69,72]),(48,[60,64,67])]  # Dm Bb F C
    arp=[0,2,1,2,0,2,1,3]
    for bar in range(bars):
        t0=bar*4*b;root,ch=prog[(bar//4)%4];sec=bar//16
        for c in ch:place(pad,note(mtof(c-12),4*b,'pad',.07),t0)
        if sec>=1:
            for i,a in enumerate(arp):place(lead,note(mtof(ch[a%3]+12*(a//3)),.25,'pluck',.07),t0+i*b/2)
        if bar<8:continue
        pat=[(0,'K'),(1,'S'),(2.5,'K'),(3,'S')] if bar%4!=3 else [(0,'K'),(1,'S'),(1.75,'S'),(2.5,'K'),(3,'S'),(3.5,'S')]
        for s,k in pat:place(drums,K if k=='K' else S*(1 if s.is_integer() else .5),t0+s*b)
        for i in range(8):place(drums,H*(1 if i%2 else .6),t0+i*b/2)
        if sec in(1,3):
            for s,ln in((0,1.5),(1.5,.5),(2,2)):place(bass,note(mtof(root-24),ln*b,'reese',.4),t0+s*b)
        else:place(bass,note(mtof(root-24),4*b,'808',.45),t0)
    mix=lp_fast(drums,12000)*.85+lp_fast(bass,420)*.9+reverb(pad,3.2,.5)*.7+reverb(lp_fast(lead,5000),1.6,.35)*.6
    master(mix,'chemicka_174')
track1();track2()
