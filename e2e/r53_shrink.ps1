// e2e/r53_shrink.ps1 — ย่อภาพรีวิวต้นฉบับ (ใหญ่เกิน vision limit) ลง 700px เพื่ออ่านข้อความ Da K./Bronus P.
Add-Type -AssemblyName System.Drawing
$root = 'D:\A PROJECT\Bite Me Baby'
$jobs = @(
  @{ src = 'public\assets\reviews\Screenshot_2026-09-17-19-01-38-442_com.grab.merchant.jpg'; dst = 'e2e\tmp_r53_a.jpg' },
  @{ src = 'public\assets\reviews\Screenshot_2026-09-17-19-03-37-757_com.grab.merchant.jpg'; dst = 'e2e\tmp_r53_b.jpg' },
  @{ src = 'public\assets\reviews\Screenshot_2026-09-17-19-04-08-935_com.grab.merchant.jpg'; dst = 'e2e\tmp_r53_c.jpg' }
)
foreach ($j in $jobs) {
  $sp = Join-Path $root $j.src
  $dp = Join-Path $root $j.dst
  if (-not (Test-Path $sp)) { Write-Output ("MISS " + $j.src); continue }
  $img = [System.Drawing.Image]::FromFile($sp)
  $w = 700
  $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $img.Dispose()
  $bmp.Save($dp, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $bmp.Dispose()
  Write-Output ("OK " + $j.dst)
}