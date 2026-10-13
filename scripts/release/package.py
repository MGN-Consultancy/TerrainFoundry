"""Package editor and scenery as independently verifiable files."""
import hashlib,json,re,shutil
from pathlib import Path
import os
root=Path(__file__).resolve().parents[2]
version=json.loads((root/'package.json').read_text(encoding='utf-8-sig'))['version']
out=root/'release/publish';out.mkdir(parents=True,exist_ok=True)
component=os.environ.get('TERRAIN_COMPONENT','full').lower()
if component not in {'full','migration','launcher','client','content'}:raise ValueError('Unknown release component')
lists={'component':component,'content':{}}
def package_file(file,relative,prefix):
    digest=hashlib.sha256()
    with file.open('rb') as source:
        for block in iter(lambda:source.read(1024*1024),b''):digest.update(block)
    sha=digest.hexdigest();path_id=hashlib.sha256(relative.encode('utf-8')).hexdigest()[:16]
    name=f'{prefix}-{path_id}-{sha[:16]}.bin'
    # Copy in bounded chunks; do not allocate an entire model or Electron archive.
    with file.open('rb') as source,(out/name).open('wb') as destination:
        shutil.copyfileobj(source,destination,1024*1024)
    return {'artifact':name,'size':file.stat().st_size,'sha256':sha}

def require_folder(folder):
    if folder.is_symlink() or not folder.is_dir():raise ValueError('Missing or linked package folder: '+str(folder))

pack_ids=[]
if component in {'full','migration','content'}:
    index=json.loads((root/'desktop/builtin-index.json').read_text(encoding='utf-8-sig'))
    pinned=json.loads((root/'release-config/deepstone.json').read_text(encoding='utf-8-sig'))
    pack_ids=sorted({entry['pack'] for entry in index.values()}|{entry['id'] for entry in pinned['archives']})
    if not pack_ids or any(not re.fullmatch(r'[a-z][a-z0-9-]{0,40}',name) for name in pack_ids):raise ValueError('Invalid scenery pack inventory')
    for name in pack_ids:
        folder=root/'release/asset-packs'/name;require_folder(folder)
        if not (folder/'index.json').is_file():raise ValueError('Missing scenery pack index: '+name)
if component in {'full','migration','client'}:
    client=root/f'release/desktop-{version}/TerrainFoundry-win32-x64'
    require_folder(client)
    client_files={}
    for file in sorted(client.rglob('*')):
        if file.is_symlink():raise ValueError('Symlink in client package')
        if not file.is_file():continue
        rel=file.relative_to(client).as_posix()
        client_files[rel]=package_file(file,rel,'client')
    lists['client']={'files':client_files}
if component in {'full','migration','content'}:
    for pack_id in pack_ids:
        folder=root/'release/asset-packs'/pack_id
        files={}
        for file in sorted(folder.rglob('*')):
            if file.is_symlink():raise ValueError('Symlink in release')
            if not file.is_file() or file.name=='index.json':continue
            rel=file.relative_to(folder).as_posix()
            files[rel]=package_file(file,rel,'content-'+folder.name)
        lists['content'][folder.name]={'files':files,'index':json.loads((folder/'index.json').read_text(encoding='utf-8'))}
if component in {'full','migration','launcher'}:
    (out/'TerrainFoundryLauncher.exe').write_bytes((root/'launcher/TerrainFoundryLauncher.exe').read_bytes())
(out/'package-files.json').write_text(json.dumps(lists),encoding='utf-8')
