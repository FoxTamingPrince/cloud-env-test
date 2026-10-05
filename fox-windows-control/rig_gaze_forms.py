from rig_workflows import *
def num(row,v):return {'op':'number','from':'main','selector':{'path':PARAM+f'/c{row}/c1/c4/c0/c0','role':'label'},'text':str(v)}
def delta(axis,amount):
 p=[{'op':'click','from':'main','selector':{'path':INS+f'/c13/c0/c1/c0/c0/c{axis}/c2'}},tree('d','')]
 sign='+' if amount>0 else '-';opp='-' if amount>0 else '+';a=abs(amount)
 if a>5:p+=[action('d',sign+'10','push button')]+[action('d',opp+'1','push button') for _ in range(10-a)]
 else:p +=[action('d',sign+'1','push button') for _ in range(a)]
 return p+[tree()]
def forms(row,axis,amount):
 p=[tree(),num(row,1),tree()]+delta(axis,amount)+[num(row,0),tree(),num(row,-1),tree()]+delta(axis,-amount)+[num(row,0),tree(),action('main','Solo'),tree(),action('main','保存')]
 return p
if __name__=='__main__':save('workflow-gaze-x-forms.json',forms(8,0,7))
