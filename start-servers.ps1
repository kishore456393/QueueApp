# Start both backend servers
Write-Host "Starting ArtistryEdu Backend Services..." -ForegroundColor Cyan
Write-Host ""

# Start Node.js server in background
Write-Host "Starting Node.js server (port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npx tsx server/index.ts"

# Wait a moment
Start-Sleep -Seconds 2

# Start Python detector in background  
Write-Host "Starting Python detector (port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\detector'; python main.py"

# Wait and check status
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "=== Checking Server Status ===" -ForegroundColor Cyan

$node = netstat -ano | Select-String ":5000.*LISTENING"
$python = netstat -ano | Select-String ":8000.*LISTENING"

if ($node) {
    Write-Host "✅ Node.js Server (Port 5000): RUNNING" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js Server (Port 5000): NOT RUNNING" -ForegroundColor Red
}

if ($python) {
    Write-Host "✅ Python Detector (Port 8000): RUNNING" -ForegroundColor Green
} else {
    Write-Host "❌ Python Detector (Port 8000): NOT RUNNING" -ForegroundColor Red
}

Write-Host ""
Write-Host "Backend servers are starting in separate windows..." -ForegroundColor Green
Write-Host "Press any key to exit this script (servers will continue running)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
