from rig_workflows import *
import subprocess
parts=[('eyelid-lower-left',4,-6,[[164,343],[147,337],[181,337],[181,351],[147,351],[147,337],[164,343]]),('eyelid-upper-right',6,28,[[210,326],[193,313],[237,313],[237,341],[193,341],[193,313],[210,326]]),('eyelid-lower-right',6,-6,[[212,343],[196,337],[237,337],[237,351],[196,351],[196,337],[212,343]])]
def run(name,plan):
 save(name,plan)
 p=subprocess.run(['python3',str(BASE/'swing-workflow.py'),str(BASE/name)],capture_output=True,text=True)
 raw=(BASE/'last-swing-workflow.json').read_text();(BASE/('result-'+name)).write_text(raw)
 r=json.JSONDecoder().raw_decode(raw)[0]
 print(json.dumps({'plan':name,'ok':r['ok'],'error':r.get('error'),'last_vertices':[n['name'] for s in r['steps'][-2:] for n in s.get('numeric',[]) if n['screenBounds'][:2] in [[256,849],[255,871]]]},ensure_ascii=False),flush=True)
 if p.returncode or not r['ok']:raise SystemExit(1)
 return r
for name,row,amount,points in parts:
 p=key_setup(name,row)+[param(row,0),tree(),action('main','Solo'),tree(),{'op':'drag','from':'main','selector':{'path':CANVAS,'role':'panel'},'points':points},tree()]
 r=run('workflow-select-'+name+'.json',p)
 final=[s for s in r['steps'] if s['op']=='tree'][-1]
 if not any(n['name']!='-' and n['enabled'] and n['screenBounds'][:2]==[255,871] for n in final['numeric']):raise SystemExit('Vertices are not selected; no movement')
 run('workflow-move-'+name+'.json',delta_y(amount)+[action('main','Solo'),tree(),param(row,105),tree(),action('main','保存')])
