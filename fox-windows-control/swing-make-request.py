import json,sys,pathlib
base=pathlib.Path(__file__).parent
s=json.loads((base/sys.argv[1]).read_text())
n=next(x for x in s['result']['nodes'] if x['nodeId']==sys.argv[2])
r={k:s['result'][k] for k in ['windowId','windowTitle']}
r.update(op=sys.argv[3],path=n['path'],expect={k:n[k] for k in ['nodeId','name','role','bounds']})
if len(sys.argv)>4:r.update(json.loads(sys.argv[4]))
(base/'swing-action.json').write_text(json.dumps(r,ensure_ascii=False))
print(json.dumps({k:r[k] for k in ['op','path','expect']},ensure_ascii=False))
