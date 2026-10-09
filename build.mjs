import {build} from 'esbuild';
import {rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await build({entryPoints:{portal:'src/portal.js',admin:'src/admin.js','home-auth':'src/home-auth.js'},bundle:true,format:'esm',splitting:true,minify:true,outdir:'dist',loader:{'.html':'text','.svg':'text'}});
