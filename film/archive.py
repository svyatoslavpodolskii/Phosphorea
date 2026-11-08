"""Portable source archive; excludes renders, environments and installed dependencies."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import os
ROOT=Path(__file__).parent
OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
target=OUT/'Phosphorea_Video_Engine.zip'
excluded={'output','node_modules','.venv','__pycache__','.git'}
with ZipFile(target,'w',ZIP_DEFLATED) as archive:
 for directory,folders,files in os.walk(ROOT,followlinks=False):
  folders[:]=sorted(name for name in folders if name not in excluded and not (Path(directory)/name).is_symlink())
  for name in sorted(files):
   file=Path(directory)/name
   if file.is_file() and not file.is_symlink():archive.write(file,Path('film')/file.relative_to(ROOT))
print('Engine source archive:',target)
