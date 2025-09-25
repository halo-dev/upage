<h1 align="center">UPage</h1>
<h3 align="center">基于人工智能的可视化网页构建平台</h3>

<p align="center">
<a href="https://github.com/halo-dev/upage/releases"><img alt="GitHub release" src="https://img.shields.io/github/release/halo-dev/upage.svg?style=flat-square&include_prereleases" /></a>
<a href="https://github.com/halo-dev/upage/commits"><img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/halo-dev/upage.svg?style=flat-square" /></a>
<a href="https://github.com/halo-dev/upage/actions"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/halo-dev/upage/halo.yaml?branch=main&style=flat-square" /></a>
</p>

------------------------------

UPage 是一款基于人工智能的可视化网页构建平台，支持多种 AI 提供商集成，基于自然语言快速实现定制化网页。

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
  -e OPENAI_LIKE_API_KEY=your-openai-like-api-key \
  -e LLM_DEFAULT_MODEL=your-default-model \
  -e LLM_MINOR_MODEL=your-minor-model \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  -v ./storage:/app/storage \
  ghcr.io/halo-dev/upage
```
