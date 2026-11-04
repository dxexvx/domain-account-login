# 도메인 계정 로그인

도메인별 여러 계정을 저장하고 플로팅 별칭 버튼으로 현재 탭의 로그인 계정을 전환하는 Chrome 확장입니다. 로그인 요소 자동 매핑·직접 선택, 계정 백업 내보내기/가져오기를 지원합니다.

이 저장소는 **domain-account-login 전용**입니다. `chrome-browser`는 두 확장을 담는 로컬 상위 폴더 이름이며 clone할 저장소가 아닙니다. [엘리먼트 검사기](https://github.com/dxexvx/element-inspector)는 별도 저장소입니다.

## 설치

1. [소스 ZIP](https://github.com/dxexvx/domain-account-login/archive/refs/heads/main.zip)을 받아 압축을 풉니다. Git 사용자는 아래 명령을 실행합니다.
2. 폴더를 오래 유지할 위치에 둡니다. 예: `문서/chrome-browser/domain-account-login`.
3. Chrome에서 `chrome://extensions` → **개발자 모드** → **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
4. **이 저장소 루트**를 선택합니다. `manifest.json`이 바로 안에 있어야 하며 `chrome-browser` 상위 폴더를 선택하지 않습니다.
5. 확장 목록에서 **도메인 계정 로그인**과 버전을 확인합니다. 설치에 Node.js·빌드·서버·Web Store 계정은 필요하지 않습니다.

```sh
mkdir -p "$HOME/chrome-browser"
git clone https://github.com/dxexvx/domain-account-login.git "$HOME/chrome-browser/domain-account-login"
```

에이전트에게는 다음 요청을 전달하세요.

> https://github.com/dxexvx/domain-account-login 의 README와 INSTALL.md를 읽고 도메인 계정 로그인 확장을 설치해줘. 기존 설치 경로와 계정은 보존하고, 새 설치는 chrome-browser/domain-account-login 저장소 루트의 manifest.json을 확인해 Chrome에서 로드해줘. 실제 목록의 이름·버전 확인까지 진행해줘.

[에이전트 설치·업데이트 절차](INSTALL.md) · [사용·백업 매뉴얼](MANUAL.md)

## 사용

1. 대상 로그인 화면에서 확장 아이콘 → **자동 매핑** → **계정보관함 열기**를 누릅니다.
2. 별칭·로그인 아이디·비밀번호를 저장합니다. 같은 도메인에 여러 계정을 추가할 수 있습니다.
3. 해당 도메인의 어느 화면에서든 플로팅 계정 버튼을 누릅니다. 다른 계정으로 로그인 중이면 정상 로그아웃 → 선택 계정 로그인 → 원래 페이지 주소 복귀 순으로 전환합니다.
4. 버튼은 세로 축약형이며 hover/focus로 전체 별칭을 확인합니다. 손잡이 드래그·방향키 이동·접기/펼치기와 위치 저장을 지원합니다.
5. 설정 상단 **계정 내보내기 · 가져오기**에서 전체/현재 도메인을 암호화 파일로 옮깁니다. 별도 백업 암호10자 이상을 사용하고, 중복 아이디는 기존 비밀번호·설정을 유지합니다.

마스터 비밀번호·자동 잠금·시크릿 실행은 없습니다. 같은 Chrome 프로필은 로그인 세션을 공유합니다. 동시 분리가 필요하면 별도 Chrome 프로필을 사용하세요. 로그인 요소를 찾지 못하면 설정에서 직접 지정할 수 있습니다. OTP·CAPTCHA·SSO 추가 인증은 사이트에서 완료합니다.

계정은 프로필 키와 함께 로컬에 암호화 저장하며 별도 마스터 비밀번호 장벽은 제공하지 않습니다. 비밀번호·백업 파일·키를 Git이나 채팅에 넣지 마세요.

## 기존 설치 업데이트

현재 Chrome에 등록된 경로를 유지하세요. Git checkout은 해당 경로에서 `git pull --ff-only` 후 확장을 새로고침합니다. 이전 `chrome-browser/extensions/domain-account-login` 설치는 경로를 옮기지 않고 이 저장소의 `tools/sync-installed.py`로 런타임 파일만 반영할 수 있습니다. 자세한 명령과 경로 변경 시 백업/가져오기 절차는 [INSTALL.md](INSTALL.md)에 있습니다.

## 개발·검증

Node.js22+·Python3을 사용합니다. 명령은 모두 **이 저장소 루트**에서 실행합니다.

```sh
npm ci --ignore-scripts
npx playwright install chromium  # 테스트 브라우저가 없을 때만
npm run check
npm test
QA_DIR=/absolute/evidence/browser npm run test:browser
QA_DIR=/absolute/evidence/backup node tests/backup-browser.mjs
QA_DIR=/absolute/evidence/import node tests/transfer-browser.mjs
QA_DIR=/absolute/evidence/mapping node tests/mapping.mjs
QA_DIR=/absolute/evidence/floating node tests/floating.mjs
npm run package
```

패키지는 `output/domain-account-login-버전.zip` 하나를 만듭니다. 테스트는 별도의 임시 Chromium 프로필·합성 계정·로컬 서버를 사용하고 정리합니다. `QA_DIR`은 명시적인 증거 폴더이며 이 프로젝트 운영 환경에서는 검증된 외장 EvidenceStore run을 사용합니다. 실제 사용자 프로필 파일을 직접 수정하지 않습니다.

이전 통합 소스 이력은 [chrome-browser의 이전 커밋](https://github.com/dxexvx/chrome-browser/tree/adbbf4c0c5d25cb71dd7c7651841a0f57354a290)에 남아 있고, 이 저장소는 로그인 런타임의 하위 경로 이력을 이어받았습니다.
