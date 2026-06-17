#!/bin/bash
# Automated setup script for Queue Detection System on fresh installation

echo "=========================================="
echo "Queue Detection System - Setup Script"
echo "=========================================="
echo ""

# Check Node.js
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js version: $(node --version)"

# Check Python
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed!"
    echo "Please install Python from: https://www.python.org/downloads/"
    exit 1
fi
echo "✅ Python version: $(python3 --version)"

# Check FFmpeg
echo "Checking FFmpeg installation..."
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg is not installed!"
    echo "Please install FFmpeg:"
    echo "  Linux: sudo apt install ffmpeg"
    echo "  Mac: brew install ffmpeg"
    exit 1
fi
echo "✅ FFmpeg version: $(ffmpeg -version | head -n 1)"

echo ""
echo "=========================================="
echo "Installing Dependencies"
echo "=========================================="

# Install Node.js dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node.js dependencies"
    exit 1
fi
echo "✅ Node.js dependencies installed"

# Create virtual environment
echo ""
echo "Creating Python virtual environment..."
cd detector
python3 -m venv venv
if [ $? -ne 0 ]; then
    echo "❌ Failed to create virtual environment"
    exit 1
fi
echo "✅ Virtual environment created"

# Activate virtual environment and install dependencies
echo ""
echo "Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Python dependencies"
    deactivate
    exit 1
fi
echo "✅ Python dependencies installed"
deactivate
cd ..

# Create necessary directories
echo ""
echo "Creating necessary directories..."
mkdir -p uploads
mkdir -p logs
echo "✅ Directories created"

# Download YOLO model if not exists
echo ""
echo "Checking YOLO model..."
if [ ! -f "detector/yolov8n.pt" ]; then
    echo "Downloading YOLOv8 model..."
    cd detector
    source venv/bin/activate
    python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
    deactivate
    cd ..
    echo "✅ YOLO model downloaded"
else
    echo "✅ YOLO model already exists"
fi

echo ""
echo "=========================================="
echo "Setup Complete! ✅"
echo "=========================================="
echo ""
echo "To start the application, run:"
echo "  ./start.sh"
echo ""
echo "Or start manually:"
echo "  Terminal 1: npm run dev"
echo "  Terminal 2: cd detector && python main.py"
echo ""
echo "Access the app at: http://localhost:5000"
echo "=========================================="
