# S1-prime-A replay harness (AUDIT TOOL - never deployed to production)
param([string]$Container = 'supabase_db_ivkdfognyiwjcmrhcnwz', [string]$ResumeAfter = '')
$ErrorActionPreference = 'Continue'
# Bootstrap bare supabase/postgres: postgres needs role memberships for patch DDL
$bootOut = docker exec $Container psql -U supabase_admin -d postgres -c "GRANT supabase_storage_admin TO postgres; GRANT supabase_auth_admin TO postgres;" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Output "BOOTSTRAP_NOTE: $((($bootOut | Out-String).Trim() -split "`n")[0])" }

$manifest = Join-Path $PSScriptRoot 'manifest.txt'
$tmpSql = Join-Path $env:TEMP 'bmb_replay_current.sql'
$resuming = $false
$i = 0
Get-Content $manifest | ForEach-Object {
  $f = $_.Trim()
  if ($f -and -not $f.StartsWith('#')) {
    $patchFile = $null
    if ($f.Contains('|PATCH:')) {
      $pair = $f.Split('|')
      $f = $pair[0]
      $patchFile = Join-Path $PSScriptRoot ($pair[1] -replace '^PATCH:', '')
    }
    if ($ResumeAfter -and -not $resuming) { if ($f -eq $ResumeAfter) { $resuming = $true }; return }
    $i++
    if ($f -eq '00_seed_auth.sql') { $file = Join-Path $PSScriptRoot $f } else { $file = Join-Path $PSScriptRoot (Join-Path '..\migrations' $f) }
    if ($patchFile) { $file = $patchFile }
    $sql = (Get-Content $file -Raw).Replace('$$_', '$$')
    $sql = [regex]::Replace($sql, '(?m)^=+(?=BEGIN;)', '')
    [System.IO.File]::WriteAllText($tmpSql, $sql)
    $out = cmd /c "docker exec -i $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < `"$tmpSql`" 2>&1" | Out-String
    if ($LASTEXITCODE -ne 0) {
      Write-Output "FAIL#$i $f"
      Write-Output ($out.Trim() -split "`n" | Select-Object -First 6)
      Write-Output "STOPPED_AT=$f INDEX=$i"
      exit 1
    } elseif ($out.Trim()) {
      Write-Output "WARN#$i $f :: $((($out.Trim() -split "`n")[0..2]) -join ' | ')"
    }
  }
}
Write-Output "REPLAY_OK FILES=$i FAILURES=0"
