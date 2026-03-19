# scripts/build-extension.ps1
Write-Host "Starting build for Chrome Extension..." -ForegroundColor Cyan

# 1. Clean existing out directory
if (Test-Path "out") {
    Write-Host "Cleaning 'out' directory..."
    Remove-Item -Recurse -Force "out"
}

# 2. Run Next.js build (with output: 'export')
Write-Host "Running next build with EXPORT=true..."
$env:EXPORT="true"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit $LASTEXITCODE
}

Write-Host "`nBuild complete! The 'out' folder is ready to be loaded as an unpacked extension in Chrome." -ForegroundColor Green
Write-Host "Steps to load:"
Write-Host "1. Open Chrome and go to chrome://extensions/"
Write-Host "2. Enable 'Developer mode' (top right)"
Write-Host "3. Click 'Load unpacked' and select the following folder:"
Write-Host "$(Get-Location)\out" -ForegroundColor Yellow
