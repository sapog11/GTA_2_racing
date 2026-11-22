# Rig + animate (walk/idle/run) the generated people via Tripo. Key injected by proxy.
import json,subprocess,time,os,sys
API='https://api.tripo3d.ai/v2/openapi'
def req(path,data=None):
    cmd=['curl','-s','-m','60',API+path,'-H','Authorization: Bearer x']
    if data is not None:cmd+=['-H','Content-Type: application/json','-d',json.dumps(data)]
    return json.loads(subprocess.run(cmd,capture_output=True,text=True).stdout)
def wait(t):
    while True:
        d=req('/task/'+t)['data']
        if d['status']=='success':return d['output']
        if d['status'] in('failed','cancelled','banned','expired','unknown'):raise Exception(d['status'])
        time.sleep(6)
out='design/people/raw';os.makedirs(out,exist_ok=True)
for line in open('design/people/tasks.txt'):
    n,t=line.split()
    dst=os.path.join(out,n+'_anim.glb')
    if os.path.exists(dst):continue
    try:
        rig=req('/task',{'type':'animate_rig','original_model_task_id':t,'out_format':'glb'})['data']['task_id'];wait(rig)
        an=req('/task',{'type':'animate_retarget','original_model_task_id':rig,'out_format':'glb','animations':['preset:walk','preset:idle','preset:run'],'bake_animation':True})['data']['task_id'];o=wait(an)
        subprocess.run(['curl','-sfL','-m','180','-o',dst,o['model']]);print('done',n,flush=True)
    except Exception as e:print('fail',n,e,flush=True)
print('ALL DONE',flush=True)
