#!/bin/bash
set -e

echo "🚀 启动 UPage 应用..."

print_db_info() {
  if [ -z "$DATABASE_URL" ]; then
    echo "⚠️ 警告：DATABASE_URL 环境变量未设置！"
    return
  fi

  DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
  DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
  DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
  DB_SCHEMA=$(echo $DATABASE_URL | sed -n 's/.*schema=\([^&]*\).*/\1/p')

  echo "📊 数据库连接信息："
  echo "   - 用户: $DB_USER"
  echo "   - 主机: $DB_HOST"
  echo "   - 端口: $DB_PORT"
  echo "   - 数据库: $DB_NAME"
  echo "   - Schema: $DB_SCHEMA"
}

echo "🖥️ 系统环境信息："
echo "   - NODE_ENV: $NODE_ENV"
echo "   - 当前用户: $(whoami)"
echo "   - 工作目录: $(pwd)"

print_db_info

echo "⏳ 等待数据库连接..."
MAX_RETRIES=5
RETRY_COUNT=0

ERROR_LOG=$(mktemp)

until pnpm prisma db push --accept-data-loss 2>$ERROR_LOG || pnpm prisma migrate deploy 2>$ERROR_LOG; do
  RETRY_COUNT=$((RETRY_COUNT + 1))

  echo "❌ 数据库连接尝试 $RETRY_COUNT 失败，错误信息："
  cat $ERROR_LOG

  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ 数据库连接失败！已达到最大重试次数。"
    echo "🔍 最后一次错误详情："
    cat $ERROR_LOG
    echo "🔍 尝试使用 pg_isready 检查数据库连接："
    if command -v pg_isready >/dev/null 2>&1; then
      pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER && echo "✅ 数据库可以连接" || echo "❌ 数据库无法连接"
    else
      echo "⚠️ pg_isready 命令不可用，无法进行连接测试"
    fi
    exit 1
  fi

  echo "⏳ 数据库尚未就绪，等待 5 秒后重试... (${RETRY_COUNT}/${MAX_RETRIES})"
  sleep 5
done

rm -f $ERROR_LOG

echo "✅ 数据库连接成功"

echo "🔍 检查数据库迁移状态..."

MIGRATE_ERROR_LOG=$(mktemp)

if pnpm prisma migrate deploy 2>$MIGRATE_ERROR_LOG | grep -q "P3005"; then
  echo "📊 检测到已存在的数据库结构，需要应用baseline..."

  echo "📑 获取所有迁移..."
  MIGRATION_DIRS=$(find prisma/migrations -maxdepth 1 -type d | grep -v "^prisma/migrations$" | sort)

  if [ -z "$MIGRATION_DIRS" ]; then
    echo "⚠️ 未找到迁移，跳过baseline处理"
  else
    echo "🔄 找到以下迁移："

    for MIGRATION_DIR in $MIGRATION_DIRS; do
      MIGRATION_NAME=$(basename "$MIGRATION_DIR")
      echo "   - $MIGRATION_NAME"

      echo "🔖 将迁移 $MIGRATION_NAME 标记为已应用..."
      RESOLVE_ERROR_LOG=$(mktemp)
      if ! pnpm prisma migrate resolve --applied "$MIGRATION_NAME" 2>$RESOLVE_ERROR_LOG; then
        echo "⚠️ 标记迁移 $MIGRATION_NAME 时出错："
        cat $RESOLVE_ERROR_LOG
      fi
      rm -f $RESOLVE_ERROR_LOG
    done

    echo "✅ Baseline应用成功"

    echo "🔄 检查并应用新的迁移..."
    DEPLOY_ERROR_LOG=$(mktemp)
    if ! pnpm prisma migrate deploy 2>$DEPLOY_ERROR_LOG; then
      echo "⚠️ 应用新迁移时出错："
      cat $DEPLOY_ERROR_LOG
    fi
    rm -f $DEPLOY_ERROR_LOG
  fi
else
  if [ -s "$MIGRATE_ERROR_LOG" ]; then
    echo "⚠️ 数据库迁移过程中出现警告或错误："
    cat $MIGRATE_ERROR_LOG
  else
    echo "🆕 数据库迁移已成功应用"
  fi
fi

rm -f $MIGRATE_ERROR_LOG

echo "✅ 数据库迁移完成"

echo "🔧 生成 Prisma Client..."
GENERATE_ERROR_LOG=$(mktemp)
if ! pnpm prisma generate 2>$GENERATE_ERROR_LOG; then
  echo "⚠️ 生成 Prisma Client 时出错："
  cat $GENERATE_ERROR_LOG
else
  echo "✅ Prisma Client 生成完成"
fi
rm -f $GENERATE_ERROR_LOG

echo "🎉 启动应用服务..."

# 执行传入的命令
echo "🚀 执行命令: $@"
exec "$@"
