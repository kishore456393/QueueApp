# Automated setup script for Queue Detection System on fresh Windows installation

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Queue Detection System - Setup Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check Python
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version
    Write-Host "✅ Python version: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed!" -ForegroundColor Red
    Write-Host "Please install Python from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Check FFmpeg
Write-Host "Checking FFmpeg installation..." -ForegroundColor Yellow
try {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "✅ FFmpeg is installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  FFmpeg is not installed!" -ForegroundColor Yellow
    Write-Host "Please install FFmpeg from: https://ffmpeg.org/download.html" -ForegroundColor Yellow
    Write-Host "Installation guide: https://www.geeksforgeeks.org/how-to-install-ffmpeg-on-windows/" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Installing Dependencies" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Install Node.js dependencies
Write-Host ""
Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Node.js dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js dependencies installed" -ForegroundColor Green

# Create virtual environment
Write-Host ""
Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
Set-Location detector
python -m venv venv
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create virtual environment" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Virtual environment created" -ForegroundColor Green

# Activate virtual environment and install dependencies
Write-Host ""
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Python dependencies" -ForegroundColor Red
    deactivate
    Set-Location ..
    exit 1
}
Write-Host "✅ Python dependencies installed" -ForegroundColor Green
deactivate
Set-Location ..

# Create necessary directories
Write-Host ""
Write-Host "Creating necessary directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
Write-Host "✅ Directories created" -ForegroundColor Green

# Check YOLO model
Write-Host ""
Write-Host "Checking YOLO model..." -ForegroundColor Yellow
if (-not (Test-Path "detector\yolov8n.pt")) {
    Write-Host "Downloading YOLOv8 model..." -ForegroundColor Yellow
    Set-Location detector
    & .\venv\Scripts\Activate.ps1
    python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
    deactivate
    Set-Location ..
    Write-Host "✅ YOLO model downloaded" -ForegroundColor Green
} else {
    Write-Host "✅ YOLO model already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Setup Complete! ✅" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application, run:" -ForegroundColor Yellow
Write-Host "  .\start-servers.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Or start manually:" -ForegroundColor Yellow
Write-Host "  Terminal 1: npm run dev" -ForegroundColor White
Write-Host "  Terminal 2: cd detector; python main.py" -ForegroundColor White
Write-Host ""
Write-Host "Access the app at: http://localhost:5000" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
