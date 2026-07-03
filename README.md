# 차계부 (Car Ledger)

모바일 차계부 웹앱 — 주유 실시간 유가, 정비 기록, 운행거리, 클라우드 동기화.

## 로컬 실행

```bash
npm install
npm start
```

http://localhost:3456

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

> 클라우드 동기화 데이터를 유지하려면 Persistent Disk가 필요합니다. `render.yaml`은 Starter 플랜 + Disk 기준입니다.

## 환경 변수

| 변수 | 설명 |
|------|------|
| `PORT` | Render가 자동 설정 |
| `JWT_SECRET` | 로그인 토큰 암호화 (필수) |
| `DATA_DIR` | 사용자 데이터 저장 경로 (`/var/data` 권장) |
| `OPINET_API_KEY` | 오피넷 API 키 (선택, 앱 설정에서도 입력 가능) |