# 외부( LTE 등 )에서도 접속 — 비공개 임시 URL (배포 불필요)
# URL은 본인만 알면 됩니다. 서버 끄면 접속 불가.
$Port = if ($env:PORT) { $env:PORT } else { 3456 }
$Root = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "=== 차계부 개인 터널 ===" -ForegroundColor Cyan
Write-Host "서버 시작 후 임시 URL이 표시됩니다." -ForegroundColor DarkGray
Write-Host ""

Set-Location $Root
$env:PORT = $Port

$server = Start-Process -FilePath node -ArgumentList "server.js" -WorkingDirectory $Root -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

if (-not $server.HasExited) {
  Write-Host "로컬 서버 실행 중 (PID $($server.Id))" -ForegroundColor Green
} else {
  Write-Host "서버 시작 실패. 포트 $Port 이 사용 중일 수 있습니다." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "터널 연결 중... (your url is: 로 표시된 주소를 모바일에 입력)" -ForegroundColor Yellow
Write-Host "종료: Ctrl+C" -ForegroundColor DarkGray
Write-Host ""

try {
  npx --yes localtunnel --port $Port
} finally {
  if (-not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
  Write-Host "서버를 종료했습니다." -ForegroundColor DarkGray
}