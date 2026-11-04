# 플로팅 계정 전환 · 1.2.0 검증

현재 탭만 사용하는 세로 플로팅 계정 목록으로 바꾸고, 정상 로그아웃→선택 계정 로그인→기존 페이지 주소 복귀를 구현했다. 마스터 입력·시간/브라우저 종료 잠금을 제거했다. 기존 열린 암호문은 브라우저 전용 AES 키로 변환하며 계정을 다시 만들지 않는다. 키도 같은 Chrome 프로필에 저장하므로 마스터 비밀번호 장벽과 동등한 보호는 아니다.

## 화면 근거

- source visual truth path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/floating/baseline-login-page-desktop.png`
- baseline implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/floating/baseline-login-page-desktop.png`
- baseline CSS viewport: 1920×1080
- desktop implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/floating/implementation-login-page-desktop.png`
- desktop CSS viewport: 1920×1080
- tablet implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/floating/implementation-login-page-tablet.png`
- tablet CSS viewport: 768×1024
- mobile implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/floating/implementation-login-page-mobile.png`
- mobile CSS viewport: 390×844
- browser capture command: `QA_DIR=<external-run>/floating node tests/floating.mjs`
- rendered test receipt: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/floating/implementation-results.json`
- state: 같은 localhost 로그인/업무 경로, 합성 4계정(관리자·그로스텔라·KIMG·플랫브레드), 밝은 테마, DPR1, 펼침 상태. 실제 MV3 Chromium 실행이며 원본 사용자 프로필을 테스트 harness에 연결하지 않았다.
- required fidelity surfaces: 허용 도메인의 모든 화면 표시, 세로 축약 4개,44px 동일 조작, 이동 손잡이, hover/focus 전체 별칭, 표시/접기/펼치기,320×240 경계와 일반1920/768/390, 모션 감소, 로그인/업무 화면.

## findings / comparison history

P1 기존 바는 폼이 없는 업무 페이지에서 사라지고 모바일 하단을 크게 차지했다. 원점이 있는62px 플로팅 패널과52×44px 반복 버튼으로 바꿨다. 목록은 계정 순서대로 위에서 아래에 놓고, 세션 선택은 제거했다. 툴팁은 패널 바깥의 viewport 안쪽에 표시한다. 포커스는 균일한 outline이며 한쪽 강조선은 없다.

P2 초기 캡처가 표시 애니메이션 시작 프레임을 잡아 흐리게 보였다. 제품 투명도 결함으로 오인하지 않고 캡처에서 유한 애니메이션을 완료시키고 기하 측정 전에 종료를 기다렸다. 실제 애니메이션 이름과 모션 감소 duration0은 별도 DOM 관측으로 검증했다.

비교 명령은 `QA_DIR=<external-run>/floating node tools/compare.mjs --floating`이다. 동일 로그인/업무 화면의 desktop/tablet/mobile6쌍을 실제 이미지로 열어 검토했다. 경로는 `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/floating/comparison-<login-page|workspace>-<desktop|tablet|mobile>.png`다. 전체 화면과 tooltip-desktop, collapsed-desktop도 확인했다. 모바일에서 사이트 일부를 덮을 수 있는 플로팅은 접기/드래그로 옮길 수 있다. unresolved P0/P1/P2 없음.

새 설정 진입은 별도 마스터 화면 없이 자동으로 열린다. 기존 계정·도메인 배치·44px 수정/삭제/폼 조작을 유지한다. options 상세에만 로그아웃 선택 사항을 추가했다. 현재 설정/빈 도메인/오류/380px 팝업은 `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/design` 실제 캡처와 디자인 receipt로 확인했다.

## 기능 지도와 증거

|ID|진입·전제|관측 결과|
|---|---|---|
|DAL-10|허용 origin·계정4개|폼 없는 화면에서도 표시, 축약/세로/44px, hover/focus 전체 별칭, 실제 마우스 드래그·재열기 배치 readback, 키보드/viewport 보정, 펼침 상태 저장, 모션 감소|
|DAL-11|다른 계정 로그인 중인 합성 업무 화면|로그아웃→로그인 POST 순서, 선택 계정 값 서버 수신, 동일 탭·원래 경로/쿼리/해시 복귀, 새로고침 재실행 없음|
|DAL-11 거부|중복 로그아웃·비밀번호 실패|중복은 logout/login 모두 중단.401은 로그인 화면에 남아 잘못 복귀하지 않음|
|DAL-12|history.pushState 후 계정 선택|수정 전 로그인 POST0을 재현. 현재 content URL과 실제 tab URL을 대조한 뒤 정상 전환·복귀|
|DAL-12 보존|기존 열린 암호문/브라우저 재시작|단위 검증으로 암호문 무변경 변환·키 누락 시 덮어쓰기 금지. 실제 Chromium 종료/재시작 뒤 계정 유지·마스터 없이 폼 POST|
|DAL-01~05|기존 등록/선택/수정/삭제/주입|기존 계정 암호문·비밀번호 미표시, 선택 클릭 미제출, 실제 input/change·클릭, 중복·비허용 origin·content storage 접근 거부|
|DAL-08/09|자동 매핑·암호화 가져오기|URL/sender/중복/일회 요청 경계와 재매핑 계정 보존, 가져온 계정의 실제 폼 제출|

`npm run check`, `npm test`12건, browser12개 묶음, floating13개 묶음, transfer8개 묶음, mapping9개 묶음, design 캡처 및 `npm run package`가 통과했다. 실행 결과는 각 디렉터리 JSON과 `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261103T112134Z-9b813a6d7afa/verification-receipt.json`에 남긴다. 시크릿 요청과 다른 URL·만료 의도도 거부한다. 프로필/서버/context는 finally로 제거하며 실제 사용자 Chrome은 사용을 위해 유지한다.

실제 Chrome 확인:1.2.0 설치 경로와 시크릿 설정 제거, 기존4계정 자동 변환 및 확장 재로드 후 마스터 없이 열림을 확인했다. BARO 소재 관리에서 그로스텔라·플랫브레드·관리자 순서로 정상 로그인하고 각각 동일 페이지 경로로 복귀한 것을 확인했다. BARO useSearchHistoryStore.setLocation이 검색 조건을 암호화한 해시를 다시 생성하므로 ciphertext 문자열의 동일성을 실제 조건 유지로 간주하지 않는다. KIMG 전환 버튼도 마지막에 실행했지만, 해당 시도의 완료 화면은 별도로 확정하지 않았다. 기존 네 계정의 정상 로그인 증거는 account-import 보고서에 보존한다. 정상 로그아웃 DOM을 찾지 못하는 사이트는 선택 사항인 로그아웃 선택자를 지정해야 하며 OTP/CAPTCHA·권한 제한을 우회하지 않는다. 페이지 주소 복귀이며 저장하지 않은 입력·스크롤·계정 권한 유지를 보장하지 않는다.

final result: passed
