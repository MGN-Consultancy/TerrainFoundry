"""Regression tests for texture seams, mechanical-face isolation and GLB compaction.

Run with the production Python runtime (NumPy and Pillow required).
"""
import json,struct,subprocess,sys,tempfile,unittest
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
def glb(path):
 positions=np.array([[0,8,0],[0,8,10],[10,8,0],[0,0,0]],dtype='<f4')
 arrays=[positions,np.ones((4,3),dtype='<f4'),np.full((4,3),.3,dtype='<f4'),np.array([0,1,2,0,2,3],dtype='<u4')]
 binary=bytearray();views=[];accessors=[]
 for array in arrays:
  views.append({'buffer':0,'byteOffset':len(binary),'byteLength':array.nbytes});binary.extend(array.tobytes())
  accessors.append({'bufferView':len(views)-1,'count':len(array),'componentType':5125 if array.dtype.kind=='u' else 5126,'type':'SCALAR' if array.ndim==1 else 'VEC3'})
 d={'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'COLOR_0':2},'indices':3,'material':0}]}],'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1]}}],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':accessors}
 j=json.dumps(d).encode();j+=b' '*((-len(j))%4)
 path.write_bytes(b'glTF'+struct.pack('<II',2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary)
 return positions
def read(path):
 b=path.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);binary=b[28+n:]
 def accessor(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];dtype={5125:'<u4',5126:'<f4'}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
  return np.frombuffer(binary,dtype=dtype,count=a['count']*width,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width)
 return d,accessor,binary
def run(script,*args,ok=True):
 result=subprocess.run([sys.executable,str(ROOT/'scripts/premium-packs'/script),*map(str,args)],capture_output=True,text=True)
 if ok and result.returncode:raise AssertionError(result.stderr)
 return result
class TextureTools(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.r=Path(self.temp.name);self.source=self.r/'source.glb';self.positions=glb(self.source);self.atlas=self.r/'atlas.png';Image.new('RGB',(2,2),(100,80,40)).save(self.atlas)
 def tearDown(self):self.temp.cleanup()
 def test_floor_preserves_winding_and_excludes_vertical_mechanical_face(self):
  out=self.r/'floor.glb';run('texture-selected-floor.py','--input',self.source,'--atlas',self.atlas,'--output',out)
  d,ac,_=read(out);top,base=d['meshes'][0]['primitives'];np.testing.assert_array_equal(ac(top['indices']).ravel(),[0,1,2]);np.testing.assert_array_equal(ac(base['indices']).ravel(),[0,2,3]);self.assertNotIn('TEXCOORD_0',base['attributes']);self.assertIn('TEXCOORD_0',top['attributes']);np.testing.assert_array_equal(ac(top['attributes']['POSITION']),self.positions)
  self.assertNotEqual(run('texture-selected-floor.py','--input',self.source,'--atlas',self.atlas,'--output',out,ok=False).returncode,0)
 def test_uv_seams_and_trimesh_v_conversion_survive_compaction(self):
  mapping=self.r/'map.npz';uv=np.array([[[.1,.2],[.2,.3],[.3,.4]],[[.8,.9],[.7,.8],[.6,.7]]],dtype='<f4');faces=np.array([[0,1,2],[0,2,3]],dtype='<u4');np.savez(mapping,positions=self.positions,indices=faces,sourceTextureUv=uv,sourceTextureFallbackFaces=[False,False])
  out=self.r/'textured.glb';run('apply-source-texture-to-glb.py','--mapped-mesh',mapping,'--atlas',self.atlas,'--target-glb',self.source,'--output-glb',out)
  d,ac,_=read(out);pr=d['meshes'][0]['primitives'][0];indices=ac(pr['indices']).reshape(-1,3);np.testing.assert_array_equal(ac(pr['attributes']['POSITION'])[indices],self.positions[faces]);wanted=uv.copy();wanted[:,:,1]=1-wanted[:,:,1];np.testing.assert_allclose(ac(pr['attributes']['TEXCOORD_0'])[indices],wanted,atol=1e-6);self.assertGreater(len(ac(pr['attributes']['POSITION'])),len(self.positions))
  compact=self.r/'compact.glb';run('compact-display-glb.py',out,compact);c,ca,b=read(compact);cp=c['meshes'][0]['primitives'][0];np.testing.assert_array_equal(ca(cp['attributes']['POSITION'])[ca(cp['indices']).reshape(-1,3)],self.positions[faces]);im=c['images'][0];v=c['bufferViews'][im['bufferView']];self.assertEqual(b[v['byteOffset']:v['byteOffset']+v['byteLength']],self.atlas.read_bytes());self.assertLess(compact.stat().st_size,out.stat().st_size)
if __name__=='__main__':unittest.main()
