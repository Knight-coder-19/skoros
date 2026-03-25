#!/bin/bash
# Skoros - Full Setup Script
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

log() { echo -e "${CYAN}[skoros]${NC} $1"; }
ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; }

echo ""
echo -e "${BOLD}  skoros — Social Media Downloader${NC}"
echo -e "  Setup script"
echo ""

# --- Backend ---
log "Setting up backend..."
cd "$(dirname "$0")/backend"

if ! command -v python3 &>/dev/null; then
  err "Python 3 is required but not found. Install it from python.org"
  exit 1
fi

if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
ok "Backend dependencies installed"

# Check yt-dlp
python3 -c "import yt_dlp; print('  yt-dlp version:', yt_dlp.version.__version__)"

# --- Desktop app ---
cd "$(dirname "$0")/desktop"
if command -v node &>/dev/null && [ -f "package.json" ]; then
  log "Installing desktop app dependencies..."
  npm install --silent
  ok "Desktop app ready. Run: cd desktop && npm start"
else
  warn "Node.js not found. Skipping desktop app setup."
fi

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo "  Start backend:       cd backend && ./start.sh"
echo "  Start desktop app:   cd desktop && npm start"
echo "  Open website:        open website/index.html"
echo ""
echo "  Mobile app (React Native) requires:"
echo "    - Android Studio (for Android APK)"
echo "    - Xcode on Mac (for iOS)"
echo "    - cd app && npm install && npx react-native run-android"
echo ""
