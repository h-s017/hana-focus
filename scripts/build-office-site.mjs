import {mkdir,copyFile,cp,rm,stat} from 'node:fs/promises';import path from 'node:path';
export const pages=['index.html','workspace.html','ai-office.html','agent-center.html','social-editor.html','visual-library.html','manifest.webmanifest','sw.js'];
export async function buildSite(root,dest){
 const source=path.resolve(root),target=path.resolve(dest);
 if(target===source||!target.startsWith(source+path.sep))throw Error('output_must_be_inside_project');
 if(path.basename(target)!=='public-site')throw Error('output_must_be_public_site');
 await rm(target,{recursive:true,force:true}); // Generated staging only; source/production are untouched.
 await mkdir(target,{recursive:true});
 for(const p of pages)await copyFile(path.join(source,p),path.join(target,p));
 for(const p of ['icons','js','content'])await cp(path.join(source,p),path.join(target,p),{recursive:true});
 // Preserve legacy public tools in docs without replacing the authoritative root work board.
 for(const p of ['brand-visual-lab','interactive-studio']){
  const src=path.join(source,'docs',p);try{await stat(src);await cp(src,path.join(target,p),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 await copyFile(path.join(source,'index.html'),path.join(target,'index.html'));
 await import('node:fs/promises').then(fs=>fs.writeFile(path.join(target,'.nojekyll'),''));
 return target;
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){console.log(await buildSite(process.cwd(),path.join(process.cwd(),'public-site')));}
