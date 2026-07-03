# 같은 Wi-Fi 안의 폰/태블릿에서 접속 (배포 불필요)
$Port = if ($env:PORT) { $env:PORT } else { 3456 }
$Root = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "=== 차계부 개인 서버 (LAN) ===" -ForegroundColor Cyan
Write-Host ""

$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -ExpandProperty IPAddress -Unique

if ($ips) {
  Write-Host "모바일 브라우저에서 아래 주소로 접속하세요:" -ForegroundColor Green
  foreach ($ip in $ips) {
    Write-Host "  http://${ip}:${Port}" -ForegroundColor Yellow
  }
} else {
  Write-Host "IP를 찾지 못했습니다. ipconfig 로 확인하세요." -ForegroundColor Red
}

Write-Host ""
Write-Host "종료: Ctrl+C" -ForegroundColor DarkGray
Write-Host ""

Set-Location $Root
$env:PORT = $Port
node server.js