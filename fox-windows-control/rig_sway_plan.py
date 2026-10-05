from rig_workflows import *
S='摇摆运动的自动生成'
def sway(parameter,h,v):
 p=[tree('s',S),{'op':'comboSelect','from':'s','selector':{'path':'c0/c1/c0/c0/c2/c0/c0/c1/c0/c2'},'text':parameter+' = 0.0'},tree('s',S),{'op':'comboSelect','from':'s','selector':{'path':'c0/c1/c0/c0/c2/c0/c0/c5/c0/c0/c2'},'text':'下'},tree('s',S)]
 for key,value in [('c2',h),('c4',v),('c6',10),('c8',0)]:
  p += [{'op':'setValue','from':'s','selector':{'path':'c0/c1/c0/c0/c2/c0/c0/c5/c1/c0/'+key+'/c2','role':'slider'},'value':value},tree('s',S)]
 p += [{'op':'asyncAction','from':'s','selector':{'name':'水平翻转摇摆','role':'check box'},'action':'单击','ensureValue':0},tree('s',S),action('s','更新关键点','push button',pendingOk=True),tree('c',S,modal=True),action('c','确定','push button'),tree(),action('main','保存')]
 return p
if __name__=='__main__':save('workflow-head-sway-y.json',sway('ParamAngleY',0,25))
