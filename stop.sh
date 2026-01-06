#!/bin/bash

# KiKo 项目停止脚本

echo "🛑 停止 KiKo 项目..."

# 读取 PID 并停止进程
if [ -f "logs/python.pid" ]; then
    PYTHON_PID=$(cat logs/python.pid)
    if kill -0 $PYTHON_PID 2>/dev/null; then
        kill $PYTHON_PID
        echo "  ✅ Python 服务已停止"
    fi
    rm logs/python.pid
fi

# 兼容旧的 grok.pid
if [ -f "logs/grok.pid" ]; then
    GROK_PID=$(cat logs/grok.pid)
    if kill -0 $GROK_PID 2>/dev/null; then
        kill $GROK_PID
        echo "  ✅ Grok 服务已停止"
    fi
    rm logs/grok.pid
fi

if [ -f "logs/api.pid" ]; then
    API_PID=$(cat logs/api.pid)
    if kill -0 $API_PID 2>/dev/null; then
        kill $API_PID
        echo "  ✅ API 服务已停止"
    fi
    rm logs/api.pid
fi

if [ -f "logs/web.pid" ]; then
    WEB_PID=$(cat logs/web.pid)
    if kill -0 $WEB_PID 2>/dev/null; then
        kill $WEB_PID
        echo "  ✅ 前端已停止"
    fi
    rm logs/web.pid
fi

# 确保没有残留进程
pkill -f "kiko-python/main.py" 2>/dev/null
pkill -f "kiko-api" 2>/dev/null

echo ""
echo "✨ 所有服务已停止"
