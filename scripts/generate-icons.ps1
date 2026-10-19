Add-Type -AssemblyName System.Drawing

$srcIconPath = (Resolve-Path "public\icon.png").Path
$srcMaskablePath = (Resolve-Path "public\icon-maskable-512x512.png").Path

$srcIcon = [System.Drawing.Bitmap]::FromFile($srcIconPath)
$srcMaskable = [System.Drawing.Bitmap]::FromFile($srcMaskablePath)

$bgColor = [System.Drawing.ColorTranslator]::FromHtml("#121214")

function Resize-Image($src, $targetW, $targetH, $destPath, $bg = $null, $innerScale = 1.0) {
    $bmp = New-Object System.Drawing.Bitmap $targetW, $targetH
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($bg -ne $null) {
        $brush = New-Object System.Drawing.SolidBrush $bg
        $g.FillRectangle($brush, 0, 0, $targetW, $targetH)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $drawW = [int]($targetW * $innerScale)
    $drawH = [int]($targetH * $innerScale)
    $drawX = [int](($targetW - $drawW) / 2)
    $drawY = [int](($targetH - $drawH) / 2)

    $g.DrawImage($src, $drawX, $drawY, $drawW, $drawH)
    $g.Dispose()

    $dir = Split-Path -Parent $destPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $destPath ($targetW x $targetH)"
}

# 1. Android Mipmap Icons
$densities = @{
    "mdpi" = @{ size = 48; fgSize = 108; fgScale = 0.65 }
    "hdpi" = @{ size = 72; fgSize = 162; fgScale = 0.65 }
    "xhdpi" = @{ size = 96; fgSize = 216; fgScale = 0.65 }
    "xxhdpi" = @{ size = 144; fgSize = 324; fgScale = 0.65 }
    "xxxhdpi" = @{ size = 192; fgSize = 432; fgScale = 0.65 }
}

foreach ($d in $densities.Keys) {
    $cfg = $densities[$d]
    $dir = "android\app\src\main\res\mipmap-$d"

    # ic_launcher.png (Legacy square launcher icon with dark background)
    Resize-Image $srcMaskable $cfg.size $cfg.size "$dir\ic_launcher.png" $bgColor 1.0

    # ic_launcher_round.png (Legacy round launcher icon)
    Resize-Image $srcMaskable $cfg.size $cfg.size "$dir\ic_launcher_round.png" $bgColor 1.0

    # ic_launcher_foreground.png (Adaptive icon foreground with transparent padding)
    Resize-Image $srcIcon $cfg.fgSize $cfg.fgSize "$dir\ic_launcher_foreground.png" $null $cfg.fgScale
}

# 2. Android Splash Screens
$splashes = @{
    "drawable" = @{ w = 480; h = 800 }
    "drawable-port-mdpi" = @{ w = 320; h = 480 }
    "drawable-port-hdpi" = @{ w = 480; h = 800 }
    "drawable-port-xhdpi" = @{ w = 720; h = 1280 }
    "drawable-port-xxhdpi" = @{ w = 960; h = 1600 }
    "drawable-port-xxxhdpi" = @{ w = 1280; h = 1920 }
    "drawable-land-mdpi" = @{ w = 480; h = 320 }
    "drawable-land-hdpi" = @{ w = 800; h = 480 }
    "drawable-land-xhdpi" = @{ w = 1280; h = 720 }
    "drawable-land-xxhdpi" = @{ w = 1600; h = 960 }
    "drawable-land-xxxhdpi" = @{ w = 1920; h = 1280 }
}

foreach ($s in $splashes.Keys) {
    $cfg = $splashes[$s]
    $targetDir = "android\app\src\main\res\$s"
    $dest = "$targetDir\splash.png"
    
    # In splash, logo should occupy about 25-30% of the shortest dimension
    $minDim = [Math]::Min($cfg.w, $cfg.h)
    $logoSize = [Math]::Max(120, [int]($minDim * 0.35))
    
    $bmp = New-Object System.Drawing.Bitmap $cfg.w, $cfg.h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $brush = New-Object System.Drawing.SolidBrush $bgColor
    $g.FillRectangle($brush, 0, 0, $cfg.w, $cfg.h)
    $brush.Dispose()

    $logoX = [int](($cfg.w - $logoSize) / 2)
    $logoY = [int](($cfg.h - $logoSize) / 2)
    $g.DrawImage($srcIcon, $logoX, $logoY, $logoSize, $logoSize)
    $g.Dispose()

    if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated Android Splash: $dest ($($cfg.w)x$($cfg.h))"
}

# 3. iOS Icons & Splash
$iosIconPath = "ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png"
Resize-Image $srcMaskable 1024 1024 $iosIconPath $bgColor 1.0

$iosSplashDir = "ios\App\App\Assets.xcassets\Splash.imageset"
@("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png") | ForEach-Object {
    $dest = "$iosSplashDir\$_"
    $bmp = New-Object System.Drawing.Bitmap 2732, 2732
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $brush = New-Object System.Drawing.SolidBrush $bgColor
    $g.FillRectangle($brush, 0, 0, 2732, 2732)
    $brush.Dispose()

    $logoSize = 800
    $logoX = [int]((2732 - $logoSize) / 2)
    $logoY = [int]((2732 - $logoSize) / 2)
    $g.DrawImage($srcIcon, $logoX, $logoY, $logoSize, $logoSize)
    $g.Dispose()

    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated iOS Splash: $dest"
}

$srcIcon.Dispose()
$srcMaskable.Dispose()
Write-Host "ALL ICONS AND SPLASH SCREENS GENERATED SUCCESSFULLY!"
