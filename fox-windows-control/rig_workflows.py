import json,pathlib
BASE=pathlib.Path(__file__).parent
W='Live2D Cubism Editor 5.3.04    [ 试用版 剩余 43 天 ]  - fox-live2d-v5.cmo3'
PARAM='c0/c1/c1/c1/c0/c0/c0/c2/c4/c0/c0/c0/c0/c0/c1/c1/c0/c0/c0'
INS='c0/c1/c1/c1/c0/c0/c0/c2/c2/c0/c0/c0/c0/c0/c1/c0/c0/c0/c0/c0/c0/c0'
NAME=INS+'/c0/c0/c1'
OPACITY=INS+'/c7/c0/c1/c0/c0/c0'
CANVAS='c0/c1/c1/c1/c0/c0/c0/c4/c0/c0/c1'
KEYS='c0/c1/c1/c1/c0/c0/c0/c2/c4/c0/c0/c0/c0/c0/c1/c0/c2'
def tree(k='main',w=W,**kw):return {'op':'tree','windowTitle':w,'save':k,**kw}
def action(k,name,role='menu item',**kw):return {'op':'asyncAction','from':k,'selector':{'name':name,'role':role},'action':'单击',**kw}
def select(name):return [tree('search','搜索和替换'),{'op':'setText','from':'search','selector':{'path':'c0/c1/c0/c1/c1/c0/c0/c2','role':'text'},'text':name,'settleMs':900},tree('match','搜索和替换'),{'op':'tableSelection','from':'match','selector':{'role':'table'},'row':0},tree(),{'op':'assert','from':'main','selector':{'path':NAME,'role':'text'},'text':name}]
def param(row,x,k='main'):return {'op':'number','from':k,'selector':{'path':PARAM+f'/c{row}/c1/c4/c0/c0','role':'label'},'text':str(x/105 if x in (0,105) else 0.5)}
def opacity(v,k='main'):return {'op':'number','from':k,'selector':{'path':OPACITY,'role':'label'},'text':str(v)}
def save(name,p):json.dump(p,open(BASE/name,'w'),ensure_ascii=False)
if __name__=='__main__':
 p=select('mouth-interior')+[param(19,0),tree(),{'op':'asyncAction','from':'main','selector':{'path':KEYS},'action':'单击'},tree(),opacity(0),tree(),action('main','保存'),tree()]
 save('workflow-interior-keys.json',p)
SCROLL='c0/c1/c1/c1/c0/c0/c0/c2/c4/c0/c0/c0/c0/c0/c1/c1/c0/c2'
KEY2=KEYS[:-1]+'1'
def key_setup(name,row):
 return select(name)+[{'op':'setValue','from':'main','selector':{'path':SCROLL,'role':'scroll bar'},'value':0,'ensureValue':0},tree(),param(row,105),tree(),{'op':'click','from':'main','selector':{'path':PARAM,'role':'panel'},'x':30,'y':row*26+13},tree(),{'op':'asyncAction','from':'main','selector':{'path':KEY2},'action':'单击'},tree()]
def blink_opacity(name,row):
 return key_setup(name,row)+[param(row,0),tree(),opacity(0),tree(),param(row,105),tree(),action('main','保存')]
DELTA_Y=INS+'/c14/c0/c1/c0/c0/c1/c2'
def delta_y(amount):
 sign='+' if amount>0 else '-';count=abs(amount)
 p=[tree(),{'op':'click','from':'main','selector':{'path':DELTA_Y}},tree('delta','')]
 p += [action('delta',sign+'10','push button') for _ in range(count//10)]
 p += [action('delta',sign+'1','push button') for _ in range(count%10)]
 return p+[tree()]
