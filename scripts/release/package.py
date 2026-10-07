"""Package editor and scenery as independently verifiable files."""
import hashlib,json
from pathlib import Path
import os
root=Path(__file__).resolve().parents[2]
version=json.loads((root/'package.json').read_text(encoding='utf-8-sig'))['version']
out=root/'release/publish';out.mkdir(parents=True,exist_ok=True)
component=os.environ.get('TERRAIN_COMPONENT','full').lower()
if component not in {'full','migration','launcher','client','content'}:raise ValueError('Unknown release component')
lists={'component':component,'content':{}}
if component in {'full','migration','client'}:
    client=root/f'release/desktop-{version}/TerrainFoundry-win32-x64'
    client_files={}
    for file in sorted(client.rglob('*')):
        if file.is_symlink():raise ValueError('Symlink in client package')
        if not file.is_file():continue
        rel=file.relative_to(client).as_posix();data=file.read_bytes();digest=hashlib.sha256(data).hexdigest()
        path_id=hashlib.sha256(rel.encode('utf-8')).hexdigest()[:16]
        name=f'client-{path_id}-{digest[:16]}.bin'
        (out/name).write_bytes(data)
        client_files[rel]={'artifact':name,'size':len(data),'sha256':digest}
    lists['client']={'files':client_files}
if component in {'full','migration','content'}:
    for folder in sorted((root/'release/asset-packs').iterdir()):
        if not folder.is_dir():continue
        files={}
        for file in sorted(folder.rglob('*')):
            if file.is_symlink():raise ValueError('Symlink in release')
            if not file.is_file() or file.name=='index.json':continue
            rel=file.relative_to(folder).as_posix();data=file.read_bytes();digest=hashlib.sha256(data).hexdigest()
            path_id=hashlib.sha256(rel.encode('utf-8')).hexdigest()[:16]
            name=f'content-{folder.name}-{path_id}-{digest[:16]}.bin'
            (out/name).write_bytes(data)
            files[rel]={'artifact':name,'size':len(data),'sha256':digest}
        lists['content'][folder.name]={'files':files,'index':json.loads((folder/'index.json').read_text(encoding='utf-8'))}
if component in {'full','migration','launcher'}:
    (out/'TerrainFoundryLauncher.exe').write_bytes((root/'launcher/TerrainFoundryLauncher.exe').read_bytes())
(out/'package-files.json').write_text(json.dumps(lists),encoding='utf-8')
