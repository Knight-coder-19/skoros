#!/bin/bash
set -e
# Install nvm + Node.js (no root needed)
export NVM_DIR="$HOME/.nvm"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source "$NVM_DIR/nvm.sh"
nvm install 18
nvm use 18
# Install Python deps
pip install -r requirements.txt
