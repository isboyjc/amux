#!/bin/bash

# Amux Tunnel API 配置脚本

echo "🚀 Amux Tunnel API 配置助手"
echo "================================"
echo ""

# 获取 Account ID
echo "📋 Step 1: 获取 Account ID..."
ACCOUNT_ID=$(npx wrangler whoami 2>/dev/null | grep -oE '[a-f0-9]{32}' | head -1)

if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ 无法自动获取 Account ID"
  echo "请手动运行: npx wrangler whoami"
  read -p "请输入你的 Account ID: " ACCOUNT_ID
else
  echo "✅ Account ID: $ACCOUNT_ID"
fi

echo ""

# 获取 Zone ID
echo "📋 Step 2: 获取 Zone ID (amux.ai)..."
echo "运行命令: npx wrangler zones list"
echo ""

ZONES=$(npx wrangler zones list 2>/dev/null)
echo "$ZONES"
echo ""

read -p "请输入 amux.ai 对应的 Zone ID: " ZONE_ID

echo ""
echo "📝 Step 3: 更新配置文件..."

# 更新 wrangler.toml
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' "s/CF_ZONE_ID = \"your-zone-id-here\"/CF_ZONE_ID = \"$ZONE_ID\"/" wrangler.toml
  sed -i '' "s/CF_ACCOUNT_ID = \"your-account-id-here\"/CF_ACCOUNT_ID = \"$ACCOUNT_ID\"/" wrangler.toml
else
  # Linux
  sed -i "s/CF_ZONE_ID = \"your-zone-id-here\"/CF_ZONE_ID = \"$ZONE_ID\"/" wrangler.toml
  sed -i "s/CF_ACCOUNT_ID = \"your-account-id-here\"/CF_ACCOUNT_ID = \"$ACCOUNT_ID\"/" wrangler.toml
fi

echo "✅ 配置已更新！"
echo ""

echo "📋 当前配置："
grep "CF_ZONE_ID" wrangler.toml
grep "CF_ACCOUNT_ID" wrangler.toml
echo ""

echo "✅ 配置完成！接下来："
echo "1. 运行: pnpm d1:init  (初始化数据库)"
echo "2. 运行: pnpm secret:put  (设置 API Token)"
echo "3. 运行: pnpm dev  (启动本地开发)"
