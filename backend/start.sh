#!/bin/bash
# Skoros Backend Starter
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create virtual env if not exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# Install/update deps
echo "Installing dependencies..."
pip install -q -r requirements.txt

echo "Starting Skoros backend on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000
