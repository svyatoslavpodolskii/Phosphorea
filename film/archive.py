"""Portable source archive; excludes renders, environments and installed dependencies."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
ROOT=Path(__file__).parent
OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
target=OUT/'Phosphorea_Video_Engine.zip'
excluded={'output','node_modules','.venv','__pycache__','.git'}
with ZipFile(target,'w',ZIP_DEFLATED) as archive:
 for file in sorted(ROOT.rglob('*')):
  if file.is_file() and not set(file.relative_to(ROOT).parts)&excluded:
   archive.write(file,Path('film')/file.relative_to(ROOT))
print('Engine source archive:',target)
