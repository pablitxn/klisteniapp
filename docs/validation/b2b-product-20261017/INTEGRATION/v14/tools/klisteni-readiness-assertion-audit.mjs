import ts from '/workspace/klisteni-readiness/node_modules/typescript/lib/typescript.js'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {writeFileSync} from 'node:fs'
const base='4ec0273151194acb189ac6ed327033d66366dbd5'
const candidate='831203470d4c21322b8bc3ce7c4dedb7f84fe5d7'
const git=(ref,path)=>execFileSync('git',['show',`${ref}:${path}`],{cwd:'/workspace/klisteni-readiness',encoding:'utf8'})
function assertions(text){
 const tree=ts.createSourceFile('scenario.ts',text,ts.ScriptTarget.Latest,true);const found=[]
 function visit(node){
  if(ts.isCallExpression(node)&&node.getText(tree).startsWith('expect')&&!ts.isPropertyAccessExpression(node.parent)) found.push(node.getText(tree))
  ts.forEachChild(node,visit)
 }
 visit(tree);return found
}
const files=['sync','health','week','history'].map(name=>{
 const path=`apps/b2c-web/e2e/b2b-product-${name}.spec.ts`;const before=assertions(git(base,path));const after=assertions(git(candidate,path));
 const unchanged=JSON.stringify(before)===JSON.stringify(after)
 if(!unchanged)throw Error(`Assertion difference ${path}`)
 return {path,assertionCalls:before.length,allCallTextsUnchanged:true,sha256:createHash('sha256').update(JSON.stringify(before)).digest('hex')}
})
const result={baseQaSha:base,candidateSha:candidate,files,qualification:'AST-extracted outer expect call text is byte-identical in these scenario files. This does not replace semantic review of changed setup/navigation helpers.'}
writeFileSync('/tmp/klisteni-readiness-runtime/assertion-preservation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
