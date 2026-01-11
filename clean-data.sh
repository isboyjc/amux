#!/bin/bash

# Amux Desktop - 清理用户数据脚本
# 用于删除数据库、缓存和日志文件，以便重新测试

echo "🧹 开始清理 Amux Desktop 用户数据..."
echo ""

# 定义可能的用户数据路径
APP_DATA_PATHS=(
  "$HOME/Library/Application Support/@amux/desktop"
  "$HOME/Library/Application Support/amux-desktop"
  "$HOME/Library/Application Support/Amux Desktop"
)

# 要删除的文件列表
FILES_TO_DELETE=(
  "amux.db"
  "amux.db-wal"
  "amux.db-shm"
  "master.key"
  "presets-cache.json"
  "logs"
)

FOUND=false

# 遍历所有可能的路径
for APP_DATA in "${APP_DATA_PATHS[@]}"; do
  if [ -d "$APP_DATA" ]; then
    FOUND=true
    echo "📂 找到用户数据目录: $APP_DATA"
    echo ""
    
    # 列出将要删除的文件
    echo "🗑️  将要删除以下文件："
    for FILE in "${FILES_TO_DELETE[@]}"; do
      FILE_PATH="$APP_DATA/$FILE"
      if [ -e "$FILE_PATH" ]; then
        if [ -d "$FILE_PATH" ]; then
          echo "   - $FILE/ (目录)"
        else
          SIZE=$(du -h "$FILE_PATH" | cut -f1)
          echo "   - $FILE ($SIZE)"
        fi
      fi
    done
    echo ""
    
    # 删除文件
    for FILE in "${FILES_TO_DELETE[@]}"; do
      FILE_PATH="$APP_DATA/$FILE"
      if [ -e "$FILE_PATH" ]; then
        rm -rf "$FILE_PATH"
        echo "✅ 已删除: $FILE"
      fi
    done
    
    echo ""
  fi
done

if [ "$FOUND" = false ]; then
  echo "⚠️  未找到用户数据目录，可能是应用尚未运行过"
  echo ""
  echo "可能的路径："
  for APP_DATA in "${APP_DATA_PATHS[@]}"; do
    echo "  - $APP_DATA"
  done
else
  echo "✨ 清理完成！"
  echo ""
  echo "📝 已删除："
  echo "  - 数据库文件 (amux.db)"
  echo "  - 加密密钥 (master.key)"
  echo "  - 预设缓存 (presets-cache.json)"
  echo "  - 日志文件 (logs/)"
  echo ""
  echo "💡 现在可以重新启动应用进行测试"
fi

echo ""
