#!/bin/bash

# Surf v0.0.3 启动脚本

# 检查是否在正确的目录
if [ ! -f "package.json" ] || [ ! -d "out" ]; then
    echo "错误: 请在解压后的Surf应用目录中运行此脚本"
    echo "该目录应包含 package.json 和 out/ 文件夹"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: 未检测到Node.js"
    echo "请先安装Node.js: https://nodejs.org/"
    exit 1
fi

# 检查Electron是否可用
if ! command -v npx &> /dev/null; then
    echo "错误: 未检测到npx"
    echo "请确保Node.js正确安装"
    exit 1
fi

echo "正在启动 Surf v0.0.3..."
echo "如果遇到安全警告，请参考 README.md 文件"
echo ""

# 使用npx运行Electron
npx electron out/main/index.js