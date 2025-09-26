<h1 align="center">UPage</h1>
<h3 align="center">基于大模型的可视化网页构建平台</h3>

<p align="center">
<a href="https://github.com/halo-dev/upage/releases"><img alt="GitHub release" src="https://img.shields.io/github/release/halo-dev/upage.svg?style=flat-square&include_prereleases" /></a>
<a href="https://github.com/halo-dev/upage/commits"><img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/halo-dev/upage.svg?style=flat-square" /></a>
<a href="https://github.com/halo-dev/upage/actions"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/halo-dev/upage/halo.yaml?branch=main&style=flat-square" /></a>
<a href="https://halo-dev.github.io/upage/"><img alt="Documentation" src="https://img.shields.io/badge/docs-latest-blue?style=flat-square" /></a>
</p>

------------------------------

UPage 是一款基于大模型的可视化网页构建平台，支持多种 AI 提供商集成，使用自然语言快速实现定制化网页。

------------------------------

特别感谢 [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) 项目，UPage 的实现基于该项目的代码结构。

------------------------------

## 快速开始

UPage 提供基于 Docker 的部署方案，可以使用以下脚本进行快速部署：

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
  halohub/upage:latest
```

其中参数说明如下：
- `-e LLM_DEFAULT_PROVIDER=OpenAILike`：设置默认的 LLM 提供商为 OpenAILike，即兼容 OpenAI 的 API 接口。
- `-e OPENAI_LIKE_API_BASE_URL=your-openai-like-api-base-url`：设置 OpenAILike 的 API 基础 URL。
- `-e OPENAI_LIKE_API_KEY=your-openai-like-api-key`：设置 OpenAILike 的 API 密钥。
- `-e LLM_DEFAULT_MODEL=your-default-model`：设置默认的 LLM 模型，用于构建页面。
- `-e LLM_MINOR_MODEL=your-minor-model`：设置次要的 LLM 模型，用于执行其他任务。
- `-v ./data:/app/data`：挂载数据目录
- `-v ./logs:/app/logs`：挂载日志目录
- `-v ./storage:/app/storage`：挂载存储目录

访问 `http://localhost:3000` 即可访问 UPage 的界面。
