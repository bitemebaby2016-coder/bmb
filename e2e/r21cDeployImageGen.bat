@echo off
cd /d "D:\A PROJECT\Bite Me Baby"
for /f "tokens=2 delims==" %%a in ('findstr SUPABASE_ACCESS_TOKEN .env.local') do set SUPABASE_ACCESS_TOKEN=%%a
call npx supabase functions deploy image-gen --project-ref ivkdfognyiwjcmrhcnwz
echo DEPLOY_EXIT=%ERRORLEVEL%