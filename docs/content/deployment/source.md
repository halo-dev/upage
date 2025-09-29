---
id: source
title: 源码部署
---

# 源码部署

本文档详细介绍如何从源码构建和部署 UPage。如果您希望自定义 UPage 或者参与开发，这是最合适的部署方式。

## 前置条件

在开始之前，请确保您的系统满足以下要求：

- Node.js 18.18.0 或更高版本
- pnpm 9.4.0 或更高版本
- Git

## 下载并构建代码

### 克隆代码库

首先，克隆 UPage 的代码库：

```bash
git clone https://github.com/halo-dev/upage.git
cd upage
```

### 安装依赖

使用 pnpm 安装项目依赖：

```bash
pnpm install
```

### 配置环境变量

拷贝 `.env.example` 文件，创建 `.env` 文件：

```bash
cp .env.example .env
```

配置必要的环境变量：

```bash
# 基础配置
PORT=3000
NODE_ENV=production
OPERATING_ENV=production
LOG_LEVEL=info
USAGE_LOG_FILE=true
MAX_UPLOAD_SIZE_MB=5
STORAGE_DIR=./storage

# AI 提供商配置
LLM_PROVIDER=OpenAILike
PROVIDER_BASE_URL=your-openai-like-api-base-url
PROVIDER_API_KEY=your-openai-like-api-key
LLM_DEFAULT_MODEL=your-default-model
LLM_MINOR_MODEL=your-minor-model
```

您可以根据需要配置不同的 AI 提供商，详细配置请参考[配置参考](../configuration)。

### 生成 Prisma 客户端

```bash
pnpm setup
```

## 开发模式使用

如果您想在开发模式下运行 UPage，可以使用以下命令：

```bash
pnpm dev
```

开发服务器启动后，您可以通过浏览器访问：

```
http://localhost:5173
```

这将启动开发服务器，支持热重载，方便您进行开发和调试。

## 生产模式使用

构建 UPage 项目：

```bash
pnpm build
```

### 启动服务

启动 UPage 服务：

```bash
pnpm preview
```

服务启动后，您可以通过浏览器访问：

```
http://localhost:3000
```

## 使用 PM2 管理服务（可选）

在生产环境中，可以使用 PM2 来管理 Node.js 应用程序：

### 全局安装 PM2

```bash
npm install -g pm2
```

### 创建 PM2 配置文件

创建 `ecosystem.config.js` 文件：

```javascript
module.exports = {
  apps: [{
    name: 'upage',
    script: './server.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      OPERATING_ENV: 'production',
      PORT: 3000,
      LLM_PROVIDER: 'OpenAILike',
      PROVIDER_BASE_URL: 'your-openai-like-api-base-url',
      PROVIDER_API_KEY: 'your-openai-like-api-key',
      LLM_DEFAULT_MODEL: 'your-default-model',
      LLM_MINOR_MODEL: 'your-minor-model',
    }
  }]
};
```

### 启动服务

```bash
pm2 start ecosystem.config.js
```

### 查看日志

```bash
pm2 logs upage
```

### 监控服务

```bash
pm2 monit
```

## 升级 UPage

当有新版本发布时，您可以按照以下步骤升级 UPage：

```bash
# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 构建项目
pnpm build

# 开发环境使用
pnpm dev

# 生产环境使用
pnpm preview

# 或者如果使用 PM2
pm2 restart upage
```

## 故障排除

### 依赖安装失败

如果依赖安装失败，可以尝试清除 pnpm 缓存：

```bash
pnpm store prune
pnpm install
```

### 构建失败

如果构建失败，可以尝试清除构建缓存：

```bash
pnpm clean
pnpm build
```

### 数据库错误

如果遇到数据库相关错误，可以尝试重新初始化数据库

```bash
pnpm prisma migrate reset
```

:::danger
请注意，这将清空所有数据并重置数据库，切勿在生产环境中使用。
:::

### 日志查看

检查日志文件以获取更多错误信息：

```bash
cat logs/combined-*.log
cat logs/error-*.log
```

## 下一步

- 阅读[用户指南](../user-guide/basics)学习如何使用 UPage 创建网页
- 探索[配置参考](../configuration)了解所有可用的配置选项
- 探索[Logto 认证集成](./logto)了解如何集成 Logto 实现用户认证
