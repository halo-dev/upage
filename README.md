<h1 align="center">UPage</h1>
<h3 align="center">基于大模型的可视化网页构建平台</h3>

<p align="center">
<a href="https://github.com/halo-dev/upage/releases"><img alt="GitHub release" src="https://img.shields.io/github/release/halo-dev/upage.svg?style=flat-square&include_prereleases" /></a>
<a href="https://github.com/halo-dev/upage/commits"><img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/halo-dev/upage.svg?style=flat-square" /></a>
<a href="https://github.com/halo-dev/upage/actions"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/halo-dev/upage/halo.yaml?branch=main&style=flat-square" /></a>
<a href="https://halo-dev.github.io/upage/"><img alt="Documentation" src="https://img.shields.io/badge/docs-latest-blue?style=flat-square" /></a>
</p>

------------------------------

UPage 是一款基于大模型的可视化网页构建平台，支持多种 AI 提供商集成，基于自然语言快速实现定制化网页。UPage 优势在于：

- **基于 LLM 的页面生成**：通过自然语言描述生成完整的网页
- **多种 LLM 提供商支持**：兼容 OpenAI、Anthropic Claude、Google Gemini 等多种 LLM 模型
- **可视化编辑器**：简洁直观的可视化编辑器界面，实时预览
- **多页面生成**：支持同时生成多个页面
- **代码导出**：生成标准的 HTML/CSS/JS 代码，方便集成到现有项目
- **响应式设计**：自动适应不同屏幕尺寸
- **部署集成**：支持一键部署到常见托管平台


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
  -e LLM_PROVIDER=OpenAILike \
  -e PROVIDER_BASE_URL=your-provider-base-url \
  -e PROVIDER_API_KEY=your-openai-like-api-key \
  -e LLM_DEFAULT_MODEL=your-default-model \
  -e LLM_MINOR_MODEL=your-minor-model \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  -v ./storage:/app/storage \
  halohub/upage:latest
```

其中参数说明如下：
- `-e LLM_PROVIDER=OpenAILike`：设置默认的 LLM 提供商为 OpenAILike，即兼容 OpenAI 的 API 接口。
- `-e PROVIDER_BASE_URL=your-provider-base-url`：设置 LLM 提供商的 API 基础 URL，部分提供商需要设置此项，例如 OpenAILike, Ollama, LMStudio。
- `-e PROVIDER_API_KEY=your-openai-like-api-key`：设置 LLM 提供商的 API 密钥，大部分提供商需要设置此项。
- `-e LLM_DEFAULT_MODEL=your-default-model`：设置默认的 LLM 模型，用于构建页面。
- `-e LLM_MINOR_MODEL=your-minor-model`：设置次要的 LLM 模型，用于执行其他任务。
- `-v ./data:/app/data`：挂载数据目录
- `-v ./logs:/app/logs`：挂载日志目录
- `-v ./storage:/app/storage`：挂载存储目录

访问 `http://localhost:3000` 即可访问 UPage 的界面。

## 飞致云旗下的其他明星项目

- [Halo](https://github.com/halo-dev/halo) - 强大易用的开源建站工具
- [JumpServer](https://github.com/jumpserver/jumpserver) - 广受欢迎的开源堡垒机
- [DataEase](https://github.com/dataease/dataease) - 人人可用的开源 BI 工具
- [MaxKB](https://github.com/maxkb/maxkb) - 强大易用的企业级智能体平台
- [1Panel](https://github.com/1Panel-dev/1Panel) - 现代化、开源的 Linux 服务器运维管理面板
- [Cordys CRM](https://github.com/cordys/cordys-crm) - 新一代的开源 AI CRM 系统
- [MeterSphere](https://github.com/metersphere/metersphere) - 新一代的开源持续测试工具

## 许可证

本仓库遵循 [FIT2CLOUD Open Source License](https://github.com/halo-dev/upage/blob/main/LICENSE.txt) 开源协议，该许可证本质上是 GPLv3，但有一些额外的限制。

你可以基于 UPage 的源代码进行二次开发，但是需要遵守以下规定：

不能替换和修改 UPage 的 Logo 和版权信息；
二次开发后的衍生作品必须遵守 GPL V3 的开源义务。
如需商业授权，请联系 support@fit2cloud.com 。
