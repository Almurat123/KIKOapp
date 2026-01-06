#!/bin/bash

# KiKo 项目启动脚本
# 一键启动所有服务

echo "🚀 启动 KiKo 项目..."

# 检查是否在正确的目录
if [ ! -d "kiko-api" ] || [ ! -d "kiko-web" ] || [ ! -d "kiko-python" ]; then
    echo "❌ 错误：请在 KiKo 项目根目录运行此脚本"
    exit 1
fi

# 创建日志目录
mkdir -p logs

# 启动 Python 统一服务 (Grok + Moderation + RAG)
echo "🐍 启动 Python 统一服务 (端口 8000)..."
cd kiko-python
source ../.venv/bin/activate 2>/dev/null || source ../venv/bin/activate 2>/dev/null || {
    echo "  创建 Python 虚拟环境..."
    python3 -m venv ../.venv
    source ../.venv/bin/activate
}
pip install -q -r requirements.txt
nohup python3 -u main.py > ../logs/python.log 2>&1 &
PYTHON_PID=$!
echo "  ✅ Python 服务已启动 (PID: $PYTHON_PID)"
cd ..

# 等待 Python 服务启动
sleep 5

# 启动 API 服务
echo "🔧 启动 API 服务 (端口 3001)..."
cd kiko-api
if [ ! -d "node_modules" ]; then
    echo "  安装依赖..."
    npm install
fi
nohup npm run dev > ../logs/api.log 2>&1 &
API_PID=$!
echo "  ✅ API 服务已启动 (PID: $API_PID)"
cd ..

# 等待 API 服务启动
sleep 3

# 启动前端
echo "🎨 启动前端 (端口 5173)..."
cd kiko-web
if [ ! -d "node_modules" ]; then
    echo "  安装依赖..."
    npm install
fi
nohup npm run dev > ../logs/web.log 2>&1 &
WEB_PID=$!
echo "  ✅ 前端已启动 (PID: $WEB_PID)"
cd ..

# 保存 PID 到文件
mkdir -p logs
echo "$PYTHON_PID" > logs/python.pid
echo "$API_PID" > logs/api.pid
echo "$WEB_PID" > logs/web.pid

echo ""
echo "✨ 所有服务已启动！"
echo ""
echo "📍 访问地址："
echo "  - 前端:           http://localhost:5173"
echo "  - API:            http://localhost:3001"
echo "  - Python 服务:    http://localhost:8000"
echo "    - Grok:         http://localhost:8000/grok"
echo "    - Moderation:   http://localhost:8000/moderation"
echo "    - RAG:          http://localhost:8000/rag"
echo ""
echo "📝 查看日志："
echo "  tail -f logs/python.log"
echo "  tail -f logs/api.log"
echo "  tail -f logs/web.log"
echo ""
echo "🛑 停止服务："
echo "  ./stop.sh"
echo ""
