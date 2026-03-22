# YONGIN FC MIREU STORE - Marking Queue System

용인FC 미르스토어의 마킹 작업을 효율적으로 관리하기 위한 웹 기반 대기열 시스템입니다.  
고객 조회 페이지, QR 연결 페이지, 관리자 페이지를 통해 현장 운영 흐름을 통합 관리합니다.

---

## 주요 기능

### 고객용 페이지
- 작업번호 / 이름 / 전화번호 검색
- 작업 상태 확인 (대기중 / 완료)
- 10초 자동 데이터 갱신
- 모바일 최적화 UI

### QR 연결 페이지
- QR 스캔 후 작업번호 자동 인식
- 고객 정보 입력 (이름 / 휴대전화 / 비고)
- 작업번호 1회 연결 제한
- 개인정보 동의 후 등록 처리

### 관리자 페이지
- 4자리 PIN 로그인
- 작업 등록 / 수정 / 삭제
- 상태 변경 (대기중 ↔ 완료)
- 통계 대시보드 제공
- QR 링크 및 상태 조회 링크 관리

### 알림 기능
- 작업 연결 알림
- 작업 완료 알림
- SOLAPI 연동 기반 메시지 발송

---

## 기술 스택
- Frontend: HTML / CSS / JavaScript
- Backend: Google Apps Script
- Database: Google Sheets
- API: JSONP
- Hosting: GitHub Pages + GAS Web App

---

## 폴더 / 파일 구조
- `index.html` : 고객 조회 페이지
- `bind.html` : QR 연결 페이지
- `AdminPage.html` : 관리자 페이지
- `js/api.js` : 공통 API 통신 로직
- `js/index.js` : 고객 조회 및 검색 로직
- `js/bind.js` : QR 연결 처리 로직
- `js/config.js` : API_BASE 설정
- `css/style.css` : 공통 스타일

---

## 동작 방식
1. 관리자가 작업번호를 생성/관리합니다.
2. 고객이 QR을 스캔해 작업번호를 연결합니다.
3. 고객은 공개 페이지에서 현재 작업 상태를 조회합니다.
4. 관리자가 완료 처리하면 상태가 반영되고 알림이 발송됩니다.

---

## 실행 / 배포
1. Google Sheets와 Google Apps Script를 준비합니다.
2. Apps Script를 Web App으로 배포합니다.
3. `config.js`에 배포된 Web App URL(API_BASE)을 설정합니다.
4. 정적 파일을 GitHub Pages에 배포합니다.

---

## 주의사항
- 공개 저장소에 민감한 키를 직접 커밋하지 마세요.
- SOLAPI 비밀키는 서버 측에서만 관리하세요.
- `config.js`의 API 주소와 GAS 배포 주소가 일치해야 정상 동작합니다.

---

## 사용 목적
- 스포츠 MD 현장 판매 운영
- 마킹 / 제작 대기열 관리
- 팝업스토어 / 이벤트 현장 운영
