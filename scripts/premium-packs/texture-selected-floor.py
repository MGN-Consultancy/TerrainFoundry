"""Embed the saved top albedo in a selected floor GLB; preserve every triangle.

Only upward scenic faces above the protected base receive the image. Sockets,
underside and vertical mechanical surfaces keep their original material.
Writes a new candidate and an exact geometry/hash receipt, never the input.
"""
import argparse, hashlib, json, struct
from pathlib import Path
import numpy as np

p = argparse.ArgumentParser()
p.add_argument('--input', type=Path, required=True)
p.add_argument('--atlas', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--inset-mm', type=float, default=0.3)
a = p.parse_args()
if a.output.exists() or a.input.resolve() == a.output.resolve():
    raise SystemExit('Use a fresh output path')
b = a.input.read_bytes()
if b[:4] != b'glTF' or struct.unpack_from('<I', b, 4)[0] != 2:
    raise SystemExit('Expected GLB 2')
n = struct.unpack_from('<I', b, 12)[0]
d = json.loads(b[20:20+n]); start = 28+n
binary = bytearray(b[start:])
if len(d['meshes']) != 1 or len(d['meshes'][0]['primitives']) != 1:
    raise SystemExit('Expected one selected indexed floor primitive')
pr = d['meshes'][0]['primitives'][0]
def read(i, width, dtype):
    ac=d['accessors'][i]; v=d['bufferViews'][ac['bufferView']]
    dt=np.dtype(dtype)
    return np.ndarray((ac['count'],width),dtype=dt,buffer=binary,
        offset=v.get('byteOffset',0)+ac.get('byteOffset',0),
        strides=(v.get('byteStride',dt.itemsize*width),dt.itemsize)).copy()
pos=read(pr['attributes']['POSITION'],3,'<f4')
ac=d['accessors'][pr['indices']]
dtype={5121:'u1',5123:'<u2',5125:'<u4'}[ac['componentType']]
faces=read(pr['indices'],1,dtype).reshape(-1,3)
tri=pos[faces]; normals=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
mask=(normals[:,1]>1e-8)&(tri[:,:,1].min(axis=1)>5.4)
if not mask.any(): raise SystemExit('No scenic top faces')
lo=pos.min(axis=0); hi=pos.max(axis=0); size=hi-lo
uv=np.empty((len(pos),2),dtype='<f4')
uv[:,0]=(pos[:,0]-lo[0])/size[0]
# glTF image origin is top-left; +Z is the bottom of a top-down image.
uv[:,1]=(pos[:,2]-lo[2])/size[2]
inset=np.array([a.inset_mm/size[0],a.inset_mm/size[2]])
uv[:]=inset+uv*(1-2*inset)
def append(array,typ,target,component):
    binary.extend(b'\0'*((-len(binary))%4)); at=len(binary)
    payload=np.ascontiguousarray(array).tobytes(); binary.extend(payload)
    d['bufferViews'].append({'buffer':0,'byteOffset':at,'byteLength':len(payload),'target':target})
    d['accessors'].append({'bufferView':len(d['bufferViews'])-1,'componentType':component,'count':len(array),'type':typ})
    return len(d['accessors'])-1
uvi=append(uv,'VEC2',34962,5126)
topi=append(faces[mask].astype('<u4').reshape(-1),'SCALAR',34963,5125)
basei=append(faces[~mask].astype('<u4').reshape(-1),'SCALAR',34963,5125)
binary.extend(b'\0'*((-len(binary))%4)); at=len(binary); atlas=a.atlas.read_bytes(); binary.extend(atlas)
d['bufferViews'].append({'buffer':0,'byteOffset':at,'byteLength':len(atlas)})
d.setdefault('images',[]).append({'bufferView':len(d['bufferViews'])-1,'mimeType':'image/png'})
d.setdefault('samplers',[]).append({'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071})
d.setdefault('textures',[]).append({'source':len(d['images'])-1,'sampler':len(d['samplers'])-1})
d.setdefault('materials',[]).append({'name':'Saved floor top albedo','pbrMetallicRoughness':{'baseColorTexture':{'index':len(d['textures'])-1},'metallicFactor':0,'roughnessFactor':0.92}})
attrs={k:v for k,v in pr['attributes'].items() if k!='COLOR_0'}; attrs['TEXCOORD_0']=uvi
d['meshes'][0]['primitives']=[{'attributes':attrs,'indices':topi,'material':len(d['materials'])-1,'mode':4},{**pr,'indices':basei}]
# Groups partition existing indices without reordering any triangle vertices.
assert np.array_equal(np.sort(np.r_[np.where(mask)[0],np.where(~mask)[0]]),np.arange(len(faces)))
binary.extend(b'\0'*((-len(binary))%4));d['buffers'][0]['byteLength']=len(binary)
j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
out=b'glTF'+struct.pack('<II',2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(out)
sha=lambda x:hashlib.sha256(x).hexdigest()
report={'input':str(a.input),'inputSha256':sha(b),'atlas':str(a.atlas),'atlasSha256':sha(atlas),'outputSha256':sha(out),'geometryUnchanged':True,'triangleCount':len(faces),'texturedTopFaces':int(mask.sum()),'protectedFaces':int((~mask).sum()),'insetMm':a.inset_mm,'physicalFitVerified':False,'visualReviewPending':True}
a.output.with_suffix('.texture.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
