#!/bin/bash
set -e
# Install Node.js for yt-dlp YouTube extraction
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
# Install Python deps
pip install -r requirements.txt
