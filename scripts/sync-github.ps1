# PowerShell script to sync local changes to GitHub

Write-Host "?? Staging changes..." -ForegroundColor Cyan
git add .

$CommitMsg = "feat: backend stability, AI store extraction, and 7-11 format alignment"
Write-Host "?? Committing with message: '$CommitMsg'..." -ForegroundColor Cyan
git commit -m $CommitMsg

Write-Host "?? Pushing to main..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "? Successfully synced to GitHub!" -ForegroundColor Green
} else {
    Write-Host "?? Sync failed. Please check for conflicts or authentication issues." -ForegroundColor Red
}

Write-Host "Press any key to exit..."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
