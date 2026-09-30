import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
test('editor, launcher and website text retain UTF-8 punctuation',async()=>{
 for(const file of ['src/main.js','launcher/Launcher.cs','site/index.html','site/print-service.js','site/print-terms.html','README.md','print-service/README.md']){
  const source=await fs.readFile(file,'utf8');
  assert.doesNotMatch(source,/(?:\u00c2[\u0080-\u00bf]|\u00e2[\u0080-\u00bf\u2000-\u20ff])/,file+' contains double-encoded UTF-8');
 }
});
