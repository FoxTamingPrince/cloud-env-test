import {randomUUID} from 'node:crypto';

// Official external API envelope:
// https://github.com/Live2D-Garage/CubismExternalAppPluginSamples/tree/54alpha/04_EditSample
// Importing this module performs no connection, registration, or model mutation.
export class CubismApiClient {
  constructor({url='ws://127.0.0.1:22033',version='1.1.0'}={}) {
    const target=new URL(url);
    if(!['127.0.0.1','localhost','[::1]'].includes(target.hostname))
      throw new Error('This authoring client only connects to a local editor.');
    this.url=url;this.version=version;this.pending=new Map();
  }
  async connect(timeoutMs=5000) {
    this.socket=new WebSocket(this.url);
    this.socket.addEventListener('message',event=>{
      let message;
      try{message=JSON.parse(String(event.data));}catch{return;}
      if(!['Response','Error'].includes(message.Type))return;
      const call=this.pending.get(message.RequestId);if(!call)return;
      clearTimeout(call.timer);this.pending.delete(message.RequestId);
      if(message.Type==='Error')call.reject(new Error(JSON.stringify(message.Data)));
      else call.resolve(message.Data);
    });
    this.socket.addEventListener('close',()=>this.rejectPending('Editor connection closed'));
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.socket.close();reject(new Error('Editor connection timed out'));},timeoutMs);
      this.socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      this.socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Editor API is unavailable'));},{once:true});
    });
  }
  request(method,data={},timeoutMs=10000) {
    if(this.socket?.readyState!==WebSocket.OPEN)throw new Error('Client is not connected');
    const RequestId=randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        this.pending.delete(RequestId);
        reject(new Error(`${method} timed out; state is unknown, do not retry mutations automatically`));
      },timeoutMs);
      this.pending.set(RequestId,{resolve,reject,timer});
      try{this.socket.send(JSON.stringify({Version:this.version,RequestId,Type:'Request',Method:method,Data:data}));}
      catch(error){clearTimeout(timer);this.pending.delete(RequestId);reject(error);}
    });
  }
  async inspect() {
    const approval=await this.request('GetIsApproval');
    if(!approval.Result)throw new Error('Editor has not approved this client');
    const current=await this.request('GetCurrentModelUID');
    if(!current.ModelUID)throw new Error('No current model');
    return {current,editApproval:await this.request('GetIsEditApproval')};
  }
  async edit(operation,{authorized=false}={}) {
    if(!authorized)throw new Error('Model editing must be explicitly enabled by the caller');
    const approval=await this.request('GetIsEditApproval');
    if(!approval.Result)throw new Error('Editor edit permission has not been granted');
    const begun=await this.request('EditBegin',{Silent:true});
    if(!begun.Result)throw new Error('Editor did not begin the transaction');
    try {
      const result=await operation(this);
      const ended=await this.request('EditEnd',{Cancel:false});
      if(!ended.Result)throw new Error('Editor did not confirm transaction completion');
      return result;
    } catch(error) {
      try{await this.request('EditEnd',{Cancel:true});}
      catch{throw new AggregateError([error], 'Editor state requires reconciliation before more mutations');}
      throw error;
    }
  }
  rejectPending(reason) {
    for(const call of this.pending.values()){clearTimeout(call.timer);call.reject(new Error(reason));}
    this.pending.clear();
  }
  close(){this.rejectPending('Client closed');this.socket?.close();}
}
