@echo off
REM R22 deploy tenant-proxy worker — harden 2026-10-30 (Owner: ทำ deploy ให้เสร็จ ห้ามค้าง)
REM จุดค้างเดิม: ไม่มี token / wrangler ไม่อยู่ใน PATH → wrangler รอ prompt login ค้างนิรันดร์
cd /d "D:\A PROJECT\Bite Me Baby\workers\tenant-proxy"
setlocal
set CLOUDFLARE_API_TOKEN=
for /f "tokens=1,* delims==" %%a in ('findstr /b /i /c:CLOUDFLARE_API_TOKEN "..\..\.env.local"') do set CLOUDFLARE_API_TOKEN=%%b
if not defined CLOUDFLARE_API_TOKEN (
  echo [r22] MISSING CLOUDFLARE_API_TOKEN in .env.local - abort without prompt
  exit /b 2
)
set WRANGLER_SEND_METRICS=false
set CI=true
where wrangler >nul 2>nul
if errorlevel 1 (
  echo [r22] wrangler not on PATH - using npx --yes wrangler deploy
  npx --yes wrangler deploy --minify
) else (
  wrangler deploy --minify
)
set EXITCODE=%ERRORLEVEL%
echo WRANGLER_EXIT=%EXITCODE%
endlocal & exit /b %EXITCODE%