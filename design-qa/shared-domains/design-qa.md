# 여러 도메인과 로그인 경로 공유 · DAL-20 / 아이디어61570

기준 도메인의 계정을 여러 추가 도메인에서 사용한다. localhost 체크박스를 편집 가능한 주소 목록으로 바꾸고 로그인 페이지를 경로만으로 표시한다. design-anti-slop/web-composition의 기존 업무 화면·44px 제어·명시적 위계 기준을 적용했으며 기존 색/글꼴/계정 영역은 유지한다.

- source visual truth path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/baseline-localhost-settings-desktop.png`
- baseline implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/baseline-localhost-settings-desktop.png`
- baseline CSS viewport: 1920x1080
- desktop implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/implementation-localhost-settings-desktop.png`
- desktop CSS viewport: 1920x1080
- tablet implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/implementation-localhost-settings-tablet.png`
- tablet CSS viewport: 768x1024
- mobile implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/implementation-localhost-settings-mobile.png`
- mobile CSS viewport: 390x844
- browser capture command: `QA_DIR=/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872 node tests/domains-browser.mjs`
- rendered test receipt: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/implementation-domains-results.json`
- state: actual MV3 Chromium151.0.7922.34, options.html, light, 합성계정2개/기준1개. 추가 도메인3개(HTTPS검증호스트·loopback정확포트·localhost:*). 비밀번호·운영 화면은 캡처하지 않았다.
- required fidelity surfaces: 기준 도메인→하위 도메인 목록→추가/수정/제거→저장→LIST/재열기. 로그인 경로 표시→현재 도메인/포트 로그인·복귀.

## 실제 비교

baseline은 편집 전a19c780e39bcd8462494d5d91b2ef336be6cad42에서 `QA_STAGE=baseline node tests/localhost-browser.mjs`로 확보했다. implementation은1.5.0 실제 확장이다. 두 계정·기준 도메인·light·login-settings open·CSS viewport/density1을 맞췄다. 폼 scrollIntoView를 같은 방식으로 실행했다. 추가 목록으로 문서 높이가 늘면서 viewport 위쪽의 실제 스크롤 위치가 달라진 점은 비교에서 구분했다. 폼과 상단 전체 화면을 함께 확인했다.

- comparison history desktop: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/comparison-localhost-settings-desktop.png` (3840x1080, 각1920x1080)
- comparison history tablet: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/comparison-localhost-settings-tablet.png` (1536x1024, 각768x1024)
- comparison history mobile: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/comparison-localhost-settings-mobile.png` (780x844, 각390x844)
- full-view desktop: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/implementation-domains-overview-desktop.png` (1920x1080)
- full-view tablet: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/implementation-domains-overview-tablet.png` (768x1024)
- full-view mobile: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T041344Z-dc0bf9872872/implementation-domains-overview-mobile.png` (390x844)

findings: 세 비교와 desktop/mobile 전체 화면을 직접 열어 확인했다. 기준 도메인 아래 추가 도메인 목록, 경로 표시, 수정 가능한 입력과 제거 버튼, 도움말의 줄바꿈을 검토했다. 글꼴 15px/regular·기존 토큰을 유지한다. 입력/제거 버튼의 높이 44px, 중심 차이 0px, 행 간격 8px 이상과 가로 넘침 없음을 실제 DOM으로 측정했다. 터치 이벤트로 입력 추가와 제거를 실행했다. focus는 새 입력/다음 행 또는 추가 버튼으로 이어진다. 확인한 범위에 남은 P0/P1/P2는 없다. 목록 증가에 따른 세로 스크롤은 의도한 동작이며 모바일 저장 버튼은 문서 아래에서 접근한다.

## 기능·성능·경계

단위24건, 새 실제 MV314개 묶음, 기존 로그인12개 묶음·백업12개 묶음·매핑9개 검증이 통과했다. 로컬 서버에서 localhost·127.0.0.1과 두 localhost 포트의 실제POST를 받았으며 동일 도메인/포트·경로/쿼리/해시 복귀를 확인했다. HTTPS 검증호스트는 안전한 합성 응답으로 매칭/제거만 검사했다. 운영 BARO요청0·page JS error0.

기존 암호화 보관함의shareOnLocalhost=true를 추가 목록으로 읽고, 저장·제거·재열기 후 부활하지 않음을 확인했다. 다른 그룹의 정확주소/localhost wildcard 충돌·미등록 도메인·권한철회를 거부했다. API의 기존 절대 loginUrl은 호환을 유지하고 UI는 경로만 입력한다. 경로의다른 origin·인증정보·이중슬래시 우회를 단위검사에서 거부했다.

권한복원 harness가 developerPrivate만으로 철회한 optional권한을 복구하지 못했다. 기존 사용자 저장버튼의 permissions.request로 복원하도록 수정한 뒤 전체14묶음이 통과했다. native 권한창의 사용자의 승인/거부 자체를 자동검증했다고 주장하지 않는다. 합성 권한거부에서는 보관함불변을 확인했다.

각5표본: 새 문서85~89ms, warm reload82~84ms, 뒤로재진입84~104ms, 저장후재방문85~101ms. 도메인 입력추가57~63ms. 각진입의HTTP요청은 실제 관측0건이다. 적은 표본의p95·field INP/LCP는 주장하지 않는다. 전용 profile/context/server는finally에서 종료·삭제했다. 실제 Chrome 설치/공개ZIP은 PRD 실행기록의 별도 증거다.

final result: passed
