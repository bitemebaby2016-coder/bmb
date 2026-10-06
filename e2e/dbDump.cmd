@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
docker image inspect postgres:17-alpine >nul 2>&1
if errorlevel 1 (
  echo PULLING postgres:17-alpine ...
  docker pull postgres:17-alpine || (echo PULL_FAIL & exit /b 1)
)
set /p PW=<.dbpw.tmp
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set TS=%%i
docker run --rm -v "%cd%\backups:/backup" -e PGPASSWORD=%PW% postgres:17-alpine pg_dump -h aws-0-ap-northeast-2.pooler.supabase.com -p 6543 -U postgres.ivkdfognyiwjcmrhcnwz -d postgres -F p -f "/backup/prod-full-%TS%.sql" --no-owner
if errorlevel 1 (echo DUMP_FAIL & exit /b 1)
echo DUMP_OK
for %%f in (backups\prod-full-%TS%.sql) do echo SIZE %%~zf
del .dbpw.tmp