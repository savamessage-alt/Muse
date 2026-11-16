#!/usr/bin/env pwsh
# Script to take real screenshots from device

$adb = "C:\Users\Va_Dar\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$outDir = "store/rustore/real"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

$screens = @(
    @{ id = "01-home";        name = "Home - My Wave";        path = "/" },
    @{ id = "02-search";      name = "Search";                path = "/search" },
    @{ id = "03-radio";       name = "Radio / My Wave";       path = "/radio" },
    @{ id = "04-favorites";   name = "Favorites (Likes)";     path = "/likes" },
    @{ id = "05-history";     name = "History";               path = "/history" },
    @{ id = "06-playlists";   name = "My Playlists";          path = "/playlists" },
    @{ id = "07-artist";      name = "Artist Page";           path = "/artist/12345" }
)

foreach ($screen in $screens) {
    Write-Host "Taking screenshot: $($screen.id) - $($screen.name)..."
    
    # Navigate to screen via deep link (HashRouter)
    $deepLink = "musep://$($screen.path)"
    & $adb shell am start -n com.ymplayer.app/com.ymplayer.app.MainActivity -d $deepLink 2>$null
    
    # Wait for render
    Start-Sleep -Seconds 2
    
    # Take screenshot
    $outFile = "$outDir/$($screen.id).png"
    & $adb exec-out screencap -p > $outFile
    
    if (Test-Path $outFile) {
        $size = (Get-Item $outFile).Length
        Write-Host "   OK: $outFile ($size bytes)"
    } else {
        Write-Host "   FAILED to capture screenshot"
    }
}

Write-Host "`nDone! Screenshots in $outDir"