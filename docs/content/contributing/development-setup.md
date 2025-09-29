---
id: development-setup
title: 开发环境设置
---

# 开发环境设置

本指南将帮助您设置 UPage 的本地开发环境，以便您可以开始贡献代码。

## 前置条件

开始开发 UPage 前，请确保您的系统满足以下要求：

- **Node.js**: 18.18.0 或更高版本
- **pnpm**: 9.4.0 或更高版本
- **Git**: 最新版本

### 安装 Node.js

您可以从 [Node.js 官网](https://nodejs.org/) 下载并安装 Node.js，或使用版本管理工具如 [nvm](https://github.com/nvm-sh/nvm)：

```bash
# 使用 nvm 安装 Node.js
nvm install 18.18.0
nvm use 18.18.0
```

### 安装 pnpm

安装 pnpm 的最简单方法是通过 npm：

```bash
npm install -g pnpm@9.4.0
```

或者按照 [pnpm 官方文档](https://pnpm.io/installation) 的说明进行安装。

## 克隆仓库

首先，[fork UPage 仓库](https://github.com/halo-dev/upage/fork)到您的 GitHub 账户，然后将其克隆到本地：

```bash
# 克隆您 fork 的仓库
git clone https://github.com/YOUR-USERNAME/upage.git

# 进入项目目录
cd upage

# 添加上游仓库
git remote add upstream https://github.com/halo-dev/upage.git
```

## 安装依赖

使用 pnpm 安装项目依赖：

```bash
pnpm install
```

## 生成 Prisma 客户端

UPage 使用 Prisma 作为数据库 ORM，因此需要生成 Prisma 客户端。

```bash
pnpm setup
```

## 配置环境变量

拷贝 `.env.example` 文件，创建 `.env` 文件：

```bash
cp .env.example .env
```

按照[配置参考](../configuration)的说明修改 `.env` 文件进行配置。

## 启用 Logto 认证（可选）

UPage 默认仅支持单一用户匿名访问，如果您想要开发用户认证功能，可以按照[Logto 认证集成](../deployment/logto)的说明配置 Logto 认证。

## 启动开发服务器

启动开发服务器，这将允许您在本地预览和测试您的更改：

```bash
pnpm dev
```

此命令会启动开发服务器，您可以通过 `http://localhost:5173` 访问。

## 构建项目

要构建生产版本的项目，运行：

```bash
pnpm build
```

构建完成后，您可以通过以下命令预览生产版本：

```bash
pnpm preview
```

预生产版本项目运行在 `http://localhost:3000`。

## 运行测试

运行项目的测试套件：

```bash
pnpm test
```

## 文档开发

如果您想要修改或预览文档，可以使用以下命令：

```bash
# 启动文档开发服务器
pnpm docs:start

# 构建文档
pnpm docs:build
```

文档开发服务器默认在 `http://localhost:3000` 运行。

## 常见问题解决

### 依赖安装失败

如果您在安装依赖时遇到问题，可以尝试以下解决方案：

```bash
# 清除 pnpm 缓存
pnpm store prune

# 重新安装依赖
pnpm install --force
```

### 开发服务器启动失败

如果开发服务器无法启动，请检查：

1. 端口 5173 是否被其他应用占用
2. Node.js 版本是否符合要求
3. 是否所有依赖都已正确安装

您可以尝试使用不同的端口启动：

```bash
pnpm dev --port 5174
```

### 其他问题

如果您遇到其他问题，请查看项目的 [常见问题](../faq.md) 或在 [GitHub Issues](https://github.com/halo-dev/upage/issues) 中搜索相关问题。如果没有找到解决方案，请创建新的 issue。
