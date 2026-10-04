const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,mocks={}) {
 const filename=path.join(root,file);
 const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',output)(name=>{
  if(name in mocks)return mocks[name];
  if(name.startsWith('@/'))return load(name.slice(2)+'.ts',mocks);
  if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts')),mocks);
  return require(name);
 },mod,mod.exports);return mod.exports;
}
module.exports={load};
