"""Package this repository's extension runtime, excluding tests, dependencies and user data."""
from pathlib import Path
import json,zipfile
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'manifest.json').read_text())
out=root/'output';out.mkdir(exist_ok=True)
files=[p for p in root.iterdir() if p.is_file() and p.suffix in ('.js','.css','.html','.json') and p.name not in ('package.json','package-lock.json')]
files.extend(root/name for name in ('README.md','INSTALL.md','MANUAL.md'))
if (root/'icons').exists():files.extend((root/'icons').rglob('*.png'))
dest=out/f'domain-account-login-{manifest["version"]}.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as archive:
    for p in files:archive.write(p,Path('domain-account-login')/p.relative_to(root))
with zipfile.ZipFile(dest) as archive:
    assert 'domain-account-login/manifest.json' in archive.namelist()
    assert not any('node_modules' in n or '.git/' in n for n in archive.namelist())
print(f'{dest}: {len(files)} files including installation manuals')
