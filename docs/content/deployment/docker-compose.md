---
id: docker-compose
title: Docker Compose 部署
---

# Docker Compose 部署

本文档详细介绍如何使用 Docker Compose 部署 UPage，这是一种更便捷的方式来管理 UPage 的部署。

## 前置条件
在开始之前，请确保您的系统满足以下要求：
- Docker 已安装（推荐 Docker 20.10.0 或更高版本）
- Docker Compose 已安装（推荐 Docker Compose 1.29.0 或更高版本）
- 至少 2GB 可用内存
- 至少 2GB 可用磁盘空间
- 互联网连接（用于拉取 Docker 镜像和访问大模型 API）

### 安装 Docker 和 Docker Compose

如果您的系统未安装 Docker，请参考[Docker 官方文档](https://docs.docker.com/engine/install/)进行安装。
如果您的系统未安装 Docker Compose，请参考[Docker Compose 官方文档](https://docs.docker.com/compose/install/)进行安装。

## 使用 Docker Compose 部署

### 准备目录

创建必要的目录用于持久化数据，例如 `~/upage`：

```bash
mkdir -p ~/upage/data
mkdir -p ~/upage/logs
mkdir -p ~/upage/storage
cd ~/upage
```
:::tip
UPage 所有数据与日志均存储在此目录中，请妥善保管。
:::

### 创建配置文件
创建 `docker-compose.yml` 文件：

```yaml
version: "3.9"
services:
  upage:
    image: upage-ai:production
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - LLM_PROVIDER=${LLM_PROVIDER}
      - PROVIDER_BASE_URL=${PROVIDER_BASE_URL}
      - PROVIDER_API_KEY=${PROVIDER_API_KEY}
      - LLM_DEFAULT_MODEL=${LLM_DEFAULT_MODEL}
      - LLM_MINOR_MODEL=${LLM_MINOR_MODEL}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./storage:/app/storage

volumes:
  upage-db:
```

### 启动服务

在 `docker-compose.yml` 文件所在目录执行：

```bash
docker-compose up -d
```

### 服务管理

使用 Docker Compose 管理服务的常用命令：

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看服务日志
docker-compose logs

# 查看服务状态
docker-compose ps
```

## 环境变量配置

UPage 支持通过环境变量进行配置。以下是一些比较重要的环境变量：

:::tip
完整的配置请参考[配置参考](../configuration)。
:::

### 基础配置

| 环境变量 | 描述 | 默认值 |
| --- | --- | --- |
| `PORT` | 服务监听端口 | `3000` |
| `NODE_ENV` | Node.js 环境 | `production` |
| `OPERATING_ENV` | 运行环境 | `production` |
| `LOG_LEVEL` | 日志级别 | `debug` |
| `USAGE_LOG_FILE` | 是否开启文件日志 | `true` |
| `MAX_UPLOAD_SIZE_MB` | 附件上传的最大大小 (MB) | `5` |
| `STORAGE_DIR` | 资源文件存储位置 | `/app/storage` |

### 模型提供商配置
根据您选择的 AI 提供商，您还需要配置相应的 API 密钥和基础 URL，例如：

| 环境变量 | 描述 | 必填 | 示例 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | 默认 LLM 提供商 | 是 | `OpenAILike` |
| `PROVIDER_BASE_URL` | OpenAI 兼容 API 基础 URL | 是 | `https://your-api-base-url` |
| `PROVIDER_API_KEY` | OpenAI 兼容 API 密钥 | 是 | `your-openai-like-api-key` |

### 大模型配置

| 环境变量 | 描述 | 必填 | 示例 |
| --- | --- | --- | --- |
| `LLM_DEFAULT_MODEL` | 生成页面所使用的主要模型 | 是 | `gpt-4-turbo` |
| `LLM_MINOR_MODEL` | 辅助页面生成所使用的次级模型 | 是 | `gpt-3.5-turbo` |

## 升级 UPage

当有新版本发布时，您可以按照以下步骤升级 UPage：

```bash
docker-compose pull
docker-compose down
docker-compose up -d
```

## 下一步

- 阅读[用户指南](../user-guide/basics)学习如何使用 UPage 创建网页
- 探索[配置参考](../configuration)了解所有可用的配置选项
- 探索[Logto 认证集成](./logto)了解如何集成 Logto 实现用户认证
