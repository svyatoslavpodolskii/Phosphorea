from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).parent/'output';stills=json.loads((root/'stills.json').read_text(encoding='utf-8'))
candidates=['C:/Windows/Fonts/segoeui.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','/Library/Fonts/Arial.ttf']
font=next((ImageFont.truetype(f,17) for f in candidates if Path(f).exists()),ImageFont.load_default())
for part in range((len(stills)+14)//15):
 selected=stills[part*15:(part+1)*15];sheet=Image.new('RGB',(1200,4*560),'#101713');draw=ImageDraw.Draw(sheet)
 for i,item in enumerate(selected):
  x=(i%4)*300;y=(i//4)*560;im=Image.open(item['path']).convert('RGB');im.thumbnail((290,516));sheet.paste(im,(x,y));draw.text((x+10,y+520),f"{item['time']:05.2f}  {item['id']}",fill='#d5e6da',font=font)
 sheet.save(root/f'contact-{part+1}.jpg',quality=92)
