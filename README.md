# Premium Forum

고급스러운 리퀴드 글래스 디자인의 포럼 웹사이트

## 기능

- 🎨 리퀴드 글래스 디자인 & 마우스 글로우 효과
- 🌓 다크/라이트/ING 테마 지원
- 📝 마크다운 문법 지원
- 👥 계정 권한 시스템 (개발자 > 관리자 > 가이드 > 일반 > 차단)
- 👍 좋아요/싫어요 시스템
- 🔔 실시간 알림
- 🛡️ 관리자 패널
- 📱 반응형 디자인

## 프테로닥틸(Pterodactyl) 배포 가이드

### 1. 서버 생성
- **서버 타입**: Node.js
- **Node.js 버전**: 18.x 이상
- **시작 명령어**: `node index.js`

### 2. 파일 업로드
1. 모든 파일을 프테로닥틸 파일 매니저에 업로드
2. 또는 Git을 사용하여 클론

### 3. 의존성 설치
콘솔에서 실행:
```bash
npm install
```

### 4. 환경 변수 설정
프테로닥틸 Startup 탭에서 설정:
- `SERVER_PORT`: 할당된 포트 (자동)
- `NODE_ENV`: production

### 5. 서버 시작
Start 버튼을 클릭하여 서버 시작

## 도메인 연결

### 옵션 1: 기본 도메인
- `서버주소:포트번호` 형식으로 접속
- 예: `panel.example.com:25565`

### 옵션 2: 커스텀 도메인
1. DNS A 레코드를 서버 IP로 설정
2. 리버스 프록시 설정 (Nginx/Apache)
3. SSL 인증서 적용 (Let's Encrypt)

### 옵션 3: Cloudflare Tunnel
1. Cloudflare 계정 생성
2. Zero Trust > Access > Tunnels 에서 터널 생성
3. 프테로닥틸 서버와 연결
4. 도메인 설정

## 개발자 계정

- **이메일**: ingwannu@gmail.com
- **비밀번호**: ddkcy1914

## 문제 해결

### 포트 오류
환경 변수 `SERVER_PORT`가 프테로닥틸에서 할당한 포트와 일치하는지 확인

### 데이터베이스 오류
SQLite 파일 권한 확인:
```bash
chmod 644 forum.db
```

### 모듈 누락
```bash
npm install
```

## 백업

정기적으로 `forum.db` 파일을 백업하세요.

## 라이선스

Private Use Only