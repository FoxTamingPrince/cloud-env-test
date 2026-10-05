from rig_workflows import *
import subprocess
for name,row in [('eye-white-left',4),('iris-right',6),('eye-white-right',6)]:
 plan='workflow-'+name+'.json';save(plan,blink_opacity(name,row))
 p=subprocess.run(['python3',str(BASE/'swing-workflow.py'),str(BASE/plan)],capture_output=True,text=True)
 raw=(BASE/'last-swing-workflow.json').read_text();(BASE/('result-'+name+'.json')).write_text(raw)
 r=json.JSONDecoder().raw_decode(raw)[0]
 print(json.dumps({'part':name,'ok':r['ok'],'error':r.get('error'),'opacity_states':[[n['name'] for n in s.get('numeric',[]) if n['screenBounds'][:2]==[245,682]] for s in r['steps'] if s['op']=='tree']},ensure_ascii=False),flush=True)
 if p.returncode or not r['ok']:raise SystemExit(1)
