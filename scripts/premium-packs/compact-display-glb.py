"""Remove unreferenced buffer data from a static, self-contained display GLB."""
import argparse,base64,json,struct
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('input',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
if a.output.exists():raise SystemExit('Use a fresh output path')
b=a.input.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);old=b[28+n:]
if b[:4]!=b'glTF' or struct.unpack_from('<I',b,4)[0]!=2 or len(d['buffers'])!=1 or 'uri' in d['buffers'][0]:raise SystemExit('Expected self-contained single-buffer GLB 2')
if d.get('animations') or d.get('skins') or any('targets' in p for m in d['meshes'] for p in m['primitives']):raise SystemExit('Static meshes only')
used=set()
for m in d['meshes']:
 for pr in m['primitives']:used.update(pr['attributes'].values());used.add(pr['indices'])
amap={v:i for i,v in enumerate(sorted(used))};accessors=[d['accessors'][v] for v in sorted(used)]
if any('sparse' in x for x in accessors):raise SystemExit('Sparse accessors unsupported')
views=set(x['bufferView'] for x in accessors)
views.update(x['bufferView'] for x in d.get('images',[]) if 'bufferView' in x)
vmap={v:i for i,v in enumerate(sorted(views))};binary=bytearray();newviews=[]
for v in sorted(views):
 view=dict(d['bufferViews'][v]);at=view.get('byteOffset',0);data=old[at:at+view['byteLength']]
 binary.extend(b'\0'*((-len(binary))%4));view['byteOffset']=len(binary);view['buffer']=0;binary.extend(data);newviews.append(view)
for im in d.get('images',[]):
 if 'bufferView' in im:im['bufferView']=vmap[im['bufferView']]
 elif im.get('uri','').startswith('data:'):
  data=base64.b64decode(im.pop('uri').split(',',1)[1]);binary.extend(b'\0'*((-len(binary))%4));newviews.append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)});binary.extend(data);im['bufferView']=len(newviews)-1
 else:raise SystemExit('External image dependency')
for ac in accessors:ac['bufferView']=vmap[ac['bufferView']]
for m in d['meshes']:
 for pr in m['primitives']:pr['attributes']={k:amap[v] for k,v in pr['attributes'].items()};pr['indices']=amap[pr['indices']]
d['accessors']=accessors;d['bufferViews']=newviews;binary.extend(b'\0'*((-len(binary))%4));d['buffers']=[{'byteLength':len(binary)}]
j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
out=b'glTF'+struct.pack('<II',2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
a.output.write_bytes(out);print(json.dumps({'beforeBytes':len(b),'afterBytes':len(out),'savedBytes':len(b)-len(out)}))
