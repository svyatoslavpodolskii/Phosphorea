"""Original 100 BPM score. Recorded piano/cello; separately editable music and foley stems."""
import json,subprocess,wave
from pathlib import Path
import numpy as np
import imageio_ffmpeg

ROOT=Path(__file__).parent;OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
timeline=json.loads((ROOT/'timeline.json').read_text(encoding='utf-8'));cursor=0
for shot in timeline['shots']:shot['start']=cursor;cursor+=shot['duration']
shots={shot['id']:shot for shot in timeline['shots']}
T=lambda name:shots[name]['start']
B=T('02_spawn');GROW=T('22_growth');SILENCE=T('25_silence');REVEAL=T('26_world');LOGO=T('27_logo');END=T('28_end')
SR=48000;SECONDS=cursor;N=round(SR*SECONDS);FF=imageio_ffmpeg.get_ffmpeg_exe()
rng=np.random.default_rng(80271)
music=np.zeros((N,2),np.float32);sfx=np.zeros_like(music);cache={};events=[]
def midi(name):
 return {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[name[0]]+12*(int(name[-1])+1)+(1 if '#' in name else 0)
def load(instrument,name):
 key=(instrument,name)
 if key not in cache:
  raw=subprocess.check_output([FF,'-v','error','-i',str(ROOT/'assets'/'samples'/f'{instrument}-{name}.mp3'),'-f','f32le','-ac','1','-ar',str(SR),'-af','lowpass=f=3200' if instrument=='piano' else 'lowpass=f=2400','pipe:1'])
  data=np.frombuffer(raw,np.float32).copy();active=np.flatnonzero(np.abs(data)>.0006)
  if len(active):data=data[max(0,active[0]-40):]
  data/=max(.01,np.max(np.abs(data)));cache[key]=data
 return cache[key]
def place(stem,at,data,gain=1,pan=0):
 start=round(at*SR)
 if start>=N:return
 length=min(len(data),N-start)
 if length<=0:return
 stem[start:start+length,0]+=data[:length]*(gain*np.sqrt((1-pan)/2))
 stem[start:start+length,1]+=data[:length]*(gain*np.sqrt((1+pan)/2))
def note(at,pitch,duration=1.4,gain=.1,instrument='piano',pan=0,soft=False):
 names=['A2','C3','E3','A3','C4','E4','A4','C5','E5'] if instrument=='piano' else ['A2','E3','A3','C4']
 root=min(names,key=lambda name:abs(midi(name)-pitch));source=load(instrument,root);ratio=2**((pitch-midi(root))/12)
 length=min(round(duration*SR),int(len(source)/ratio));data=np.interp(np.arange(length)*ratio,np.arange(len(source)),source).astype(np.float32)
 if not len(data):return
 attack=(.65 if soft else .009) if instrument=='piano' else (.75 if soft else .09);release=min(.45,duration*.35);ts=np.arange(length)/SR
 env=np.minimum(1,ts/attack)*np.minimum(1,np.maximum(0,(length/SR-ts)/release));data*=env
 place(music,at,data,gain,pan)
def click(at,weight=.04,kind='tick'):
 duration=.045 if kind=='tick' else .55;n=int(SR*duration);t=np.arange(n)/SR;noise=rng.standard_normal(n).astype(np.float32)
 if kind=='tick':data=noise*np.minimum(1,t/.001)*np.exp(-t/.004);data[1:]=.5*data[1:]+.5*data[:-1]
 else:
  spectrum=np.fft.rfft(noise);freq=np.fft.rfftfreq(n,1/SR);spectrum*=np.exp(-(freq/2600)**2)*(1-np.exp(-(freq/170)**2));data=np.fft.irfft(spectrum,n)*np.sin(np.pi*t/duration)**2
 place(sfx,at,data.astype(np.float32),weight,float(rng.uniform(-.2,.2)));events.append({'time':round(at,3),'kind':kind,'gain':weight})


# One evolving score. Its rhythmic layer releases before the last rapid cut;
# acoustic tails bridge the black frame instead of being chopped at the edit.
note(T('01_hello')+.12,62,3.6,.14,pan=-.08)
note(T('title_02_spawn'),50,1.8,.09,pan=-.08)
note(T('title_02_spawn')+.6,57,1.6,.065,pan=.08)
chords=[[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,61]]
for k,at in enumerate(np.arange(B,GROW,.6)):
 chord=chords[(k//8)%4];pitch=chord[[2,1,3,2,0,2,1,3][k%8]]+12
 note(float(at),pitch,2,.085 if at<T('12_kanban') else .11,pan=(-.22,.17)[k%2])
 if at>=T('06_link') and k%2==0:note(float(at),chord[0],.8,.06,'cello',-.1)
 if at>=T('14_search'):note(float(at+.3),chord[(k+1)%4]+24,1.2,.036,pan=.30)
for k,at in enumerate(np.arange(GROW,SILENCE-1.2,.3)):
 chord=chords[(k//8)%4];gain=.09+min(.045,k*.0013)
 note(float(at),chord[[0,2,1,3,2,1,3,2][k%8]]+12,2.2,gain,pan=(-.25,.25)[k%2])
 if k%2==0:note(float(at),chord[0],1.1,.075,'cello',-.13)
 if at>=T('24_acceleration')-2:note(float(at+.15),chord[(k+2)%4]+24,1.2,.035,pan=.35)
 if at<SILENCE-1.8:click(float(at),.01)

def action(name,offset=0):return T(name)+shots[name].get('lead',0)+offset
anchors={'02_spawn':[.65,1.10,1.55,2.00],'04_physics_control':[.42],'06_link':[.6],'09_folder':[.22],'10_editor':[.9,1.8,2.7,3.6],'12_kanban':[.65,1.8],'15_pin':[.15],'17_folder_navigation':[.6,2.1]}
for name,points in anchors.items():
 for point in points:click(action(name,point),.021)
for i in range(6):click(action('14_search',.30+i*.12),.014)
click(action('14_search',1.65),.025)
click(action('03_living_drag',1.22),.022,'air')
for i in range(6):click(action('11_customization',i*.6),.017)
click(action('10_suggestions',1.6),.024)
for name in ['03_living_drag','06_link','08_lasso','17_folder_navigation']:click(action(name,.1),.028,'air')

# Seamless musical release. Keep a low spatial tail through the brief black.
release_start=SILENCE-1.4
for stem in [music,sfx]:
 a,b=int(release_start*SR),int(REVEAL*SR)
 stem[a:b]*=np.linspace(1,.025,b-a)[:,None]
 stem[b:]*=.025

# Deep felt-like, staggered attacks with an audible midrange body on phones.
# No simultaneous logo chord and no bright final plink.
for i,pitch in enumerate([38,50,57,62]):
 note(REVEAL+i*.32,pitch,7,.045 if i<2 else .027,pan=(i-1.5)*.17,soft=True)
note(REVEAL+.25,45,6.5,.045,'cello',-.18,soft=True)
for i,pitch in enumerate([38,50,57,62]):
 note(LOGO+.15+i*.38,pitch,7.5,.047 if i<2 else .025,pan=(i-1.5)*.18,soft=True)

# Early room reflections throughout; a long, diffuse stereo tail in the outro.
for delay,level in [(.061,.06),(.109,.045),(.173,.035),(.293,.025)]:
 shift=round(delay*SR);music[shift:]+=music[:-shift,::-1].copy()*level
tail=music[int(REVEAL*SR):].copy()
for delay,level in [(.31,.24),(.57,.20),(.91,.16),(1.37,.12),(1.91,.09),(2.57,.06),(3.23,.04)]:
 shift=round(delay*SR);start=int(REVEAL*SR)+shift;length=min(len(tail),N-start)
 if length>0:music[start:start+length]+=tail[:length,::-1]*level
fade=int(1.5*SR)
for stem in [music,sfx]:stem[-fade:]*=np.linspace(1,0,fade)[:,None]

def save(name,data):
 with wave.open(str(OUT/name),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
peak=float(np.max(np.abs(music+sfx)));gain=.85/max(.85,peak);music*=gain;sfx*=gain
save('music.wav',music);save('foley.wav',sfx);save('mix.wav',music+sfx)
subprocess.run([FF,'-y','-v','error','-i',str(OUT/'mix.wav'),'-af','loudnorm=I=-18:TP=-1.8:LRA=12','-ar',str(SR),str(OUT/'master.wav')],check=True)
(ROOT/'cue-sheet.json').write_text(json.dumps({'bpm':100,'quarter':.6,'growth':GROW,'release':[release_start,REVEAL],'logo':LOGO,'author':END+1.6,'foley':events},ensure_ascii=False,indent=2),encoding='utf-8')
print('Score and separate stems rendered:',OUT)
