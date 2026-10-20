#!/bin/bash
# Render every variant: swap it into index.html, check, render to out/.
set -e
cd "$(dirname "$0")/.."
mkdir -p out
for v in ${@:-en-landscape en-portrait he-landscape he-portrait}; do
  cp "variants/$v.html" index.html
  npx --yes hyperframes@0.8.181 render --quiet -q delivery -o "out/sommi-app-tour-$v.mp4"
done
cp variants/en-landscape.html index.html
