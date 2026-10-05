"""Run scoped PowerShell on the documented home Windows SSH connection."""
import base64
import json
from pathlib import Path
import subprocess
import sys

script = Path(sys.argv[1]).read_text()
program = r'''
import base64,json,subprocess,sys
s=json.load(sys.stdin)['script']
command='powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand '+base64.b64encode(s.encode('utf-16le')).decode()
opts=['-o','BatchMode=yes','-o','ControlMaster=no','-o','ControlPath=none','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=5']
r=subprocess.run(['ssh',*opts,'mobile-computer-frp',command],stdin=subprocess.DEVNULL,capture_output=True,timeout=45)
print(r.stdout.decode('utf-8',errors='replace'))
if r.returncode: print(r.stderr.decode('utf-8',errors='replace'))
sys.exit(r.returncode)
'''
remote = "python3 -c '"+program.replace("'","'\"'\"'")+"'"
r=subprocess.run(['ssh','-o','BatchMode=yes','company-server-direct',remote], input=json.dumps({'script':script}).encode(),capture_output=True,timeout=60)
print(r.stdout.decode(errors='replace'))
if r.returncode: print(r.stderr.decode(errors='replace'))
sys.exit(r.returncode)
