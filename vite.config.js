import {defineConfig} from 'vite';
import fs from 'node:fs';
const {version}=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8'));
const highlights=JSON.parse(fs.readFileSync(new URL('./src/release-highlights.json',import.meta.url),'utf8'));
if(highlights.version!==version||!highlights.title||!highlights.features?.length)throw new Error('Add current-version release highlights before building the client.');
export default defineConfig({publicDir:false,base:'./',build:{target:'esnext'},define:{__APP_VERSION__:JSON.stringify(version)}});

