"""Loopback-only OpenAI audio bridge; credentials stay on the gateway host."""
import hmac
import json
import struct
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import urllib.error
import urllib.parse
import urllib.request

CONFIG = json.loads((Path(__file__).parent / 'tts-config.json').read_text())
SLOTS = threading.BoundedSemaphore(3)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def error(self, code, message):
        data = json.dumps({'error': {'message': message, 'type': 'tts_error'}}).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != '/v1/audio/speech':
            return self.error(404, 'Unknown endpoint')
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + CONFIG['bridge_key']):
            return self.error(401, 'Unauthorized')
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 12000:
                return self.error(413, 'Invalid request size')
            body = json.loads(self.rfile.read(size))
            text = body.get('input')
            if body.get('model') != 'fox-wise-tts' or not isinstance(text, str) or not 0 < len(text.strip()) <= 1200:
                return self.error(400, 'Invalid model or input')
        except (ValueError, TypeError):
            return self.error(400, 'Invalid request')
        if not SLOTS.acquire(blocking=False):
            return self.error(429, 'Speech service busy')
        started = False
        try:
            payload = {'model': CONFIG['model'], 'input': {'text': text, 'voice': CONFIG['voice'], 'language_type': 'Chinese'}}
            if body.get('stream_format') == 'sse':
                request = urllib.request.Request('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + CONFIG['source_key'], 'Content-Type': 'application/json', 'X-DashScope-SSE': 'enable'})
                with urllib.request.urlopen(request, timeout=35) as response:
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/event-stream')
                    self.send_header('Cache-Control', 'no-store')
                    self.send_header('X-Accel-Buffering', 'no')
                    self.end_headers()
                    started = True
                    received = False
                    finished = False
                    for line in response:
                        if not line.startswith(b'data:'):
                            continue
                        event = json.loads(line[5:])
                        if event.get('code'):
                            raise ValueError('Upstream synthesis error')
                        output = event.get('output') or {}
                        audio = output.get('audio') or {}
                        if audio.get('data'):
                            received = True
                            message = {'type': 'speech.audio.delta', 'audio': audio['data'], 'sample_rate': 24000}
                            self.wfile.write(('data: ' + json.dumps(message) + '\n\n').encode())
                            self.wfile.flush()
                        if output.get('finish_reason') == 'stop' or audio.get('url'):
                            finished = True
                    if not received or not finished:
                        raise ValueError('Incomplete audio stream')
                    self.wfile.write(b'data: {"type":"speech.audio.done"}\n\n')
                    self.wfile.flush()
                return
            request = urllib.request.Request('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + CONFIG['source_key'], 'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=35) as response:
                result = json.load(response)
            url = result.get('output', {}).get('audio', {}).get('url', '')
            parsed = urllib.parse.urlsplit(url)
            if parsed.scheme not in ('http', 'https') or not (parsed.hostname or '').endswith('.aliyuncs.com') or parsed.username or parsed.password or parsed.port not in (None, 443, 80):
                raise ValueError('Unexpected audio host')
            url = urllib.parse.urlunsplit(('https', parsed.netloc, parsed.path, parsed.query, ''))
            with urllib.request.urlopen(url, timeout=20) as response:
                audio = response.read(16 * 1024 * 1024 + 1)
            if len(audio) > 16 * 1024 * 1024 or not audio.startswith(b'RIFF'):
                raise ValueError('Unexpected audio response')
            # DashScope sends streaming WAV headers with placeholder lengths.
            # Finalize them before browsers and the gateway calculate duration.
            audio = bytearray(audio)
            struct.pack_into('<I', audio, 4, len(audio) - 8)
            offset = 12
            while offset + 8 <= len(audio):
                length = struct.unpack_from('<I', audio, offset + 4)[0]
                if audio[offset:offset + 4] == b'data':
                    struct.pack_into('<I', audio, offset + 4, len(audio) - offset - 8)
                    break
                offset += 8 + length + (length % 2)
            else:
                raise ValueError('Missing audio data')
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            if started:
                try:
                    self.wfile.write(b'data: {"error":{"message":"Speech synthesis interrupted"}}\n\n')
                    self.wfile.flush()
                except OSError:
                    pass
            else:
                self.error(502, 'Speech synthesis unavailable')
        finally:
            SLOTS.release()

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 21436), Handler).serve_forever()
