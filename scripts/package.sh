#!/bin/sh
# Build the ZIP to upload to the Chrome Web Store: extension files only, no docs/, store/ or scripts/.
set -e
cd "$(dirname "$0")/.."
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
out="dist/cookie-keeper-$version.zip"
mkdir -p dist
rm -f "$out"
zip -q -r "$out" manifest.json background.js popup.html sidepanel.html popup.css popup.js \
  devtools.html devtools.js lib icons -x 'icons/icon.svg' -x '*.DS_Store'
echo "$out"
unzip -l "$out" | tail -n +4 | sed '$d' | sed '$d' | awk '{print "  " $4}'
