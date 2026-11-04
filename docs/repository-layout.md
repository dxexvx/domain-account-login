# 확장별 저장소 구조 · 2026-11-04

`chrome-browser`는 로컬 묶음 디렉터리다. 각 자식은 독립 Git 저장소이며 루트 manifest.json을 설치한다.

- 계정 로그인: https://github.com/dxexvx/domain-account-login
- 엘리먼트 검사기: https://github.com/dxexvx/element-inspector
- 이전 통합 저장소: https://github.com/dxexvx/chrome-browser (이력·이전 안내)

각 README는 기능/빠른 시작, INSTALL.md는 에이전트 설치·업데이트와 완료 증거, MANUAL.md는 사용자 조작을 설명한다. 다른 저장소의 파일 없이 설치·검증·패키징한다.

로그인 런타임 이력은 통합 main adbbf4c0c5d25cb71dd7c7651841a0f57354a290에서 prefix split 0c3ea7d438ed03d5060cc124ca1dc8d4576c7202로 보존했다. 검사기는 기존 main 2605e26199c5a7fc65811d83dd26eed778c330ea의 후속 커밋이다. 로그인16개·검사기13개 실행 파일은 기존 설치와 byte가 같다. 기존 설치 경로는 확장 ID/보관함 유지를 위해 남기며, 새 소스 위치로 옮길 때는 INSTALL.md의 백업 절차를 따른다.

독립 루트에서 로그인 check·unit15개·MV3 browser12묶음·backup12묶음·16파일 ZIP, 검사기 check·browser30개 확인 및 복사항목11개·패키징을 검증했다. 검사기 테스트는 iframe/입력창의 잔여 포커스를 초기화하고 현재 복사 완료를 기다리도록 보완했다. 제품 실행 파일은 바꾸지 않았다.
