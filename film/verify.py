"""Decode the delivered MP4 and verify its format, duration, audio and black seam."""
from pathlib import Path
import json,re,subprocess
import imageio_ffmpeg

P=Path(__file__).parent
timeline=json.loads((P/'timeline.json').read_text(encoding='utf-8'))
video=P/'output'/'Phosphorea_Kinetic_Film_v6_1080x1920_60fps.mp4'
ff=imageio_ffmpeg.get_ffmpeg_exe()
def run(args):
 r=subprocess.run([ff,*args],capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf-8',errors='replace'))
 return r
r=run(['-hide_banner','-i',str(video),'-f','null','-'])
log=r.stderr.decode('utf-8',errors='replace')
frames=int(re.findall(r'frame=\s*(\d+)',log)[-1])
expected=round(sum(s['duration'] for s in timeline['shots'])*timeline['fps'])
assert frames==expected,(frames,expected)
assert '1080x1920' in log and '60 fps' in log and '48000 Hz, stereo' in log
cursor=0;starts={}
for s in timeline['shots']:starts[s['id']]=cursor;cursor+=s['duration']
black=[]
for t in [starts['27_logo']-1/60,starts['27_logo']]:
 raw=run(['-v','error','-ss',str(t),'-i',str(video),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']).stdout
 assert len(raw)==1080*1920*3
 black.append(max(raw));assert max(raw)<=2,('Nonblack seam',t,max(raw))
report={'file':video.name,'width':1080,'height':1920,'fps':60,'duration':round(cursor,3),'decodedFrames':frames,'seamBlackMax':black,'fullDecodeVerified':True}
(P/'output'/'delivery-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
