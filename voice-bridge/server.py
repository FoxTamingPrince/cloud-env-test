"""Loopback-only streaming ASR endpoint for the authenticated Fox gateway."""
import asyncio, base64, hmac, json, os, secrets, time, uuid
from pathlib import Path
import numpy as np
import sherpa_onnx
from websockets.asyncio.server import serve

ROOT=Path.home()/"Library/Application Support/sherpa-onnx-voice"
KEYFILE=ROOT/"fox-relay.key"
if not KEYFILE.exists():
 fd=os.open(KEYFILE,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,"w") as f:f.write(secrets.token_urlsafe(32))
KEY=KEYFILE.read_text().strip()
MODEL="fox-local-streaming-asr"
recognizer=None
busy=False

def get_recognizer():
 global recognizer
 if recognizer is None:
  m=ROOT/"model"
  recognizer=sherpa_onnx.OnlineRecognizer.from_transducer(tokens=str(m/"tokens.txt"),encoder=str(m/"encoder-epoch-99-avg-1.int8.onnx"),decoder=str(m/"decoder-epoch-99-avg-1.int8.onnx"),joiner=str(m/"joiner-epoch-99-avg-1.int8.onnx"),num_threads=1,provider="cpu",enable_endpoint_detection=True,rule1_min_trailing_silence=15,rule2_min_trailing_silence=.55,rule3_min_utterance_length=28)
 return recognizer

def authorize(connection,request):
 auth=request.headers.get("Authorization","")
 if not hmac.compare_digest(auth,"Bearer "+KEY):return connection.respond(401,"Unauthorized")
 if request.path.split("?",1)[0]!="/v1/realtime":return connection.respond(404,"Not found")

async def handle(ws):
 global busy
 if busy:
  await ws.send(json.dumps({"type":"error","error":{"message":"Local speech recognizer is busy"}}));await ws.close(1013);return
 busy=True
 try:
  r=await asyncio.to_thread(get_recognizer)
  stream=r.create_stream();ready=False;previous="";total=0;started=time.monotonic()
  async def emit(kind,**fields):
   await ws.send(json.dumps({"event_id":str(uuid.uuid4()),"type":kind,**fields},ensure_ascii=False))
  await emit("session.created",session={"model":MODEL,"input_audio_format":"pcm","sample_rate":16000})
  while time.monotonic()-started<120:
    raw=await asyncio.wait_for(ws.recv(),timeout=min(15,120-(time.monotonic()-started)))
    d=json.loads(raw);kind=d.get("type")
    if kind=="session.update":
     if ready:raise ValueError("Session already configured")
     s=d.get("session",{})
     if s.get("input_audio_format")!="pcm" or s.get("sample_rate",16000)!=16000:raise ValueError("Requires PCM16 mono at 16000 Hz")
     ready=True
     await emit("session.updated",session={"model":MODEL,"input_audio_format":"pcm","sample_rate":16000})
    elif kind=="input_audio_buffer.append":
     if not ready:raise ValueError("Configure session first")
     pcm=base64.b64decode(d.get("audio",""),validate=True)
     if not pcm or len(pcm)%2 or len(pcm)>32000:raise ValueError("Invalid audio chunk")
     total+=len(pcm)
     if total>32000*120 or total>32000*(time.monotonic()-started+5):raise ValueError("Audio limit exceeded")
     samples=np.frombuffer(pcm,dtype="<i2").astype(np.float32)/32768
     def decode():
      stream.accept_waveform(16000,samples)
      while r.is_ready(stream):r.decode_stream(stream)
      return r.get_result(stream),r.is_endpoint(stream)
     text,endpoint=await asyncio.to_thread(decode)
     if text!=previous:
      previous=text
      await emit("conversation.item.input_audio_transcription.text",text=text,stash="")
     if endpoint and text.strip():
      await emit("conversation.item.input_audio_transcription.completed",transcript=text)
      return
    else:raise ValueError("Unsupported event")
 except (ValueError,TimeoutError):
  await ws.send(json.dumps({"type":"error","error":{"message":"Invalid audio or session timed out"}}))
 except Exception:
  # Never log audio, transcripts or authorization headers.
  pass
 finally:busy=False

async def main():
 async with serve(handle,"127.0.0.1",11435,process_request=authorize,max_size=65536,max_queue=8,ping_interval=20):
  await asyncio.Future()
if __name__=="__main__":asyncio.run(main())
