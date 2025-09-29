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

UPage 支持多种 AI 提供商，您需要配置一个 AI 提供商才能使用页面生成功能。

:::tip 配置参数颜色说明
为了帮助您区分不同提供商所需的配置参数，我们使用了不同的颜色标记：
- <span className="base-url-highlight">API 基础 URL</span>: 用蓝色标记，通常是服务的访问地址
- <span className="api-key-highlight">API 密钥</span>: 用红色标记，通常是敏感信息，需要从提供商处获取
:::

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | LLM 提供商，按照下述配置项配置一个 | - | 是 |
| <span className="base-url-highlight">`PROVIDER_BASE_URL`</span> | LLM 提供商的 API 基础 URL，部分提供商需要设置此项，例如 Ollama, LMStudio。 OpenAI 可选此项 | - | 否，部分提供商不需要设置此项 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | LLM 提供商的 API 密钥，大部分提供商需要设置此项 | - | 否，部分提供商不需要设置此项 |
| `LLM_DEFAULT_MODEL` | 生成页面所使用的模型 | - | 是 |
| `LLM_MINOR_MODEL` | 辅助页面生成所使用的模型 | - | 是 |

以下是常见的 AI 提供商配置：

### Amazon Bedrock

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Amazon Bedrock 提供商名称 | AmazonBedrock | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Amazon Bedrock 配置 | - | 是（如果使用 Amazon Bedrock） |

