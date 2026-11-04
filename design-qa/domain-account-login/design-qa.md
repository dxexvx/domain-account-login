# 도메인 계정 로그인 화면 검증

실제 Chromium 151.0.7922.34에 Manifest V3 확장을 설치해 검증했다. 사용자 Chrome 프로필은 변경하지 않았다. 신규 화면이므로 첫 실행 구현을 baseline으로 삼고 본문 글자 크기를 수정한 결과와 비교했다. 시각/기능 검토는 메인 에이전트가 직접 수행했다.

- source visual truth path: `design-qa/domain-account-login/evidence/baseline-settings-desktop.png`
- baseline implementation screenshot path: `design-qa/domain-account-login/evidence/baseline-settings-desktop.png`
- baseline CSS viewport: 1920x1080
- desktop implementation screenshot path: `design-qa/domain-account-login/evidence/implementation-settings-desktop.png`
- desktop CSS viewport: 1920x1080
- tablet implementation screenshot path: `design-qa/domain-account-login/evidence/implementation-settings-tablet.png`
- tablet CSS viewport: 768x1024
- mobile implementation screenshot path: `design-qa/domain-account-login/evidence/implementation-settings-mobile.png`
- mobile CSS viewport: 390x844
- browser capture command: `QA_DIR=<external-evidence-run> QA_STAGE=implementation npm run test:browser`
- rendered test receipt: `design-qa/domain-account-login/evidence/browser-results.json`
- state: options.html, 밝은 테마, 보관함 해제, 정확 localhost origin 한 개와 합성 계정 두 개, 긴 한국어 별칭 포함, scroll 0. 로그인 바는 같은 로컬 fixture와 계정 두 개, desktop/mobile. deviceScaleFactor 1.
- required fidelity surfaces: 관리 화면·계정 목록·로그인 입력란·화면 요소 선택·하단 고정 별칭 버튼·세션 선택·오류 안내·잠금 상태.

## findings

- P2 수정: Chrome 확장 UA body 스타일이 root 15px을 75%인11.25px로 줄였다. body에 font:inherit를 지정해15px로 맞췄고 실제 computed style assertion이 통과했다.
- P2 수정: 요소 중복/누락의 injected script 예외가 Chrome 메시지 결과에서 유실될 수 있었다. 주입 함수가 명시적인 오류 결과를 반환하게 하고 UI에 표시한다. 중복 버튼은 제출을 거부한다.
- P2 수정: 화면 요소를 선택할 때 pointerdown/up·mouse 이벤트도 차단해 선택 클릭의 사이트 동작을 억제했다. 선택 후 정상 클릭은 복원된다.
- P2 수정: 페이지로 나갔다 돌아올 때의 무조건적인 설정 재조회가 미저장 입력을 지울 수 있었다. 요소 선택 후 돌아올 때만 새 결과를 조회한다.
- P0/P1/P2 잔존 없음. 390px·768px·1920px에서 가로 넘침 없이 입력·선택 버튼·계정 액션에 접근할 수 있었다. 하단 바는 줄바꿈과 제한 높이 안의 스크롤로 긴 별칭을 표시한다. 텍스트 입력의 긴 URL은 native input 가로 스크롤을 사용한다.

## comparison history

baseline/implementation은 같은 경로·인증 상태·데이터 개수·테마·viewport에서 캡처했다. 실행마다 localhost 서버의 임시 포트만 다르며 모두5자리다. 원본 캡처를 변형하지 않았다. 비교 이미지를 열어 글자 크기·정렬·줄바꿈·콘트롤 가림 여부를 확인했다.

- `design-qa/domain-account-login/evidence/comparison-settings-desktop.png` — 3840x1080, 양쪽1920x1080.
- `design-qa/domain-account-login/evidence/comparison-settings-tablet.png` — 1536x1024, 양쪽768x1024.
- `design-qa/domain-account-login/evidence/comparison-settings-mobile.png` — 780x844, 양쪽390x844.
- `design-qa/domain-account-login/evidence/comparison-login-desktop.png` — 3840x1080, 양쪽1920x1080.
- `design-qa/domain-account-login/evidence/comparison-login-mobile.png` — 780x844, 양쪽390x844.

## 기능·부작용·검증 범위

`npm run test:browser`의14개 검증 묶음 통과: 실제 설정 저장/readback, 계정 추가·수정·삭제, 요소 선택/readback, input/change 후 로컬 서버가 받은 로그인 값, 비허용 hostname, content script storage 차단, 중복 요소, SPA 로그인 버튼 숨김/표시, 시크릿 권한 부족 대체, 실제 시크릿 새 창 자동 로그인과 cookie/localStorage 분리, 기존 시크릿 공유 거부, 잠금/오키 거부. 페이지 JS 오류0건. 별도 unit4건 중 실행 직전 origin 변경을 DOM 접근 전에 거부하는 회귀 검사도 통과했다. 소유한 Chromium context·로컬 서버·임시 프로필·시크릿 창을 정리했다.

시크릿 권한 설정은 소유 테스트 프로필의 Chrome 기본 관리 API로 변경했다. 개발자 모드가 꺼진 테스트 프로필에서 권한 변경 시 unsupportedDeveloperExtension으로 비활성화되는 원인을 확인했고, 실제 설치 절차와 같이 개발자 모드를 켜 해결했다. 제품 우회 코드를 추가하지 않았다.

다양한 실제 외부 로그인 사이트·SSO·OTP·CAPTCHA와 사용자의 Chrome UI에서 사이트 접근 승인 팝업은 이번 합성 fixture 검증 범위 밖이다. 초기 경로·same-route 반영에 수치 성능 합격을 주장하지 않는다. DOM 감지는150ms debounce, 고유한 UI 상태 대기를 사용한다.

이미지와 실행 JSON은 로컬 ignored evidence symlink가 가리키는 외장 EvidenceStore run에 보존하며 완료 후24시간 보관 정책을 따른다. 공개 Git에는 원본 캡처·프로필·비밀번호를 넣지 않는다. 재검증 시 새 QA_DIR를 만들고 symlink를 해당 run으로 갱신한다.

final result: passed
