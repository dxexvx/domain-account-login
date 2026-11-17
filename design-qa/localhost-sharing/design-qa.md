# localhost 계정 공유 검증 · DAL-19 / 아이디어61567

기존 도메인의 계정을 복사하지 않고 localhost의 모든 포트에서 사용한다. 로그인과 원래 주소 복귀는 현재 포트에 고정한다. 변경 UI는 기존 로그인 설정의 선택형 체크박스와 도움말이다.

- source visual truth path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/baseline-localhost-settings-desktop.png`
- baseline implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/baseline-localhost-settings-desktop.png`
- baseline CSS viewport: 1920x1080
- desktop implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/implementation-localhost-settings-desktop.png`
- desktop CSS viewport: 1920x1080
- tablet implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/implementation-localhost-settings-tablet.png`
- tablet CSS viewport: 768x1024
- mobile implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/implementation-localhost-settings-mobile.png`
- mobile CSS viewport: 390x844
- browser capture command: `QA_DIR=/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce node tests/localhost-browser.mjs`
- rendered test receipt: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/implementation-localhost-results.json`
- state: 실제 MV3 Chromium 확장, options.html, light, 합성 계정2개, 별도 프로필·로컬 서버. 실제 사용자 계정·BARO 화면은 캡처하지 않았다.
- required fidelity surfaces: options.html→BARO 설정→공유 선택→저장/재열기, localhost 두 포트→기존 별칭 버튼→현재 포트의 로그인 POST→원래 경로/쿼리/해시 복귀.

## 비교와 수정

같은 합성 계정2개, light, 로그인 설정을 펼친 상태, 각 viewport/density1에서 비교했다. baseline은 변경 전b4b7423e, implementation은1.4.0의 실제 실행이다. 폼을 화면 안으로 스크롤하고 내용 추가에 따른 문서 높이 차이를 함께 확인했다. 비교 이미지 폭은desktop3840·tablet1536·mobile780이며 높이는 각 viewport와 같다.

- comparison history desktop: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/comparison-localhost-settings-desktop.png`
- comparison history tablet: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/comparison-localhost-settings-tablet.png`
- comparison history mobile: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261117T033925Z-07e9aee013ce/comparison-localhost-settings-mobile.png`

findings: 처음에는 체크박스가 기존 label의 flex-direction:column을 물려받았다. P2로 판정해 row로 수정하고 위 세 비교 이미지를 직접 열어 확인했다. 체크박스와 라벨 위치, 설명 줄바꿈, 기존 입력·저장 버튼을 검토했다. 세 폭 모두 가로 넘침 없으며 label 조작 영역44px 이상·checkbox20px·row 방향을 실제 측정했다. 남은P0/P1/P2는 없다. 기존 타이포·색·44px 조작 기준을 유지했다.

## 기능과 경계

새 localhost 실제 브라우저9개 묶음, 기존 로그인12개 묶음, 기존 백업12개 묶음, 단위19건이 통과했다. 두 포트 모두 합성 계정의 실제POST 값을 수신했고 정상 로그아웃 후 같은 포트 복귀를 확인했다. 운영BARO 요청0건·page JS error0건이다. localhost 외 host·권한 취소·공유 해제·두 공유 원본 거부, 정확 localhost 우선, 로컬 전용 등록 삭제 후 공유 권한 유지, 암호화 백업의 설정 왕복을 확인했다.

권한 재허용 harness는 Chrome 관리API의 host 추가만으로 optional 권한이 복구되지 않아 실제 도메인 저장 버튼에서 permissions.request를 호출하도록 고쳤다. 재열기 검증도 workspace 표시 대신 site-id 반영까지 기다린다. 실제 사용자의 native 권한 팝업 조작을 합성 검증 성공에 포함하지 않는다. 소유한 context/server/profile은 finally에서 종료·삭제했다. 실제 Chrome 업데이트와 공유 설정은 PRD 실행기록에 별도로 남긴다.

final result: passed
