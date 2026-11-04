// Uses Playwright's pinned PNG codec; does not alter the source screenshots.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {PNG}=require(path.resolve('node_modules/playwright-core/lib/utilsBundle.js'));
const root=process.env.QA_DIR;if(!root)throw Error('Set QA_DIR to the evidence run');
const names=process.argv.includes('--backup')?['settings-desktop','settings-tablet','settings-mobile']:process.argv.includes('--floating')?['login-page-desktop','workspace-desktop','login-page-tablet','workspace-tablet','login-page-mobile','workspace-mobile']:process.argv.includes('--redesign')?['settings-desktop','settings-tablet','settings-mobile','vault-desktop','toolbar-desktop','toolbar-mobile','popup']:['settings-desktop','settings-tablet','settings-mobile','login-desktop','login-mobile'];
for(const name of names) {
 const a=PNG.sync.read(fs.readFileSync(path.join(root,`baseline-${name}.png`))),b=PNG.sync.read(fs.readFileSync(path.join(root,`implementation-${name}.png`)));
 if(a.width!==b.width || a.height!==b.height)throw Error('Mismatched viewport');
 const result=new PNG({width:a.width+b.width,height:a.height});PNG.bitblt(a,result,0,0,a.width,a.height,0,0);PNG.bitblt(b,result,0,0,b.width,b.height,a.width,0);
 fs.writeFileSync(path.join(root,`comparison-${name}.png`),PNG.sync.write(result));
}
console.log(`${names.length} baseline/implementation comparison PNGs written`);
