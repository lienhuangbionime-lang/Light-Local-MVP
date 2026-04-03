# Get project root
$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "🚀 Starting Local-First MVP Setup..." -ForegroundColor Cyan

# 1. Backend Dependencies
Write-Host "📦 Installing Backend Dependencies (pip)..." -ForegroundColor Yellow
pip install -r requirements.txt

# 2. Frontend Dependencies
Write-Host "📦 Installing Frontend Dependencies (npm)..." -ForegroundColor Yellow
npm install

# 3. Start Backend
Write-Host "🔥 Launching Backend (FastAPI)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; python main.py"

# 4. Start Frontend
Write-Host "🎨 Launching Frontend (Next.js)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; npm run dev"

Write-Host "`n✅ Setup Complete!" -ForegroundColor Cyan
Write-Host "----------------------------------------"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend:  http://localhost:8000"
Write-Host "----------------------------------------"
Write-Host "Keep this window open or close it as needed."
