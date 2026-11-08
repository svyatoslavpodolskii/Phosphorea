from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import html,sys
root=Path('artifacts/design-audit');stage=sys.argv[1] if len(sys.argv)>1 else 'after'
files=sorted((root/stage).glob('*.png'))
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
for group in ['mobile','desktop','theme']:
 selected=[p for p in files if p.name.startswith(group)]
 if not selected:continue
 cols=6 if group=='theme' else 5;w=210;h=470 if group!='desktop' else 200
 sheet=Image.new('RGB',(cols*w,((len(selected)+cols-1)//cols)*h),'#e6e7e9');draw=ImageDraw.Draw(sheet)
 for i,p in enumerate(selected):
  im=Image.open(p).convert('RGB');im.thumbnail((w-12,h-42));x=(i%cols)*w+6;y=(i//cols)*h+34;sheet.paste(im,(x,y));draw.text((x,y-28),p.stem.replace('theme-','')[:29],font=font,fill='#202327')
 sheet.save(root/f'{stage}-{group}-contact.jpg')
cards=''.join(f'<figure><a href="{stage}/{html.escape(p.name)}"><img loading="lazy" src="{stage}/{html.escape(p.name)}"></a><figcaption>{html.escape(p.stem)}</figcaption></figure>' for p in files)
(root/f'{stage}.html').write_text('<!doctype html><meta charset="utf-8"><title>Phosphora — '+stage+'</title><style>body{background:#151719;color:#ddd;font:14px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}figure{margin:0}img{max-width:100%;max-height:620px;border-radius:16px}figcaption{margin:8px 0}a{color:inherit}</style><h1>Phosphora · '+stage+'</h1><p><a href="before.html">До</a> · <a href="after.html">После</a></p><p>Звуки: касание, деление зума, удержание, перенос</p><audio controls src="tactile-feedback.wav"></audio><main>'+cards+'</main>',encoding='utf-8')
print(len(files),'screenshots')
