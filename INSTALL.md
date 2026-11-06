# 설치·업데이트 · 에이전트용

대상 저장소는 https://github.com/dxexvx/domain-account-login 입니다. 설치할 확장 폴더는 이 저장소 루트이며 `manifest.json` 바로 안쪽의 하위 폴더를 찾지 않습니다. `chrome-browser`는 로컬 묶음 폴더입니다.

## 새 설치

Git 없이 설치하려면 [최신 릴리스](https://github.com/dxexvx/domain-account-login/releases/latest)의 설치용 ZIP을 내려받아 압축을 풉니다. ZIP 안의 `domain-account-login` 폴더에 manifest.json과 설치·사용 안내가 함께 있습니다. 아래 3단계부터 진행하면 됩니다.

1. 기존 Chrome 확장 목록에서 같은 확장의 설치 여부·버전·경로를 먼저 확인합니다. 설치돼 있다면 아래 업데이트 절차를 사용합니다.
2. 사용자에게 유지할 위치가 정해져 있으면 그 경로를 사용합니다. 아래 명령은 대상 폴더가 없을 때만 실행합니다.

```sh
mkdir -p "$HOME/chrome-browser"
git clone https://github.com/dxexvx/domain-account-login.git "$HOME/chrome-browser/domain-account-login"
cd "$HOME/chrome-browser/domain-account-login"
git rev-parse HEAD
python3 -c 'from pathlib import Path; import json; p=Path.cwd(); m=json.loads((p/"manifest.json").read_text()); assert m["manifest_version"]==3; print(p); print(m["name"],m["version"])'
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\chrome-browser"
git clone https://github.com/dxexvx/domain-account-login.git "$HOME\chrome-browser\domain-account-login"
Resolve-Path "$HOME\chrome-browser\domain-account-login\manifest.json"
```

Git이 없으면 [소스 ZIP](https://github.com/dxexvx/domain-account-login/archive/refs/heads/main.zip)을 풀어 같은 위치에 둡니다. `domain-account-login-main`도 manifest가 직접 들어 있는 루트라면 설치할 수 있습니다. 설치에는 npm·Python·빌드가 필요 없으며 Python은 위 확인 명령과 아래 복사 도구에서만 사용합니다.

3. 사용 가능한 브라우저 UI 도구로 `chrome://extensions`를 열고 개발자 모드를 켠 다음 **압축해제된 확장 프로그램을 로드합니다**를 선택합니다. 도구의 실행 직전 확인 규칙은 따릅니다.
4. 확인한 절대 경로의 **저장소 루트**를 선택합니다. 상위 `chrome-browser`, ZIP, `tests`, `tools`는 선택하지 않습니다.
5. 확장 목록에서 이름 **도메인 계정 로그인**·manifest와 같은 버전·사용 상태를 확인합니다.
6. 확장 아이콘에서 보관함이 열리는지 확인합니다. 대상 사이트를 지정받은 경우 자동 매핑과 별칭 버튼까지 확인합니다. 계정이 없으면 설치 완료와 계정 등록 미실시를 구분합니다.

일반 Chrome의 개발자 모드 설치는 실제 UI 완료가 필요합니다. 다운로드나 CLI 플래그만으로 설치됐다고 보고하지 않습니다. UI 도구가 없거나 관리 정책으로 막힌 정확한 단계만 사용자에게 넘깁니다. 사용자 Chrome 프로필 파일·레지스트리·보안 정책은 수정하지 않습니다. 공식 절차: [Load unpacked](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## 같은 경로에 업데이트

이미 이 저장소 루트가 설치됐다면 로컬 변경 여부를 확인한 뒤 `git pull --ff-only`하고 Chrome 확장 새로고침·사이트 새로고침을 수행합니다. 사용자 변경이 있으면 덮어쓰지 않습니다.

기존 설치가 이전 통합 폴더 또는 ZIP 복사본이면 **그 설치 폴더를 유지**합니다. 이 저장소에서 다음 명령으로 대상 manifest와 복사할 파일을 먼저 확인한 뒤 반영합니다.

```sh
python3 tools/sync-installed.py --target /absolute/existing/domain-account-login
python3 tools/sync-installed.py --target /absolute/existing/domain-account-login --apply
```

`--target`은 반드시 Chrome이 현재 사용하는 실제 폴더입니다. 도구는 다른 확장·Git checkout·심볼릭 링크 파일을 거부하고 런타임 파일만 복사한 뒤 byte 일치를 확인합니다. 계정은 Chrome 저장소에 있으므로 이 도구가 읽거나 변경하지 않습니다. 실행 후 `chrome://extensions`에서 기존 확장을 새로고침하고 기존 계정 수·버전·사이트 버튼을 확인합니다. 제거 후 재설치하지 않습니다.

## 시크릿 사용 설정

업데이트 후 확장 세부정보에서 **시크릿 모드에서 허용** 옵션이 표시되는지 확인합니다. 시크릿 사용을 요청받았다면 Chrome의 해당 옵션을 켠 뒤, 직접 연 시크릿 창의 등록 도메인에서 계정 버튼을 확인합니다. 브라우저 도구가 실행 직전 확인을 요구하면 옵션이 표시되는 상태까지 준비하고 사용자 확인을 받습니다. 사용자 프로필 파일을 직접 수정하지 않습니다. 보관함은 공유되며 웹 쿠키는 일반 창과 분리됩니다. 같은 프로필의 모든 시크릿 창은 서로 웹 세션을 공유합니다.

## 설치 경로 자체를 바꿀 때

압축해제 확장은 경로에 따라 ID·설정 저장소가 달라질 수 있습니다. 경로 변경이 필요하면 이전 설치에서 암호화 백업을 내보내고 새 설치에 가져와 계정과 로그인 동작을 확인한 뒤 이전 설치 정리를 따로 판단합니다. 비밀번호·백업 암호·프로필 키를 출력하거나 평문 파일로 옮기지 않습니다. 기존 설치를 먼저 제거하면 안 됩니다.

## 완료 증거

소스 URL/커밋, manifest 절대 경로, Chrome에서 읽은 이름·버전, 기존 설치 유지 여부, 실제 보관함/계정 수 확인 결과를 간결하게 남깁니다. 계정 값·키·백업 파일은 보고서·Git·채팅에 기록하지 않습니다. [사용 매뉴얼](MANUAL.md)은 로그인과 백업 조작을 설명합니다.
