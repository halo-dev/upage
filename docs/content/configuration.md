---
id: configuration
title: 配置参考
---

# 配置参考

本文档提供了 UPage 的完整配置参考，包括基础配置、AI 提供商配置、认证配置，帮助您根据自己的需求定制和优化 UPage。

UPage 使用环境变量进行配置。您可以通过以下方式设置环境变量：

- 在 Docker 运行命令中使用 `-e` 参数
- 在 Docker Compose 文件中使用 `environment` 部分
- 在源码部署中创建 `.env` 文件

## 基础配置

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `PORT` | 服务监听端口 | `3000` | 否 |
| `NODE_ENV` | Node.js 环境 | `production` | 否 |
| `OPERATING_ENV` | 运行环境 | `production` | 否 |
| `LOG_LEVEL` | 日志级别（debug, info, warn, error） | `info` | 否 |
| `USAGE_LOG_FILE` | 是否开启文件日志 | `true` | 否 |
| `MAX_UPLOAD_SIZE_MB` | 附件上传的最大大小 (MB) | `5` | 否 |
| `STORAGE_DIR` | 资源文件存储位置 | `/app/storage` | 否 |

## AI 提供商配置

### AI 基础配置

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_DEFAULT_PROVIDER` | LLM 提供商，根据需要配置一个 | - | 是 |
| `LLM_DEFAULT_MODEL` | 生成页面所使用的模型 | - | 是 |
| `LLM_MINOR_MODEL` | 辅助页面生成所使用的模型 | - | 是 |
| `LLM_ENABLED_PROVIDERS` | 启用的 LLM 提供商列表（逗号分隔） | 所有支持的提供商 | 否 |

### DeepSeek

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_DEFAULT_PROVIDER` | DeepSeek 提供商名称 | Deepseek | 是 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | - | 是（如果使用 DeepSeek） |

### OpenAI

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_DEFAULT_PROVIDER` | OpenAI 提供商名称 | OpenAI | 是 |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - | 是（如果使用 OpenAI） |

### Anthropic Claude

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_DEFAULT_PROVIDER` | Anthropic 提供商 | Anthropic | 是 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | - | 是（如果使用 Anthropic） |
| `ANTHROPIC_API_BASE_URL` | Anthropic API 基础 URL | `https://api.anthropic.com` | 否 |

### 兼容 OpenAI 接口的服务

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `OPENAI_LIKE_API_KEY` | API 密钥 | - | 是（如果使用 OpenAILike） |
| `OPENAI_LIKE_API_BASE_URL` | API 基础 URL | - | 是（如果使用 OpenAILike） |
| `OPENAI_LIKE_ORGANIZATION_ID` | 组织 ID | - | 否 |

### Ollama

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `OLLAMA_API_BASE_URL` | Ollama API 基础 URL | `http://localhost:11434` | 是（如果使用 Ollama） |

### Groq

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Groq API 密钥 | - | 是（如果使用 Groq） |

### HuggingFace

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `HuggingFace_API_KEY` | HuggingFace API 密钥 | - | 是（如果使用 HuggingFace） |

### OpenRouter

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `OPEN_ROUTER_API_KEY` | OpenRouter API 密钥 | - | 是（如果使用 OpenRouter） |

### Google Gemini

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `GOOGLE_API_KEY` | Google API 密钥 | - | 是（如果使用 Google） |
| `GOOGLE_API_BASE_URL` | Google API 基础 URL | `https://generativelanguage.googleapis.com` | 否 |

## 认证配置

### Logto 认证

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LOGTO_ENABLE` | 是否启用 Logto 认证 | `false` | 否 |
| `LOGTO_ENDPOINT` | Logto 服务的 URL | - | 是（如果使用 Logto） |
| `LOGTO_APP_ID` | Logto 应用程序 ID | - | 是（如果使用 Logto） |
| `LOGTO_APP_SECRET` | Logto 应用程序密钥 | - | 是（如果使用 Logto） |
| `LOGTO_COOKIE_SECRET` | 用于加密 cookie 的密钥 | - | 是（如果使用 Logto） |
| `LOGTO_BASE_URL` | UPage 地址 | - | 是（如果使用 Logto） |

:::info
Logto 集成请参阅 [Logto 认证集成](./deployment/logto)文档。
:::

## 配置示例

### 基本配置示例

```bash
# 基础配置
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# AI 提供商配置
LLM_DEFAULT_PROVIDER=OpenAI
OPENAI_API_KEY=your-openai-api-key
LLM_DEFAULT_MODEL=gpt-4-turbo
LLM_MINOR_MODEL=gpt-3.5-turbo
```

### 完整的 Docker Compose 配置示例

```yaml
version: "3.9"
services:
  upage:
    image: ghcr.io/halo-dev/upage:latest
    container_name: upage
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # 基础配置
      - PORT=3000
      - NODE_ENV=production
      - OPERATING_ENV=production
      - LOG_LEVEL=info
      - USAGE_LOG_FILE=true
      - MAX_UPLOAD_SIZE_MB=10
      - STORAGE_DIR=/app/storage
      
      # AI 提供商配置
      - LLM_DEFAULT_PROVIDER=OpenAI
      - OPENAI_API_KEY=your-openai-api-key
      - LLM_DEFAULT_MODEL=gpt-4-turbo
      - LLM_MINOR_MODEL=gpt-3.5-turbo
      
      # Logto 认证配置
      - LOGTO_ENABLE=true
      - LOGTO_ENDPOINT=http://logto:3001
      - LOGTO_APP_ID=your-app-id
      - LOGTO_APP_SECRET=your-app-secret
      - LOGTO_COOKIE_SECRET=your-cookie-secret
      - LOGTO_BASE_URL=https://api.upage.io
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./storage:/app/storage
```

## 多环境配置

### 开发环境

```bash
NODE_ENV=development
OPERATING_ENV=development
LOG_LEVEL=debug
PORT=3000
```

### 测试环境

```bash
NODE_ENV=production
OPERATING_ENV=testing
LOG_LEVEL=info
PORT=3000
```

### 生产环境

```bash
NODE_ENV=production
OPERATING_ENV=production
LOG_LEVEL=warn
PORT=3000
```
