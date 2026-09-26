# One-off: compress real review screenshots (public/assets/reviews/*.jpg)
# into small JPEGs (public/assets/reviews/small/review-NN.jpg) for web use.
# Also generates a 1200x630 og-image (public/og-image.png) since it is missing.
Add-Type -AssemblyName System.Drawing
$srcDir = "public\assets\reviews"
$outDir = "public\assets\reviews\small"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$files = Get-ChildItem $srcDir -Filter *.jpg | Sort-Object Name
$maxW = 640
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]58)
$n = 0
foreach ($f in $files) {
  $n++
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $w = $maxW; $h = [int]([double]$img.Height * $maxW / $img.Width)
  if ($img.Width -le $maxW) { $w = $img.Width; $h = $img.Height }
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $name = "review-{0:d2}.jpg" -f $n
  $bmp.Save((Join-Path $outDir $name), $enc, $ep)
  $bmp.Dispose(); $img.Dispose()
}
$small = Get-ChildItem $outDir | Measure-Object -Property Length -Sum
"COMPRESSED $($small.Count) files, total $([math]::Round($small.Sum/1KB)) KB"

# og-image.png 1200x630 (file referenced by index.html but missing)
$ow = 1200; $oh = 630
$bmp = New-Object System.Drawing.Bitmap($ow, $oh)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,247,237,237))
$g.FillRectangle($bg, 0, 0, $ow, $oh)
$accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,249,115,22))
$g.FillRectangle($accent, 0, ($oh-18), $ow, 18)
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,60,50,45))
$fontBig = New-Object System.Drawing.Font('Segoe UI', 72, [System.Drawing.FontStyle]::Bold)
$fontSm = New-Object System.Drawing.Font('Segoe UI', 30)
$g.DrawString('Bite Me Baby', $fontBig, $accent, 60, 180)
$g.DrawString([char]0x0E2A + [char]0x0E31 + [char]0x0E48 + [char]0x0E07 + [char]0x0E2D + [char]0x0E32 + [char]0x0E2B + [char]0x0E32 + [char]0x0E23 + [char]0x0E08 + [char]0x0E31 + [char]0x0E14 + [char]0x0E2A + [char]0x0E48 + [char]0x0E07 + ' ' + [char]0x0E08 + [char]0x0E31 + [char]0x0E19 + [char]0x0E17 + [char]0x0E1A + [char]0x0E38 + [char]0x0E23 + [char]0x0E35, $fontSm, $white, 70, 320)
$g.Dispose()
$bmp.Save("public\og-image.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
"OG-IMAGE OK public\og-image.png"
