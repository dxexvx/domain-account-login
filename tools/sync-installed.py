"""Update an existing non-Git unpacked install without touching Chrome profile data."""
import argparse,json,shutil
from pathlib import Path

def sync(target,apply=False):
    source=Path(__file__).resolve().parents[1];target=Path(target).resolve()
    if target==source or source in target.parents or (target/'.git').exists():
        raise ValueError('Git 소스 폴더 대신 기존에 설치된 복사본 경로를 지정하세요.')
    manifest=json.loads((source/'manifest.json').read_text())
    old=json.loads((target/'manifest.json').read_text())
    if old.get('name')!=manifest['name'] or old.get('manifest_version')!=3:
        raise ValueError('같은 확장의 기존 manifest.json이 있는 폴더만 업데이트할 수 있습니다.')
    files=[p for p in source.iterdir() if p.is_file() and p.suffix in ('.js','.css','.html','.json') and p.name not in ('package.json','package-lock.json')]
    if (source/'icons').exists():files.extend((source/'icons').rglob('*.png'))
    for p in files:
        dest=target/p.relative_to(source)
        if dest.is_symlink() or any(x.is_symlink() for x in dest.parents if x!=target and target in x.parents):
            raise ValueError('대상 런타임 경로의 심볼릭 링크는 업데이트하지 않습니다.')
    if apply:
        for p in files:
            dest=target/p.relative_to(source);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
        if not all(p.read_bytes()==(target/p.relative_to(source)).read_bytes() for p in files):
            raise ValueError('파일 복사 결과가 원본과 일치하지 않습니다.')
    return {'target':str(target),'version':manifest['version'],'runtime_files':len(files),'applied':apply}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--target',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    try:print(json.dumps(sync(args.target,args.apply),ensure_ascii=False))
    except (ValueError,OSError) as error:parser.exit(1,str(error)+'\n')
