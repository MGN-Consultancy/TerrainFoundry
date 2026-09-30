import {defineConfig} from 'vite';
import fs from 'node:fs';
const {version}=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8'));
export default defineConfig({publicDir:false,base:'./',build:{target:'esnext'},define:{__APP_VERSION__:JSON.stringify(version)}});

