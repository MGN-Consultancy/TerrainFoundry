"""Restore the pinned, freely released sculpt geometry for reproducible builds."""
from pathlib import Path
import hashlib,json,urllib.request,zipfile
root=Path(__file__).resolve().parents[2]
lock=json.loads((root/'release-config/deepstone.json').read_text(encoding='utf-8'))
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
for source in lock['archives']:
 archive=root/('release/'+source['id']+'-source.zip');archive.parent.mkdir(parents=True,exist_ok=True)
 if not archive.exists() or digest(archive)!=source['sha256']:
  with urllib.request.urlopen(source['url'],timeout=120) as response,archive.open('wb') as output:
   while block:=response.read(1024*1024):output.write(block)
 if digest(archive)!=source['sha256']:raise RuntimeError('Starter pack checksum mismatch')
 dest=root/'release/asset-packs'/source['id'];dest.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(archive) as z:
  for entry in z.infolist():
   target=(dest/entry.filename).resolve()
   if not target.is_relative_to(dest.resolve()) or entry.file_size>600000000:raise RuntimeError('Unsafe source archive')
  z.extractall(dest)
index=json.loads((root/'release/asset-packs/deepstone/index.json').read_text(encoding='utf-8'))
if len(index)!=50 or any(not k.startswith('dg-') for k in index):raise RuntimeError('Unexpected source catalogue')
for f in ['src/generated/builtin-index.json','desktop/builtin-index.json']:
 p=root/f;all=json.loads(p.read_text(encoding='utf-8'));all.update({k:{**v,'pack':'deepstone'} for k,v in index.items()});p.write_text(json.dumps(all,separators=(',',':')),encoding='utf-8')
print('Verified and restored all 50 free Deepstone assets')
