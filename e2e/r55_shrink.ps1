# e2e/r55_shrink.ps1 — ย่อสกรีนช็อตรีวิวต้นฉบับทั้งหมดลง 700px เพื่ออ่านทวนภาษา (งานตรวจ "ยังเพี้ยน")
Add-Type -AssemblyName System.Drawing
$root = 'D:\A PROJECT\Bite Me Baby'
$srcDir = Join-Path $root 'public\assets\reviews'
$dstDir = Join-Path $root 'e2e'
$files = Get-ChildItem -Path $srcDir -Filter 'Screenshot_2026-09-17-*.jpg' | Sort-Object Name
$i = 0
foreach ($f in $files) {
  $i++
  $n = '{0:d2}' -f $i
  $dp = Join-Path $dstDir ("tmp_r55_rev_" + $n + ".jpg")
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $w = 480
  $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $img.Dispose()
  # PNG — อ่านผ่าน read_files ได้ (JPEG โดน size/invalid limit)
  $dp2 = [System.IO.Path]::ChangeExtension($dp, '.png')
  $bmp.Save($dp2, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Remove-Item $dp -ErrorAction SilentlyContinue
  Write-Output ("OK " + $n + " <- " + $f.Name)
}