:::info
在 Amazon Bedrock 提供商中，`PROVIDER_API_KEY` 应为 JSON 格式。例如：
```json
{
  // Bedrock 可用的 AWS 区域
  "region": "us-east-1",
  // 你的 AWS 访问密钥 ID
  "accessKeyId": "your-access-key-id",
  // 你的 AWS 访问密钥令牌
  "secretAccessKey": "your-secret-access-key",
  // AWS 会话令牌（可选），如果使用 IAM 角色或临时凭据，则为临时会话令牌
  "sessionToken": "your-session-token"
}
```
前往 [Amazon Bedrock](https://console.aws.amazon.com/iam/home) 中获取配置。
:::

### Anthropic Claude

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Anthropic 提供商 | Anthropic | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Anthropic API 密钥 | - | 是（如果使用 Anthropic） |

:::info
前往 [Anthropic](https://console.anthropic.com/settings/keys) 获取 API 密钥。
:::

### Cohere

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Cohere 提供商名称 | Cohere | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Cohere API 密钥 | - | 是（如果使用 Cohere） |

:::info
前往 [Cohere](https://dashboard.cohere.com/api-keys) 获取 API 密钥。
:::

### DeepSeek

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | DeepSeek 提供商名称 | DeepSeek | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | DeepSeek API 密钥 | - | 是（如果使用 DeepSeek） |

:::info
前往 [DeepSeek](https://platform.deepseek.com/api_keys) 获取 API 密钥。
:::

### Github

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Github 提供商名称 | Github | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Github API 密钥 | - | 是（如果使用 Github） |

:::info
前往 [Github](https://github.com/settings/personal-access-tokens) 获取 API 密钥。
:::

### Google

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Google 提供商名称 | Google | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Google 生成式 AI API 密钥 | - | 是（如果使用 Google） |

:::info
前往 [Google](https://console.cloud.google.com/apis/credentials) 获取 API 密钥。
:::

### Groq

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Groq 提供商名称 | Groq | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Groq API 密钥 | - | 是（如果使用 Groq） |

:::info
前往 [Groq](https://console.groq.com/keys) 获取 API 密钥。
:::

### HuggingFace

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | HuggingFace 提供商名称 | HuggingFace | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | HuggingFace API 密钥 | - | 是（如果使用 HuggingFace） |

:::info
前往 [HuggingFace](https://huggingface.co/settings/tokens) 获取 API 密钥。
:::

### Hyperbolic

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Hyperbolic 提供商名称 | Hyperbolic | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Hyperbolic API 密钥 | - | 是（如果使用 Hyperbolic） |

:::info
前往 [Hyperbolic](https://hyperbolic.ai/dashboard/api-keys) 获取 API 密钥。
:::

### LMStudio

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | LMStudio 提供商名称 | LMStudio | 是 |
| <span className="base-url-highlight">`PROVIDER_BASE_URL`</span> | LMStudio API URL | `http://127.0.0.1:1234` | 是（如果使用 LMStudio） |

:::warning
由于可能存在的 IPV6 的问题，所以不要使用 http://localhost:1234 而应该使用类似于 http://127.0.0.1:1234 的地址
:::

### Mistral

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Mistral 提供商名称 | Mistral | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Mistral API 密钥 | - | 是（如果使用 Mistral） |

:::info
前往 [Mistral](https://console.mistral.ai/api-keys/) 获取 API 密钥。
:::

### Ollama

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Ollama 提供商名称 | Ollama | 是 |
| <span className="base-url-highlight">`PROVIDER_BASE_URL`</span> | Ollama API URL | `http://127.0.0.1:11434` | 是（如果使用 Ollama） |

:::warning
由于可能存在的 IPV6 的问题，所以不要使用 http://localhost:11434 而应该使用类似于 http://127.0.0.1:11434 的地址
:::

### OpenRouter

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | OpenRouter 提供商名称 | OpenRouter | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | OpenRouter API 密钥 | - | 是（如果使用 OpenRouter） |

:::info
前往 [OpenRouter](https://openrouter.ai/settings/keys) 获取 API 密钥。
:::

### OpenAI

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | OpenAI 提供商名称 | OpenAI | 是 |
| <span className="base-url-highlight">`PROVIDER_BASE_URL`</span> | API 基础 URL | - | 否（不填写时，使用 OpenAI 官方 API） |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | OpenAI API 密钥 | - | 是（如果使用 OpenAI） |

:::info
前往 [OpenAI](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key) 获取 API 密钥。
:::

### Perplexity

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Perplexity 提供商名称 | Perplexity | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Perplexity API 密钥 | - | 是（如果使用 Perplexity） |

:::info
前往 [Perplexity](https://www.perplexity.ai/settings/api) 获取 API 密钥。
:::

### Together

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | Together 提供商名称 | Together | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | Together API 密钥 | - | 是（如果使用 Together） |

:::info
前往 [Together](https://api.together.xyz/settings/api-keys) 获取 API 密钥。
:::

### xAI

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | xAI 提供商名称 | xAI | 是 |
| <span className="api-key-highlight">`PROVIDER_API_KEY`</span> | xAI API 密钥 | - | 是（如果使用 xAI） |

:::info
前往 [xAI](https://x.ai/api) 获取 API 密钥。
:::

## AI 工具配置

UPage 支持集成部分 AI 工具调用，用于为 UPage 提供服务，您可以根据需要配置。

### Serper（网络搜索工具）

UPage 集成了 [Serper](https://serper.dev) 的搜索服务，您可以通过配置 `SERPER_API_KEY` 来使用 Serper 的搜索服务。

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `SERPER_API_KEY` | Serper API 密钥 | - | 是（如果使用 Serper） |

:::info
前往 [Serper](https://serper.dev/api-keys) 获取 API 密钥。
:::

### Weather（天气工具）

UPage 集成了 [Weather](https://weatherapi.com) 的天气服务，您可以通过配置 `WEATHER_API_KEY` 来使用 Weather 的天气服务。

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `WEATHER_API_KEY` | Weather API 密钥 | - | 是（如果使用 Weather） |

:::info
前往 [Weather](https://www.weatherapi.com/my/) 获取 API 密钥。
:::

## 认证配置

### Logto 认证

UPage 默认仅支持单一的匿名用户访问，您可以通过集成 Logto 后配置 `LOGTO_ENABLE` 来启用 Logto 认证，支持多用户登录。

| 环境变量 | 描述 | 默认值 | 必填 |
| --- | --- | --- | --- |
| `LOGTO_ENABLE` | 是否启用 Logto 认证 | `false` | 是 |
| `LOGTO_ENDPOINT` | Logto 服务的 URL | - | 是（如果使用 Logto） |
| `LOGTO_APP_ID` | Logto 应用程序 ID | - | 是（如果使用 Logto） |
| `LOGTO_APP_SECRET` | Logto 应用程序密钥 | - | 是（如果使用 Logto） |
| `LOGTO_COOKIE_SECRET` | 用于加密 cookie 的密钥 | - | 是（如果使用 Logto） |
| `LOGTO_BASE_URL` | UPage 地址 | - | 是（如果使用 Logto） |

:::info
Logto 集成请参阅 [Logto 认证集成](./deployment/logto)文档。
:::

## 配置示例

以下内容以使用 Docker Compose 作为示例，用于展示 UPage 的完整配置。

```yaml
version: "3.9"
services:
  upage:
    image: halo-dev/upage:latest
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
      
      # 使用 DeepSeek 提供商配置
      - LLM_PROVIDER=DeepSeek
      - PROVIDER_API_KEY=your-deepseek-api-key
      - LLM_DEFAULT_MODEL=deepseek-chat
      - LLM_MINOR_MODEL=deepseek-chat

      # AI 工具配置
      - SERPER_API_KEY=your-serper-api-key
      - WEATHER_API_KEY=your-weather-api-key
      
      # Logto 认证配置
      - LOGTO_ENABLE=true
      - LOGTO_ENDPOINT=http://logto:3001
      - LOGTO_APP_ID=your-app-id
      - LOGTO_APP_SECRET=your-app-secret
      - LOGTO_COOKIE_SECRET=your-cookie-secret
      - LOGTO_BASE_URL=http://localhost:3000
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./storage:/app/storage
```

如果你要切换使用其他 AI 提供商，则只需要修改 `LLM_PROVIDER` 和相应的 API 密钥、Model 即可，例如：

```yaml
version: "3.9"
services:
  upage:
    image: halo-dev/upage:latest
    container_name: upage
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # 使用 OpenAI 提供商配置，同时兼容 OpenAI 规范的 API 接口
      - LLM_PROVIDER=OpenAI
      # 此项可选，不填写时，使用 OpenAI 官方 API
      - PROVIDER_BASE_URL=your-openai-api-base-url
      - PROVIDER_API_KEY=your-openai-api-key
      - LLM_DEFAULT_MODEL=gpt-4.1
      - LLM_MINOR_MODEL=gpt-4.1-mini

      # ...其他配置
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./storage:/app/storage
``` 

## 下一步

- 阅读[用户指南](./user-guide/basics)学习如何使用 UPage 创建网页
- 阅读[贡献指南](./contributing)了解如何贡献 UPage
