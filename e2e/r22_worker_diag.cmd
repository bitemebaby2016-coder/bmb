@echo off
REM R22 diagnostics — ดูสถานะโทเคน/บัญชี Cloudflare ของ Owner (ไม่แสดงค่า secret ใด ๆ)
cd /d "D:\A PROJECT\Bite Me Baby\workers\tenant-proxy"
echo === 1) KEY NAMES in .env.local (name only, no values) ===
for /f "tokens=1 delims==" %%a in ('findstr /b /i /c:CLOUDFLARE_ "..\..\.env.local"') do echo KEY=%%a
for /f "tokens=1 delims==" %%a in ('findstr /b /i /c:SUPABASE_ACCESS_TOKEN "..\..\.env.local"') do echo KEY=%%a
for /f "tokens=1 delims==" %%a in ('findstr /b /i /c:GOOGLE_ "..\..\.env.local"') do echo KEY=%%a
echo === 2) wrangler.toml (non-secret) ===
type wrangler.toml
echo === 3) root wrangler.* / .wrangler ===
dir /b "..\..\wrangler.toml" 2>nul || echo NO_ROOT_WRANGLER_TOML
dir /b "..\..\.wrangler" 2>nul || echo NO_ROOT_WRANGLER_DIR
echo === 4) wrangler whoami (โหลด token จาก .env.local) ===
for /f "tokens=1,* delims==" %%a in ('findstr /b /i /c:CLOUDFLARE_API_TOKEN "..\..\.env.local"') do set CLOUDFLARE_API_TOKEN=%%b
set WRANGLER_SEND_METRICS=false
wrangler whoami
echo DIAG_EXIT=%ERRORLEVEL%