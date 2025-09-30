<p align="center">
  <img alt="UPage logo" src="./public/logo.png" style="width: 240px; height: auto;" />
</p>
<h3 align="center">基于大模型的可视化网页构建平台</h3>

<p align="center">
<a href="https://github.com/halo-dev/upage/releases"><img alt="GitHub release" src="https://img.shields.io/github/release/halo-dev/upage.svg?style=flat-square&include_prereleases" /></a>
<a href="https://github.com/halo-dev/upage/commits"><img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/halo-dev/upage.svg?style=flat-square" /></a>
<a href="https://github.com/halo-dev/upage/actions"><img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/halo-dev/upage/halo.yaml?branch=main&style=flat-square" /></a>
<a href="https://halo-dev.github.io/upage/"><img alt="Documentation" src="https://img.shields.io/badge/docs-latest-blue?style=flat-square" /></a>
</p>

------------------------------

UPage 是一款基于大语言模型的可视化网页构建平台，支持接入主流大模型，只需通过自然语言描述需求，即可快速生成个性化、高颜值的网页，让创作更高效、更智能。

- **可视化编辑，所见即所得**：简洁直观的可视化编辑器，支持实时预览，轻松调整布局与样式；
- **多页面一键生成**：支持同时生成多个关联页面，快速搭建完整网站结构；
- **标准代码自由导出**：自动生成规范的 HTML/CSS/JS 代码，便于集成至现有项目或二次开发；
- **响应式设计，全端适配**：自动适配桌面、平板、移动端等多种设备，确保跨平台完美呈现。

## 快速开始

准备一台 Linux 服务器，安装好 Docker 后，执行以下一键安装脚本：

```bash
docker run -d \
  --name upage \
  --restart unless-stopped \
  -p 3000:3000 \
  -e LLM_PROVIDER=OpenAI \
  -e PROVIDER_BASE_URL=your-provider-base-url \
  -e PROVIDER_API_KEY=your-openai-api-key \
  -e LLM_DEFAULT_MODEL=your-default-model \
  -e LLM_MINOR_MODEL=your-minor-model \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  -v ./storage:/app/storage \
  halohub/upage:latest
```

参数说明如下：
- `-e LLM_PROVIDER=OpenAI`：设置默认的 LLM 提供商为 OpenAI，同时兼容支持 OpenAI 规范的 API 接口。
- `-e PROVIDER_BASE_URL=your-provider-base-url`：设置 LLM 提供商的 API 基础 URL，部分提供商需要设置此项，例如 Ollama、LMStudio、OpenAI 提供商可选此项。例如 `https://api.openai.com/v1`
- `-e PROVIDER_API_KEY=your-openai-api-key`：设置 LLM 提供商的 API 密钥，大部分提供商需要设置此项。
- `-e LLM_DEFAULT_MODEL=your-default-model`：设置默认的 LLM 模型，用于构建页面。
- `-e LLM_MINOR_MODEL=your-minor-model`：设置次要的 LLM 模型，用于执行其他任务。
- `-v ./data:/app/data`：挂载数据目录
- `-v ./logs:/app/logs`：挂载日志目录
- `-v ./storage:/app/storage`：挂载存储目录

访问 `http://localhost:3000` 即可访问 UPage 的界面。

你也可以通过 [1Panel 应用商店](https://1panel.cn/) 来安装部署 UPage。

详细使用指南请参考：[UPage 在线文档](https://docs.upage.ai/quick-start)

## UI 展示

|  |  |
| --- | --- |
| ![](./img/preview-4.png) | ![](./img/preview-1.png) |
| ![](./img/preview-2.png) | ![](./img/preview-3.png) |

## 致谢

UPage 基于 [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) 的代码结构构建，特此致谢该项目带来的启发与贡献。

## 飞致云旗下的其他明星项目

- [Halo](https://github.com/halo-dev/halo) - 强大易用的开源建站工具
- [JumpServer](https://github.com/jumpserver/jumpserver) - 广受欢迎的开源堡垒机
- [DataEase](https://github.com/dataease/dataease) - 人人可用的开源 BI 工具
- [MaxKB](https://github.com/maxkb/maxkb) - 强大易用的企业级智能体平台
- [1Panel](https://github.com/1Panel-dev/1Panel) - 现代化、开源的 Linux 服务器运维管理面板
- [Cordys CRM](https://github.com/cordys/cordys-crm) - 新一代的开源 AI CRM 系统
- [MeterSphere](https://github.com/metersphere/metersphere) - 新一代的开源持续测试工具

## License

本仓库遵循 [FIT2CLOUD Open Source License](LICENSE) 开源协议，该许可证本质上是 GPLv3，但有一些额外的限制。

你可以基于 UPage 的源代码进行二次开发，但是需要遵守以下规定：

- 不能替换和修改 UPage 的 Logo 和版权信息；
- 二次开发后的衍生作品必须遵守 GPL V3 的开源义务。

如需商业授权，请联系：`support@fit2cloud.com`。
