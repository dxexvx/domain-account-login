import {readdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir='.';
for(const file of readdirSync(dir).filter(x=>x.endsWith('.js')))execFileSync(process.execPath,['--check',`${dir}/${file}`]);
const m=JSON.parse(readFileSync(`${dir}/manifest.json`));assert.equal(m.manifest_version,3);assert(!m.host_permissions);assert(!m.externally_connectable);assert(!m.permissions.includes('cookies'));
for(const path of ['options.html','options.js','background.js','content.js'])assert(readFileSync(`${dir}/${path}`).length);
console.log('MV3 syntax and permission checks passed');
