"""Deterministic archives; unchanged scenery keeps its hash across client releases."""
import hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
version=json.loads((root/'package.json').read_text(encoding='utf-8-sig'))['version']
out=root/'release/publish';out.mkdir(parents=True,exist_ok=True)
lists={}
def archive(folder,name):
    hashes={}
    with zipfile.ZipFile(out/name,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
        for f in sorted(folder.rglob('*')):
            if f.is_symlink():raise ValueError('Symlink in release')
            if not f.is_file():continue
            data=f.read_bytes();rel=f.relative_to(folder).as_posix();hashes[rel]=hashlib.sha256(data).hexdigest()
            info=zipfile.ZipInfo(rel,(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
    lists[name]=hashes;print(name,(out/name).stat().st_size,flush=True)
archive(root/f'release/desktop-{version}/TerrainFoundry-win32-x64',f'TerrainFoundry-client-{version}-win-x64.zip')
for folder in sorted((root/'release/asset-packs').iterdir()):
    if folder.is_dir():archive(folder,'scenery-'+folder.name+'.zip')
(out/'package-files.json').write_text(json.dumps(lists),encoding='utf-8')
(out/'TerrainFoundryLauncher.exe').write_bytes((root/'launcher/TerrainFoundryLauncher.exe').read_bytes())
