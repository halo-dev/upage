# UPage 文档

这是 UPage 的官方文档网站，基于 [Docusaurus 3](https://docusaurus.io/) 构建。

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动本地开发服务器
pnpm start
```

此命令会启动本地开发服务器并打开浏览器窗口。大多数更改都会实时反映，无需重新启动服务器。

## 构建

```bash
# 构建静态网站
pnpm run build
```

此命令会在 `build` 目录中生成静态内容，可以使用任何静态内容托管服务进行部署。

## 部署

使用 GitHub Actions 自动部署到 GitHub Pages。每当 `docs` 目录中的文件发生变更并推送到 `main` 分支时，会自动触发部署流程。

## 目录结构

```
docs/
├── content/                 # 文档 Markdown 文件
│   ├── index.md          # 首页
│   ├── quick-start.md    # 快速开始
│   ├── deployment/       # 部署指南
│   ├── user-guide/       # 用户指南
│   └── ...
├── src/                  # 源代码
│   ├── css/              # CSS 文件
│   └── pages/            # 自定义页面
├── static/               # 静态文件
│   └── img/              # 图片
├── docusaurus.config.js  # Docusaurus 配置
├── sidebars.js           # 侧边栏配置
└── package.json          # 项目依赖
```

## 添加新文档

1. 在 `docs` 目录中创建新的 Markdown 文件
2. 添加前置元数据：

```md
---
id: document-id
title: 文档标题
---

# 文档内容
```

3. 更新 `sidebars.js` 文件，将新文档添加到侧边栏中
