#!/bin/bash

# iOS Safari 兼容性构建和测试脚本

echo "🔧 开始 iOS Safari 兼容性构建..."

# 清理旧的构建
echo "📦 清理旧构建..."
rm -rf dist
rm -rf node_modules/.vite

# 重新安装依赖（如果需要）
if [ "$1" == "--fresh" ]; then
  echo "🔄 重新安装依赖..."
  rm -rf node_modules
  npm install
fi

# 构建
echo "🏗️  构建生产版本..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ 构建失败！"
  exit 1
fi

echo "✅ 构建成功！"

# 检查生成的 JS 文件兼容性
echo ""
echo "🔍 检查生成文件的 ES 兼容性..."

# 查找主要的 JS 文件
MAIN_JS=$(find dist/assets -name "index-*.js" | head -1)

if [ -z "$MAIN_JS" ]; then
  echo "⚠️  未找到主 JS 文件"
else
  echo "📄 检查文件: $MAIN_JS"
  
  # 检查文件大小
  SIZE=$(wc -c < "$MAIN_JS" | tr -d ' ')
  SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
  echo "   大小: ${SIZE_MB}MB"
  
  # 检查是否包含不兼容的语法
  echo ""
  echo "🔎 检查潜在的 iOS Safari 不兼容语法..."
  
  # BigInt literal (123n)
  if grep -q '[0-9]n[^a-zA-Z]' "$MAIN_JS" 2>/dev/null; then
    echo "   ⚠️  发现 BigInt 字面量 (123n) - 可能在 iOS 13 及以下不支持"
  else
    echo "   ✅ 未发现 BigInt 字面量"
  fi
  
  # Optional chaining
  OPTIONAL_CHAINING_COUNT=$(grep -o '\?\.' "$MAIN_JS" 2>/dev/null | wc -l | tr -d ' ')
  echo "   ℹ️  Optional chaining (?.) 使用次数: $OPTIONAL_CHAINING_COUNT (iOS 13.4+ 支持)"
  
  # Nullish coalescing
  NULLISH_COUNT=$(grep -o '??' "$MAIN_JS" 2>/dev/null | wc -l | tr -d ' ')
  echo "   ℹ️  Nullish coalescing (??) 使用次数: $NULLISH_COUNT (iOS 13.4+ 支持)"
  
  # Class fields
  if grep -q 'class.*{.*#' "$MAIN_JS" 2>/dev/null; then
    echo "   ⚠️  发现私有类字段 (#field) - iOS 14.5+ 支持"
  else
    echo "   ✅ 未发现私有类字段"
  fi
fi

echo ""
echo "📊 构建统计:"
echo "   总文件数: $(find dist -type f | wc -l | tr -d ' ')"
echo "   JS 文件数: $(find dist -name "*.js" | wc -l | tr -d ' ')"
echo "   CSS 文件数: $(find dist -name "*.css" | wc -l | tr -d ' ')"

echo ""
echo "🎉 构建完成！"
echo ""
echo "📱 iOS Safari 测试建议:"
echo "   1. 在 iPhone 上访问网站"
echo "   2. 如果黑屏，等待 3 秒查看错误信息"
echo "   3. 启用 Safari Web Inspector (设置 → Safari → 高级)"
echo "   4. 在 Mac Safari 的开发菜单中连接 iPhone 查看控制台"
echo ""
echo "🚀 预览构建结果: npm run preview"
