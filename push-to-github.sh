#!/bin/bash
# Run this from your project folder to push to GitHub
cd "$(dirname "$0")"
git remote set-url origin https://github.com/DevinFranco/upquest.git 2>/dev/null || git remote add origin https://github.com/DevinFranco/upquest.git
git push -u origin main
echo "✅ Done! Now run: eas build --platform ios"
