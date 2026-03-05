#!/usr/bin/env bash
# 在 macOS 上创建 Windows x64 Python 运行时，用于 electron-builder extraResources
set -e
cd "$(dirname "$0")/.."
PYTHON_VER="3.11.9"
RUNTIME_DIR="python-runtime"
PIP_CACHE=".pip-cache"

# 1. 下载 Windows Embedded Python
curl -L "https://python.org/ftp/python/${PYTHON_VER}/python-${PYTHON_VER}-embed-amd64.zip" \
     -o /tmp/python-win-embed.zip
rm -rf "$RUNTIME_DIR" && mkdir -p "$RUNTIME_DIR"
unzip -q /tmp/python-win-embed.zip -d "$RUNTIME_DIR"

# 2. 启用 site-packages（取消 ._pth 中的 #import site）
sed -i '' 's/#import site/import site/' "$RUNTIME_DIR"/python311._pth

# 3. 下载 Windows x64 wheel 包（在 macOS 上用 --platform 指定目标平台）
mkdir -p "$PIP_CACHE/win"
pip download \
  --platform win_amd64 \
  --python-version 311 \
  --only-binary=:all: \
  --dest "$PIP_CACHE/win" \
  -r python/requirements.txt

# 4. 解压 wheel 到 site-packages（wheel 本质是 zip）
SITE_PKG="$RUNTIME_DIR/Lib/site-packages"
mkdir -p "$SITE_PKG"
for whl in "$PIP_CACHE/win"/*.whl; do
  unzip -q -o "$whl" -d "$SITE_PKG"
done

# 5. 复制 worker 脚本
cp python/ocr_worker.py "$RUNTIME_DIR/ocr_worker.py"

echo "✓ Windows 运行时就绪（$(du -sh $RUNTIME_DIR | cut -f1)），运行 npm run pack:win 打包"
