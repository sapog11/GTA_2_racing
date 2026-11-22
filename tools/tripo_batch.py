# Batch image->3D through the Tripo API. Key is injected by the network proxy (never stored here).
import json, os, sys, time, glob, urllib.request, subprocess
API='https://api.tripo3d.ai/v2/openapi'
ROOT=os.path.join(os.path.dirname(__file__),'..','design','parts');OUT=os.path.join(ROOT,'raw3d');os.makedirs(OUT,exist_ok=True)
STATE=os.path.join(OUT,'tasks.json');st=json.load(open(STATE)) if os.path.exists(STATE) else {}
def req(path,data=None):
    cmd=['curl','-s','-m','60',API+path,'-H','Authorization: Bearer proxy-injected']
    if data is not None:cmd+=['-H','Content-Type: application/json','-d',json.dumps(data)]
    o=subprocess.run(cmd,capture_output=True,text=True).stdout;j=json.loads(o)
    if j.get('code')!=0:raise Exception(o[:200])
    return j
def upload(f):
    o=subprocess.run(['curl','-s','-m','90',API+'/upload','-H','Authorization: Bearer proxy-injected','-F','file=@'+f],capture_output=True,text=True).stdout
    return json.loads(o)['data']['image_token']
imgs=sorted(glob.glob(os.path.join(ROOT,'*','*.jpg')))
for f in imgs:
    car=os.path.basename(os.path.dirname(f));name=car+'_'+os.path.splitext(os.path.basename(f))[0]
    if name in st or os.path.exists(os.path.join(OUT,name+'.glb')):continue
    try:
        tok=upload(f);r=req('/task',{'type':'image_to_model','file':{'type':'jpg','file_token':tok},'texture':True,'pbr':True,'face_limit':20000})
        st[name]=r['data']['task_id'];print('submitted',name,flush=True)
    except Exception as e:print('fail',name,e,flush=True)
    json.dump(st,open(STATE,'w'),indent=1);time.sleep(1)
pending=dict(st)
while pending:
    for name,tid in list(pending.items()):
        dst=os.path.join(OUT,name+'.glb')
        if os.path.exists(dst):pending.pop(name);continue
        try:d=req('/task/'+tid)['data']
        except Exception as e:print('poll err',name,e,flush=True);continue
        s=d.get('status')
        if s=='success':
            o=d.get('output',{});url=o.get('pbr_model') or o.get('model') or o.get('base_model')
            r=subprocess.run(['curl','-sfL','-m','120','-o',dst,url]);print('done' if r.returncode==0 else 'dl-fail',name,url.split('/')[2] if url else '',flush=True)
            if r.returncode!=0:print('url',url,flush=True)
            pending.pop(name)
        elif s in('failed','cancelled','banned','expired','unknown'):print('task',s,name,flush=True);pending.pop(name)
    time.sleep(10)
print('ALL DONE',flush=True)
