---
id: quick-start
title: 快速开始
---

# 快速开始

本指南将帮助您快速部署和启动 UPage，让您在几分钟内体验基于大模型的网页构建平台。

:::caution 注意
此快速启动方式仅适用于体验和测试目的，如需在生产环境中完整部署，请参考[Docker 部署指南](deployment/docker)。
:::

## 前置条件

在开始之前，请确保您的系统满足以下要求：

- Docker 已安装（推荐 Docker 20.10.0 或更高版本）
- 至少 2GB 可用内存
- 至少 2GB 可用磁盘空间
- 互联网连接（用于拉取 Docker 镜像和访问大模型 API）

## 使用 Docker 快速部署

UPage 提供了官方 Docker 镜像，可以通过以下命令快速启动：

```bash
docker run -d \
  --name upage \
  --restart unless-stopped \
  -p 3000:3000 \
  -e LLM_DEFAULT_PROVIDER=OpenAILike \
  -e OPENAI_LIKE_API_BASE_URL=your-openai-like-api-base-url \
  -e OPENAI_LIKE_API_KEY=your-openai-like-api-key \
  -e LLM_DEFAULT_MODEL=your-default-model \
  -e LLM_MINOR_MODEL=your-minor-model \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  -v ./storage:/app/storage \
  halo-dev/upage:latest
```

### 参数说明

- `-e LLM_DEFAULT_PROVIDER=OpenAILike`：设置默认的 LLM 提供商
- `-e OPENAI_LIKE_API_BASE_URL=your-openai-like-api-base-url`：设置 API 基础 URL
- `-e OPENAI_LIKE_API_KEY=your-openai-like-api-key`：设置 API 密钥
- `-e LLM_DEFAULT_MODEL=your-default-model`：设置用于页面生成的默认 AI 模型
- `-e LLM_MINOR_MODEL=your-minor-model`：设置用于辅助任务的 AI 模型
- `-v ./data:/app/data`：挂载数据目录，用于存储数据库文件
- `-v ./logs:/app/logs`：挂载日志目录
- `-v ./storage:/app/storage`：挂载存储目录，用于存储上传的文件


## 访问 UPage

服务启动后，您可以通过浏览器访问：

```
http://localhost:3000
```

## 配置 AI 提供商

UPage 支持多种 AI 提供商，您需要至少配置一个 AI 提供商才能使用页面生成功能。以下是常见的 AI 提供商配置示例：

### DeepSeek

```bash
-e LLM_DEFAULT_PROVIDER=Deepseek \
-e DEEPSEEK_API_KEY=your-deepseek-api-key \
-e LLM_DEFAULT_MODEL=deepseek-chat \
-e LLM_MINOR_MODEL=deepseek-reasoner
```

### 兼容 OpenAI 接口的服务

```bash
-e LLM_DEFAULT_PROVIDER=OpenAILike \
-e OPENAI_LIKE_API_BASE_URL=https://your-api-base-url \
-e OPENAI_LIKE_API_KEY=your-api-key \
-e LLM_DEFAULT_MODEL=your-model-name \
-e LLM_MINOR_MODEL=your-minor-model-name
```

### OpenAI

```bash
-e LLM_DEFAULT_PROVIDER=OpenAI \
-e OPENAI_API_KEY=your-openai-api-key \
-e LLM_DEFAULT_MODEL=gpt-4-turbo \
-e LLM_MINOR_MODEL=gpt-3.5-turbo
```

### Anthropic Claude

```bash
-e LLM_DEFAULT_PROVIDER=Anthropic \
-e ANTHROPIC_API_KEY=your-anthropic-api-key \
-e LLM_DEFAULT_MODEL=claude-3-opus-20240229 \
-e LLM_MINOR_MODEL=claude-3-haiku-20240307
```

### Ollama

```bash
-e LLM_DEFAULT_PROVIDER=Ollama \
-e OLLAMA_API_BASE_URL=http://127.0.0.1:11434 \
-e LLM_DEFAULT_MODEL=llama3 \
-e LLM_MINOR_MODEL=llama3
```

:::info
详细的 AI 提供商配置请阅读[配置参考](configuration#ai-提供商配置)。
:::

## 下一步

- 探索[Docker 部署指南](deployment/docker)了解生产环境部署方案，包括使用 Docker Compose、数据备份、HTTPS 配置等
- 查看[配置参考](configuration)了解所有可用的配置选项
- 阅读[用户指南](user-guide/basics)学习如何使用 UPage 创建网页
