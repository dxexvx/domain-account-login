# 계정 백업 내보내기·가져오기 검증

사용자는 도메인/계정 백업을 파일로 옮긴다. 1.2.0은 도구 전용 RSA 가져오기만 제공했다. 1.3.0은 기존 설정의 regular 글꼴·44px 조작·도메인별 목록을 유지하면서 상단 접기 영역에 일반 백업을 제공한다. 장식 카드·아이콘·새 색상 체계를 추가하지 않았다. 마스터 실행 잠금은 유지하지 않는다.

- source visual truth path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/baseline/baseline-settings-desktop.png`
- baseline implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/comparisons/baseline-settings-desktop.png`
- baseline CSS viewport: 1920x1080
- desktop implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/comparisons/implementation-settings-desktop.png`
- desktop CSS viewport: 1920x1080
- tablet implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/comparisons/implementation-settings-tablet.png`
- tablet CSS viewport: 768x1024
- mobile implementation screenshot path: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/comparisons/implementation-settings-mobile.png`
- mobile CSS viewport: 390x844
- browser capture command: `QA_DIR=/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/backup node tests/backup-browser.mjs`
- rendered test receipt: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/backup/result.json`
- state: 소유한 headless Chromium 확장 런타임, light, 합성 계정4개와 긴 별칭, 설정 경로 options.html, baseline 소스1507d6c. 실제 BARO 인증/계정 데이터는 캡처하지 않았다. source/target 임시 프로필은 별도 deviceKey를 사용한다.
- required fidelity surfaces: 기존 목록과 새 backup disclosure, 내보내기 전체/현재 도메인, 암호 확인, 파일 선택, 미리보기 건수/중복 규칙, 가져오기/취소, desktop 두 열·mobile 한 열, 전체44px 폼 tier.

## 비교와 판단

baseline 명령은 같은 run의 baseline 디렉터리에 `QA_STAGE=baseline node tests/design.mjs`다. 구현 전 실제 실행을 보존했다. 구현의 동일 계정4개·닫힌 backup 상태·상단 scroll0을 desktop/tablet/mobile에서 캡처했다. 같은 CSS viewport와1배 density이며 loopback 서버의 임시 포트만 다르다. 계정 별칭·밀도·테마·기존 기능 상태는 같다. 다음3쌍을 직접 열어 비교했다.

- comparison history desktop: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/comparisons/comparison-settings-desktop.png`
- comparison history tablet: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/comparisons/comparison-settings-tablet.png`
- comparison history mobile: `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/comparisons/comparison-settings-mobile.png`

펼친 기능은 `/Volumes/1TB_SK_NVME/Artifacts/AgentOps/VerificationEvidence/runs/EV-20261104T014217Z-6b9ef02d05bc/backup/backup-desktop.png`, backup-tablet.png, backup-mobile.png에서 확인했다. 미리보기는 preview-desktop.png와 preview-mobile.png다. 이 full-page 캡처는 문서 길이만큼 높이가 늘어나며 같은 CSS viewport1920×1080/768×1024/390×844, density1을 사용한다. 상단 백업 구역의 입력·미리보기·버튼을 집중 확인했다. 접힌 이전 기능에는 없는 새 백업 입력의 허위 baseline을 만들지 않았다.

findings: P0/P1/P2 없음. 상단 메뉴와 계정 목록의 위계가 유지되고, 가로 넘침이나 라벨/버튼 겹침이 없다. 모바일에서 백업을 열면 계정 목록은 아래로 밀리며 접어서 돌아갈 수 있다. 펼친 폼의 같은 tier button/select/password input은 모든3개 폭에서 실제 border-box44px임을 측정했다. file input은 별도의 native 파일 조작으로44px 이상 높이를 사용한다. keyboard focus outline은 보존했다.

## 기능 지도·거부 경계

DAL-13은 실제 UI에서 파일 다운로드→별도 프로필의 파일 입력→암호 입력→미리보기→가져오기→목록 재열기→가져온 계정 버튼의 서버 POST까지 연결한다.

1. 전체/현재 도메인 파일을 각각 내려받고, 프로필 키 없이 백업 암호로 정확히 복호화했다. 파일에 계정/도메인/키 평문은 없다.
2. 내보내기 암호 확인 불일치를 거부했고 성공 뒤 입력란은 비웠다.
3. 틀린 암호·변조·잘못된 JSON은 오류를 표시하고 vault ciphertext를 유지했다.
4. 미리보기/취소에서 vault 불변을 확인했다. 도메인2개·신규1개·계정추가4개·중복1개를 표시했다.
5. 미허용 host가 있으면 background 저장을 거부했다. 최종 UI 클릭은 permissions.request를 실행한다. 테스트 브라우저의 developerPrivate API로 승인 조건을 준비했으며 실제 사용자의 native 권한 팝업 승인/거부까지 자동 검증했다고 주장하지 않는다.
6. popup의3개 백업 명령과 content의 export 명령을 options 전용 경계에서 거부했다.
7. 기존 ID·비밀번호·로그인 URL·로그아웃 설정을 보존했다. 반복 가져오기는 계정5개를 중복 처리하고 vault를 다시 쓰지 않았다.
8. 다른 프로필 키로 저장된 가져온 계정의 아이디/비밀번호가 실제 로컬 서버 로그인 POST와 일치했다. UI pageerror0건.

backup12개 묶음·기존 RSA 가져오기8개 묶음·단위15건·runtime syntax·패키지 검사가 통과했다. 초기 harness가 host를 관리 API로만 추가하고 optional 권한 요청을 생략한 문제는 실제 도메인 저장 버튼 경로로 수정했다. worker의 dynamic import 제한은 options의 정상 module context에서 검증하도록 수정했다. 제품 우회나 실제 사용자 프로필 조작은 하지 않았다. 모든 임시 프로필/서버는 finally로 정리했다.

실제 사용자 Chrome에서는 동일 설치 경로의1.3.0으로 재로드하고 백업 메뉴/암호 입력/파일 조작 및 기존4계정 보존을 AX로 확인했다. 실제 계정 파일을 내보내거나 계정/서버 비밀번호를 변경하지 않았다. 일반 백업 파일은 별도 백업 암호를 사용하며 암호를 저장/복구하지 않는다. 기존 RSA 요청 파일과는 호환되지 않는다.

final result: passed
