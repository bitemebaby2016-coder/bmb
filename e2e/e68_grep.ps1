# e68_grep.ps1 — F=ไฟล์ P=pattern N=จำนวนสูงสุด (กัน $_ โดน shell กิน + ไม่ชน switch -File)
param([string]$F, [string]$P, [int]$N = 30)
$hits = Select-String -Path $F -Pattern $P | Select-Object -First $N
foreach ($h in $hits) { Write-Output ($h.LineNumber.ToString() + ' | ' + $h.Line.Trim()) }

