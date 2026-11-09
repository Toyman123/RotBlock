# Renders RotBlock's app icons (black square, "ROT / BLOCK" in white) into public/.
# Run: powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\public'
New-Item -ItemType Directory -Force $out | Out-Null

function Make-Icon([int]$size, [string]$name, [double]$pad) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 13, 13, 16))

  $brush = [System.Drawing.Brushes]::White
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $fmt.LineAlignment = 'Center'

  # Fit "BLOCK" to the padded width, use the same size for "ROT".
  $inner = $size * (1 - 2 * $pad)
  $fontSize = $size * 0.3
  do {
    $font = New-Object System.Drawing.Font('Arial Black', [float]$fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $w = $g.MeasureString('BLOCK', $font).Width
    $fontSize -= 1
  } while ($w -gt $inner -and $fontSize -gt 4)

  $lineH = $font.Height * 0.86
  $cy = $size / 2
  $g.DrawString('ROT', $font, $brush, (New-Object System.Drawing.RectangleF 0, ($cy - $lineH), $size, $lineH), $fmt)
  $g.DrawString('BLOCK', $font, $brush, (New-Object System.Drawing.RectangleF 0, $cy, $size, $lineH), $fmt)

  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Make-Icon 180 'apple-touch-icon.png' 0.14
Make-Icon 192 'icon-192.png' 0.14
Make-Icon 512 'icon-512.png' 0.14
Make-Icon 512 'icon-maskable-512.png' 0.24
Make-Icon 48 'favicon.png' 0.08
"icons written to $out"
