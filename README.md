# 차계부 (Car Ledger)

모바일 차계부 웹앱 — 주유 실시간 유가, 정비 기록, 운행거리, 클라우드 동기화.

## GitHub + Render 온라인 사용

| 항목 | 주소 |
|------|------|
| **앱 (모바일 접속)** | https://car-ledger.onrender.com |
| **GitHub 저장소** | https://github.com/SHHA0205/car-ledger |
| **상태 확인** | https://car-ledger.onrender.com/api/health |

### 모바일에서 쓰는 법

1. 폰 브라우저에서 **https://car-ledger.onrender.com** 접속
2. 첫 접속은 Free 플랜 슬립 해제로 **30~50초** 걸릴 수 있음 → 로딩 후 새로고침
3. **설정** → **회원가입** (한 번만)
4. 주유·정비 기록 입력 → 자동 클라우드 저장
5. 다른 기기에서도 **같은 URL + 같은 계정**으로 로그인

### 코드 수정 후 반영

```bash
git add .
git commit -m "변경 내용"
git push origin main
```

GitHub에 push하면 Render가 **자동 재배포**합니다 (Events 탭에서 Live 확인).

## 로컬 실행

```bash
npm install
npm start
```

http://localhost:3456

## 개인 온라인 사용 (배포 없이)

Render/GitHub 없이 **내 PC가 서버**가 됩니다. 클라우드 동기화·유가 조회 모두 이 PC에서 동작합니다.

### 방법 1 — 집 Wi-Fi (가장 간단)

```powershell
npm run lan
```

표시되는 `http://192.168.x.x:3456` 주소를 **같은 Wi-Fi**에 연결된 폰 브라우저에 입력합니다.

### 방법 2 — 외부에서도 접속 (임시 비공개 URL)

```powershell
npm run tunnel
```

`your url is: https://xxxx.loca.lt` 주소가 나옵니다. **본인만 아는 URL**이므로 북마크해 두고 사용하세요. PC를 끄거나 스크립트를 종료하면 접속이 끊깁니다.

> 첫 접속 시 localtunnel 비밀번호 안내가 나올 수 있습니다. 터미널에 표시된 공인 IP를 입력하면 됩니다.

### 클라우드 동기화 (개인 서버)

1. PC에서 `npm run lan` 또는 `npm run tunnel` 실행
2. 폰·태블릿에서 **같은 주소**로 접속
3. 설정 → 회원가입 (데이터는 PC의 `data/` 폴더에 저장)
4. 다른 기기에서도 **같은 주소 + 같은 계정**으로 로그인

### 데이터 저장 위치

`C:\Users\KR\projects\car-ledger\data\` — 내 PC에만 보관됩니다.

## GitHub 업로드

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<사용자명>/car-ledger.git
git push -u origin main
```

## Render 배포

### 방법 A — Blueprint (권장)

1. 위 코드를 GitHub에 push
2. [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
3. GitHub 저장소 연결 후 `render.yaml` 적용
4. 배포 완료 후 `https://car-ledger-xxxx.onrender.com` URL 확인

### 방법 B — 수동 Web Service

1. **New** → **Web Service** → GitHub 저장소 선택
2. 설정:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
3. 환경 변수:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = 임의의 긴 랜덤 문자열
   - `DATA_DIR` = `/var/data`
4. **Disks** 탭에서 Persistent Disk 추가:
   - Mount Path: `/var/data`
   - Size: 1 GB

### Render "Not Found" 해결

1. **정확한 URL 확인** — Render 대시보드 → 서비스 → 우측 상단 URL 복사 (`https://car-ledger.onrender.com` 형태, `xxxx`는 예시)
2. **배포 상태** — Events 탭에서 Latest Deploy가 **Live** 인지 확인
3. **로그 확인** — Logs 탭에 `차계부 서버 실행 중` 메시지가 있는지 확인
4. **헬스체크** — `https://<서비스URL>/api/health` 접속 시 `{"ok":true}` 나와야 함
5. **무료 플랜** — 15분 미사용 시 슬립 → 첫 접속 30~50초 대기 후 새로고침
6. **코드 push** — 수정 후 GitHub에 push하면 Render가 자동 재배포

> Free 플랜은 재배포 시 동기화 데이터가 초기화될 수 있습니다. 영구 보관이 필요하면 Starter + Disk를 추가하세요.

## 환경 변수

| 변수 | 설명 |
|------|------|
| `PORT` | Render가 자동 설정 |
| `JWT_SECRET` | 로그인 토큰 암호화 (필수) |
| `DATA_DIR` | 사용자 데이터 저장 경로 (`/var/data` 권장) |
| `OPINET_API_KEY` | 오피넷 API 키 (선택, 앱 설정에서도 입력 가능) |