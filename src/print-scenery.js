import {builtinIndex} from './builtin-data.js';
let native;
if(typeof process!=='undefined'&&process.versions?.node){const {createRequire}=await import(/* @vite-ignore */'node:module'),{fileURLToPath}=await import(/* @vite-ignore */'node:url');native=createRequire(import.meta.url)('../desktop/print-scenery.cjs').createPrintSceneryReader(fileURLToPath(new URL('..',import.meta.url)));}
export function detailedPrintFiles(id){if(!builtinIndex[id]?.printFiles)return null;return globalThis.window?.desktop?.readPrintScenery?window.desktop.readPrintScenery(id):native?.(id)||null;}
