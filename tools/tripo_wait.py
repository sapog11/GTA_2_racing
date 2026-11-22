# Poll Tripo tasks listed as "name task_id" lines and download results. Usage: tripo_wait.py tasks.txt outdir [model|rig|anim]
import sys, json, subprocess, time, os
API='https://api.tripo3d.ai/v2/openapi'
def req(path,data=None):
    cmd=['curl','-s','-m','60',API+path,'-H','Authorization: Bearer proxy-injected']
    if data is not None:cmd+=['-H','Content-Type: application/json','-d',json.dumps(data)]
    return json.loads(subprocess.run(cmd,capture_output=True,text=True).stdout)
lines=[l.split() for l in open(sys.argv[1]) if len(l.split())==2 and not l.split()[1].startswith('{')]
out=sys.argv[2];os.makedirs(out,exist_ok=True);pend=dict(lines)
while pend:
    for n,t in list(pend.items()):
        d=req('/task/'+t).get('data',{});s=d.get('status')
        if s=='success':
            o=d.get('output',{});u=o.get('pbr_model') or o.get('model') or o.get('base_model')
            r=subprocess.run(['curl','-sfL','-m','180','-o',os.path.join(out,n+'.glb'),u]);print('done' if r.returncode==0 else 'dlfail',n,flush=True);pend.pop(n)
        elif s in('failed','cancelled','banned','expired','unknown'):print('task',s,n,flush=True);pend.pop(n)
    time.sleep(8)
print('ALL DONE',flush=True)
