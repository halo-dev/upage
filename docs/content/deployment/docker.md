---
id: docker
title: Docker 部署
---

# Docker 部署

本文档详细介绍如何使用 Docker 部署 UPage。

## 前置条件
在开始之前，请确保您的系统满足以下要求：
- Docker 已安装（推荐 Docker 20.10.0 或更高版本）
- 至少 2GB 可用内存
- 至少 2GB 可用磁盘空间
- 互联网连接（用于拉取 Docker 镜像和访问大模型 API）

### 安装 Docker

如果您的系统未安装 Docker，请参考[Docker 官方文档](https://docs.docker.com/engine/install/)进行安装。

## 使用 Docker 部署

### 拉取镜像

首先，拉取 UPage 的最新 Docker 镜像：

```bash
docker pull halohub/upage:latest
```

您也可以使用特定版本的镜像，例如：

```bash
docker pull halohub/upage:1.0.0
```

### 准备目录

创建必要的目录用于持久化数据，例如 `~/upage`：

```bash
mkdir -p ~/upage/data
mkdir -p ~/upage/logs
mkdir -p ~/upage/storage
```
:::tip
UPage 所有数据与日志均存储在此目录中，请妥善保管。
:::

### 启动容器

使用以下命令启动 UPage 容器：

```bash
docker run -d \
  --name upage \
  --restart unless-stopped \
  -p 3000:3000 \
  -e LLM_PROVIDER=OpenAI \
  -e PROVIDER_BASE_URL=your-openai-api-base-url \
  -e PROVIDER_API_KEY=your-openai-api-key \
  -e LLM_DEFAULT_MODEL=your-default-model \
  -e LLM_MINOR_MODEL=your-minor-model \
  -e LLM_VISION_PROVIDER=your-vision-provider \
  -e LLM_VISION_MODEL=your-vision-model \
  -e VISION_PROVIDER_BASE_URL=your-vision-provider-base-url \
  -e VISION_PROVIDER_API_KEY=your-vision-provider-api-key \
  -v ~/upage/data:/app/data \
  -v ~/upage/logs:/app/logs \
  -v ~/upage/storage:/app/storage \
  halohub/upage:latest
```

### 容器管理

常用的容器管理命令：

```bash
# 停止容器
docker stop upage

# 启动容器
docker start upage

# 重启容器
docker restart upage

# 查看容器日志
docker logs upage

# 查看容器状态
docker ps -a | grep upage
```

## 环境变量配置

UPage 支持通过环境变量进行配置。以下是一些比较重要的环境变量，均可以使用 `-e` 参数在启动容器时设置：

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
| `LLM_PROVIDER` | 默认 LLM 提供商 | 是 | `OpenAI` |
| `PROVIDER_BASE_URL` | OpenAI 或者其他兼容 OpenAI 规范的 API 基础 URL | 否 | `https://your-api-base-url` |
| `PROVIDER_API_KEY` | OpenAI 或者其他兼容 OpenAI 规范的 API 密钥 | 是 | `your-openai-api-key` |

### 大模型配置

| 环境变量 | 描述 | 必填 | 示例 |
| --- | --- | --- | --- |
| `LLM_DEFAULT_MODEL` | 生成页面所使用的主要模型 | 是 | `gpt-4-turbo` |
| `LLM_MINOR_MODEL` | 辅助页面生成所使用的次级模型 | 是 | `gpt-3.5-turbo` |
| `LLM_VISION_PROVIDER` | 可选的视觉模型提供商 | 否 | `OpenAI` |
| `LLM_VISION_MODEL` | 可选的视觉模型 | 否 | `gpt-4.1-mini` |
| `VISION_PROVIDER_BASE_URL` | 视觉模型的 API 基础 URL | 否 | `https://your-api-base-url` |
| `VISION_PROVIDER_API_KEY` | 视觉模型的 API 密钥 | 否 | `your-vision-api-key` |

:::tip
如果默认模型本身支持读图，可以不配置视觉模型。只有在默认模型是纯文本模型、但您仍希望根据上传图片生成页面时，才建议配置 `LLM_VISION_PROVIDER` 和 `LLM_VISION_MODEL`。
:::

:::caution
请务必持久化 `/app/storage`。UPage 会在首次收到参考图片时将其保存到存储目录，并在后续多轮对话中复用文件引用，避免重复发送 base64 图片。如果该目录被清空，历史对话中的图片参考可能无法再次读取。
:::

## 升级 UPage

当有新版本发布时，您可以按照以下步骤升级 UPage：

```bash
# 拉取最新镜像
docker pull halohub/upage:latest

# 停止并删除旧容器
docker stop upage
docker rm upage

# 使用新镜像启动容器（使用与之前相同的环境变量和挂载）
docker run -d \
  --name upage \
  --restart unless-stopped \
  -p 3000:3000 \
  -e LLM_PROVIDER=OpenAI \
  -e PROVIDER_BASE_URL=your-openai-api-base-url \
  -e PROVIDER_API_KEY=your-openai-api-key \
  -e LLM_DEFAULT_MODEL=your-default-model \
  -e LLM_MINOR_MODEL=your-minor-model \
  -e LLM_VISION_PROVIDER=your-vision-provider \
  -e LLM_VISION_MODEL=your-vision-model \
  -e VISION_PROVIDER_BASE_URL=your-vision-provider-base-url \
  -e VISION_PROVIDER_API_KEY=your-vision-provider-api-key \
  -v ~/upage/data:/app/data \
  -v ~/upage/logs:/app/logs \
  -v ~/upage/storage:/app/storage \
  halohub/upage:latest
```

## 下一步

- 阅读[用户指南](../user-guide/basics)学习如何使用 UPage 创建网页
- 探索[配置参考](../configuration)了解所有可用的配置选项
- 探索[Logto 认证集成](./logto)了解如何集成 Logto 实现用户认证

