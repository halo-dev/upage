---
id: logto
title: Logto 认证集成
---

# Logto 认证集成

:::info
UPage 默认仅支持单一匿名用户访问，但您可以通过集成 Logto 实现用户认证，支持多用户登录
:::

UPage 支持与 [Logto](https://logto.io/) 集成，提供完整的用户认证体系。本文档将指导您如何配置 UPage 与 Logto 的集成。

## 什么是 Logto？

Logto 是一个开源的身份验证和授权解决方案，提供了完整的用户管理、身份验证和授权功能。通过与 Logto 集成，UPage 可以支持用户注册、登录、密码重置等功能，同时提供基于角色的访问控制。

## Logto 接入方式

Logto 支持两种接入方式，您可以根据自己的需求选择合适的方式。

1. 使用 Logto 官方提供的托管服务 - Logto Cloud。
2. 本地部署开源版 Logto 服务。

:::info
两种方式仅在接入方式上有所区别，在配置上完全一致。
:::

### 使用官方托管服务

访问 [Logto 官方网站](https://logto.io/)，注册一个账号即可进行下一步操作。

### 本地部署 Logto

UPage 提供了一个简化的 Logto 部署配置。在 UPage 项目目录下，您可以找到 `logto/docker-compose.yaml` 文件以及 `.env` 文件。

```bash
curl -L https://raw.githubusercontent.com/halo-dev/upage/refs/heads/main/logto/docker-compose.yaml -o ~/upage/logto/docker-compose.yaml
curl -L https://raw.githubusercontent.com/halo-dev/upage/refs/heads/main/logto/.env -o ~/upage/logto/.env
cd ~/upage/logto
docker-compose up -d
```

这将启动 Logto 服务，默认情况下可以通过 `http://localhost:3002` 访问 Logto 管理控制台。

:::caution
在生产环境部署时，请务必修改 `.env` 文件中的 `LOGTO_ENDPOINT` 、 `LOGTO_ADMIN_ENDPOINT` 以及 `LOGTO_POSTGRES_PASSWORD` 配置。
:::

## 配置 Logto

1. 访问 Logto 管理控制台，
2. 创建一个新的应用程序：
   - 应用类型：传统网页应用
   - 应用名称：UPage
   - 重定向 URIs：`http://${UPAGE_URL}/api/auth/callback`
   - 退出登录后重定向 URIs：`http://${UPAGE_URL}`
   - CORS 允许的来源：`http://${UPAGE_URL}`
   - 其他配置根据实际情况填写
3. 记录应用程序的 ID 和密钥，这些将用于配置 UPage

## 配置 UPage 与 Logto 集成

### 环境变量配置

在 UPage 的环境变量中配置 Logto 相关参数：

```bash
# 启用 Logto 认证
LOGTO_ENABLE=true
# Logto LOGTO_ENDPOINT 地址
LOGTO_ENDPOINT=http://localhost:3001
# Logto 应用程序 ID
LOGTO_APP_ID=your-app-id
# Logto 应用程序密钥
LOGTO_APP_SECRET=your-app-secret
# Logto 用于加密 cookie 的密钥，随机生成一个 32 位密钥即可
LOGTO_COOKIE_SECRET=your-cookie-secret
# 填写 UPage 地址，根据实际部署地址修改
LOGTO_BASE_URL=http://localhost:3000
```

如果使用 Docker compose 部署 UPage，在 `docker-compose.yml` 文件中添加这些环境变量：

```yaml
services:
  upage:
    # ... 其他配置
    environment:
      # ... 其他环境变量
      - LOGTO_ENABLE=true
      - LOGTO_ENDPOINT=http://logto:3001
      - LOGTO_APP_ID=your-app-id
      - LOGTO_APP_SECRET=your-app-secret
      - LOGTO_COOKIE_SECRET=your-cookie-secret
      - LOGTO_BASE_URL=http://localhost:3000
```

### 配置说明

| 环境变量 | 描述 | 示例 |
| --- | --- | --- |
| `LOGTO_ENABLE` | 是否启用 Logto 认证 | `true` |
| `LOGTO_ENDPOINT` | Logto 服务的 URL | `http://localhost:3001` |
| `LOGTO_APP_ID` | Logto 应用程序 ID | `your-app-id` |
| `LOGTO_APP_SECRET` | Logto 应用程序密钥 | `your-app-secret` |
| `LOGTO_COOKIE_SECRET` | 用于加密 cookie 的密钥 | `00bf44b6ceaa648eca6ad172f0cd8c8c` |
| `LOGTO_BASE_URL` | UPage 地址 | `http://localhost:3000` |

## Logto 使用技巧

:::tip
UPage 集成 Logto 步骤已完成，以下内容是 Logto 的特殊使用技巧，供扩展阅读，如无定制化需求可忽略。
:::

### 自定义登录界面

Logto 提供了自定义登录界面的功能：

1. 在 Logto 管理控制台中，导航到"外观"
2. 自定义登录页面的样式、颜色和品牌元素
3. 预览并保存更改

### 配置社交登录

Logto 支持多种社交登录方式：

1. 在 Logto 管理控制台中，导航到"连接器"
2. 添加社交登录连接器（如 Google、GitHub、微信等）
3. 按照向导完成配置

### 配置多因素认证

启用多因素认证以提高安全性：

1. 在 Logto 管理控制台中，导航到"安全"
2. 启用多因素认证
3. 配置多因素认证方式（如 TOTP、短信等）
