---
id: contributing
title: 贡献指南
---

# 贡献指南

感谢您对 UPage 项目的关注！我们非常欢迎各种形式的贡献，无论是功能开发、bug 修复、文档改进还是使用反馈。本指南将帮助您了解如何参与 UPage 的开发和贡献。

## 行为准则

参与 UPage 项目的所有贡献者都应遵循以下行为准则：

- 尊重所有参与者，无论其背景、经验或观点
- 接受建设性的批评和反馈
- 专注于对社区最有利的事情
- 展现同理心和善意

## 贡献方式

您可以通过多种方式为 UPage 做出贡献：

### 报告问题

如果您发现了 bug 或有功能建议，请在 [GitHub Issues](https://github.com/halo-dev/upage/issues) 中提出。提交问题时，请尽可能提供以下信息：

- 清晰的问题描述
- 复现步骤
- 预期行为与实际行为
- 截图（如适用）
- 环境信息（浏览器、操作系统、UPage 版本等）

### 提交代码

如果您想直接贡献代码，请遵循以下步骤：

1. Fork 项目仓库
2. 创建您的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 改进文档

文档对于任何项目都至关重要。您可以通过以下方式改进 UPage 的文档：

- 修复文档中的错误或不准确之处
- 添加缺失的信息或示例
- 改进文档的结构和可读性
- 翻译文档到其他语言

### 分享和推广

您也可以通过以下方式支持 UPage：

- 在社交媒体上分享项目
- 撰写关于 UPage 的博客文章或教程
- 在相关论坛和社区中推荐 UPage
- 为项目加星标（Star）

## 开发环境设置

### 前置条件

开始开发 UPage 前，请确保您的系统满足以下要求：

- Node.js 18.18.0 或更高版本
- pnpm 9.4.0 或更高版本
- Git

### 克隆仓库

```bash
git clone https://github.com/halo-dev/upage.git
cd upage
```

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

此命令会启动开发服务器，您可以通过 `http://localhost:3000` 访问。

### 构建项目

```bash
pnpm build
```

### 运行测试

```bash
pnpm test
```

## 代码规范

### JavaScript/TypeScript 规范

UPage 使用 [Biome](https://biomejs.dev/) 进行代码格式化和 linting。在提交代码前，请确保您的代码符合项目的代码规范：

```bash
pnpm check
```

您也可以使用以下命令自动修复格式问题：

```bash
pnpm check --write
```

### Git 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范来格式化 Git 提交信息。提交信息应遵循以下格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

常用的 `type` 包括：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码风格更改（不影响代码功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 添加或修改测试
- `chore`: 构建过程或辅助工具的变动

例如：

```
feat(editor): 添加拖拽调整组件大小功能

添加了一个新的拖拽句柄，允许用户直接调整组件的大小。
同时优化了调整过程中的性能。

Closes #123
```

## 分支策略

- `main`: 主分支，包含稳定的代码
- `develop`: 开发分支，包含最新的开发代码
- `feature/*`: 功能分支，用于开发新功能
- `fix/*`: 修复分支，用于修复 bug
- `release/*`: 发布分支，用于准备新版本发布

请基于 `develop` 分支创建您的功能或修复分支，并在完成后向 `develop` 分支提交 Pull Request。

## Pull Request 流程

1. 确保您的代码符合项目的代码规范
2. 更新相关文档（如适用）
3. 添加或更新测试（如适用）
4. 确保所有测试通过
5. 提交 Pull Request 到 `develop` 分支
6. 在 PR 描述中详细说明您的更改

## 版本发布流程

UPage 遵循 [语义化版本控制](https://semver.org/) 规范。版本号格式为 `X.Y.Z`：

- `X`: 主版本号，当进行不兼容的 API 更改时递增
- `Y`: 次版本号，当添加向后兼容的功能时递增
- `Z`: 修订号，当进行向后兼容的 bug 修复时递增

## 文档贡献

UPage 的文档使用 [Docusaurus](https://docusaurus.io/) 构建。如果您想贡献文档，请遵循以下步骤：

1. 在 `docs` 目录中找到相关的 Markdown 文件
2. 进行必要的更改
3. 在本地预览更改：`pnpm docs:start`
4. 提交 Pull Request

## 社区

加入 UPage 社区，与其他贡献者交流：

- [GitHub Discussions](https://github.com/halo-dev/upage/discussions)
- [GitHub Issues](https://github.com/halo-dev/upage/issues)

## 许可证

UPage 采用 [MIT 许可证](https://github.com/halo-dev/upage/blob/main/LICENSE)。通过贡献代码，您同意您的贡献将在相同的许可证下发布。
