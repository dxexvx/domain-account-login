# 계정보관함 화면 재구성 검증

팝업·보관함·도메인 설정·계정 관리·하단 로그인 바를 실제 확장 런타임에서 비교했다. 디자인 기준은 design-anti-slop의 web-composition/failure-patterns/review, 화면 구조는 screen-improvement-workflow, 문구는 ux-writing을 적용했다. 검토와 통합은 메인 에이전트가 직접 수행했다.

- source visual truth path: `design-qa/account-vault-redesign/evidence/baseline-settings-desktop.png`
- baseline implementation screenshot path: `design-qa/account-vault-redesign/evidence/baseline-settings-desktop.png`
- baseline CSS viewport: 1920x1080
- desktop implementation screenshot path: `design-qa/account-vault-redesign/evidence/implementation-settings-desktop.png`
- desktop CSS viewport: 1920x1080
- tablet implementation screenshot path: `design-qa/account-vault-redesign/evidence/implementation-settings-tablet.png`
- tablet CSS viewport: 768x1024
- mobile implementation screenshot path: `design-qa/account-vault-redesign/evidence/implementation-settings-mobile.png`
- mobile CSS viewport: 390x844
- browser capture command: `QA_DIR=<verified-external-run>/redesign QA_STAGE=baseline node tests/design.mjs` (변경 전), `QA_DIR=<verified-external-run>/redesign QA_STAGE=implementation node tests/design.mjs` (변경 후), `QA_DIR=<verified-external-run>/redesign node tools/compare.mjs --redesign`
- rendered test receipt: `design-qa/account-vault-redesign/evidence/implementation-design-results.json`
- state: options.html, 보관함 해제, localhost 한 도메인·합성 계정4개(한글/영문 역할명·긴 별칭), 밝은 테마, DPR1, 스크롤0. baseline/implementation은 같은 데이터와 화면 상태이며 실행별 임시 포트만 다르다(모두5자리). 비밀번호 값은 캡처하지 않았다.
- required fidelity surfaces: 팝업(380x430), 보관함 생성·잠금 해제/오류, 도메인 추가·기존 설정, 계정 목록/편집, desktop/mobile 하단바, 수동 요소 선택.

## 후보와 선택

실제 DOM을 사용한 `candidate-a-domain-sidebar.png`, `candidate-b-top-navigation.png`를 각각 열어 비교했다. A는 도메인 범위와 계정 작업을 좌우로 유지하고 B는 도메인을 상단에 펼친다. A를 선택했다. B의 긴 도메인 영역은 첫 계정까지의 거리를 늘린다. A에서는 desktop 첫 화면 안에4개 계정과 편집 입력이 모두 들어온다. 390px에서는 도메인 목록→계정 목록→편집으로 재배치한다. 사용자에게 추가 선택을 요구하지 않고 권장 방식 위임에 따라 결정했다.

## findings

- P2 수정: popup이 options 전역 스타일을 공유하고 body 360px/max-width:100vw에 의존했다. popup CSS를 분리하고 html380px/body100% border-box로 고정했다. 초기 viewport240px에서도 html/body380px를 유지하는 회귀 assertion과380px에서 scrollWidth380 검증이 통과했다. 실제 사용자 Chrome에서도 팝업이 정상 범위로 열리고 현재 도메인·자동 매핑이 표시되는 것을 확인했다.
- P2 수정: 수동 선택자 폼이 계정 목록 앞에 있어 계정 작업을 아래로 밀었다. 계정 목록과 편집을 앞에 배치하고 로그인 화면 설정은 native details로 이동했다. 신규/누락 매핑은 자동으로 펼치며 수동 선택·삭제·세션 안내 경로를 유지했다.
- P2 수정: 영문 eyebrow, 반복 외곽 카드, 긴 상시 안내를 제거하고 도메인→별칭/아이디→수정의 위계를 반영했다. regular system-ui15px, 의미별 파란 행동/선택, 오류/삭제 색을 사용한다. focus outline은 유지했다.
- P2 수정: placeholder 대비4.4:1 지적을 받아 색을 보정했다. popup의 disabled/hover 충돌도 보정했다. impeccable detect 재실행 결과 지적0건. 탐지기 결과는 화면/접근성 인증이 아니다.
- 조작 측정: 목록 수정/삭제는44x44 원형, popup 버튼은44px, 하단바 button/select는desktop/mobile 모두44px. 좁은 화면은 정상 줄바꿈하며 문서 가로 overflow가 없다. 수동 선택 버튼·입력·폼 저장은44px를 공통 사용한다.
- P2 수정: 실제 사이트 일반 로그인 후 대시보드에서도 넓은 버튼 선택자가 일치해 하단 바가 나타났다. 로그인 버튼과 함께 실제 ID/password 입력란도 보여야 표시하도록 보완했다. 수정 전 실제 대시보드에서 바 노출을 관찰했고, 수정 후 실제 대시보드에서 숨김을 확인했다. 별도 회귀는 입력란의 실제 display:none 상태를 확인한 뒤 바가 사라지는지 검사한다. fixture의 input{display:block}이 hidden 속성을 덮는 초기 검증 오류를 수정했으며 이를 제품 실패로 집계하지 않는다.
- P0/P1/P2 잔존 없음. 대표 화면과 오류/빈 상태의 한글 줄바꿈, 여백·선 정렬, 아이콘 형태, 선택·focus·disabled 표현을 실제 캡처로 확인했다. 자동 생성된 장식·가짜 수치·비기능 제어는 추가하지 않았다.

