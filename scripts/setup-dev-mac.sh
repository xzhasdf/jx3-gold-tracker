#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
python3 -m venv python-venv
python-venv/bin/pip install -r python/requirements.txt
echo "✓ macOS 开发环境就绪，运行 npm run dev:app 开始调试"
