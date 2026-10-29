@echo off
REM R22 deploy tenant-proxy worker (Owner อนุมัติแล้ว 2026-10-30)
REM โหลด CLOUDFLARE_API_TOKEN จาก .env.local (ไม่ echo ค่า) แล้ว deploy จากโฟลเดอร์ worker
cd /d "D:\A PROJECT\Bite Me Baby\workers\tenant-proxy"
for /f "tokens=1,* delims==" %%a in ('findstr /b /i /c:CLOUDFLARE_API_TOKEN "..\..\.env.local"') do set CLOUDFLARE_API_TOKEN=%%b
set WRANGLER_SEND_METRICS=false
wrangler deploy
echo WRANGLER_EXIT=%ERRORLEVEL%