## comparison history

아래 비교 이미지를 모두 열어 좌측 baseline/우측 implementation을 검토했다. 원본을 왜곡하지 않고 같은 크기로 나란히 합쳤다. 각 화면 pixel 크기는 CSS viewport와 동일(DPR1)이며 comparison만 폭2배다.

- `design-qa/account-vault-redesign/evidence/comparison-settings-desktop.png` — 3840x1080, 양쪽1920x1080.
- `design-qa/account-vault-redesign/evidence/comparison-settings-tablet.png` — 1536x1024, 양쪽768x1024.
- `design-qa/account-vault-redesign/evidence/comparison-settings-mobile.png` — 780x844, 양쪽390x844.
- `design-qa/account-vault-redesign/evidence/comparison-vault-desktop.png` — 3840x1080, 양쪽1920x1080.
- `design-qa/account-vault-redesign/evidence/comparison-toolbar-desktop.png` — 3840x1080, 양쪽1920x1080. 설정 이후 계정 수정 검사는 캡처 뒤에 실행해 양쪽 계정 순서·밀도를 맞췄다.
- `design-qa/account-vault-redesign/evidence/comparison-toolbar-mobile.png` — 780x844, 양쪽390x844.
- `design-qa/account-vault-redesign/evidence/comparison-popup.png` — 760x430, 양쪽380x430. 직접 popup URL을 연 제한 페이지 상태이며 실제 사이트 상태는 사용자 Chrome에서 별도 확인했다.

추가 상태: `implementation-vault-error.png`, `implementation-domain-empty.png`(각1920x1080). 좁은 화면의 편집은 계정 추가 또는 수정으로 입력에 focus를 보내 스크롤하며 저장 후 재열기 결과를 검증했다.

## 동작과 경계

`npm run check`, `npm test`4건, `tests/browser.mjs`15개 검증 묶음, `tests/mapping.mjs`9개 경계 검사 통과. 기존 단위 검증은 변경된 입력 없이 유효하다. 실제 설정 CRUD/readback·수동 요소 선택·입력/change·로컬 서버 로그인 값·비허용 도메인·content storage 차단·중복/SPA·시크릿 대체·실제 새 시크릿 자동 로그인과 쿠키/localStorage 분리·기존 시크릿 공유 거부·잠금/오키 거부를 확인했다. 자동 매핑은 애매한 폼·페이지 이동·sender 위조를 거부하고 같은 도메인의 기존 계정을 보존한 채 저장·재열기한다. 페이지 JS 오류0건.

첫 회귀 실행은 요소 선택 바 대기에서 timeout이 발생했다. 실패 위치에 비밀 없는 진단을 추가한 실행에서는14개 검증이 모두 통과했다. 이를 제품 수정으로 해결했다고 주장하지 않는다. 소유한 Chromium context·로컬 서버·임시 프로필·시크릿 창은 정리했다.

실제 설치 Chrome에서는 새 options UI 반영, 잠금 유지, BARO 로그인 화면에서 popup 자동 매핑→설정 메시지·세 요소 저장을 확인했다. 기존 관리자 일반 로그인→대시보드 진입도 확인했고, 기존 설정을 재저장해 content script 등록을 갱신한 뒤 페이지 새로고침으로 대시보드에서 하단 바가 사라진 것을 확인했다. 전체 확장을 재시작하지 않아 보관함 잠금 해제를 유지했다. 이 결과는 실제 네 역할 계정 등록·로그인 검증 완료를 뜻하지 않는다. 다른 외부 사이트/추가 인증/모든 브라우저의 접근성·세션 분리는 미검증이다.

원본 캡처와 JSON은 ignored evidence symlink의 외장 EvidenceStore에 보관한다. 공개 소스에는 캡처·사용자 프로필·실계정 비밀번호를 넣지 않는다. 완료 후24시간 보존 등록을 적용한다.

final result: passed
