---
id: 1panel
title: 使用 1Panel 部署
---

## 1Panel 简介

[1Panel](https://1panel.cn/) 是一个现代化、开源的 Linux 服务器运维管理面板。

![](/img/deployment/1panel/home.png)

### 什么是 1Panel？
1Panel 是新一代的 Linux 服务器运维管理面板。

- **高效管理**：用户可以通过 Web 界面轻松管理 Linux 服务器，如主机监控、文件管理、数据库管理、容器管理等；
- **快速建站**：深度集成开源建站软件 WordPress 和 Halo，域名绑定、SSL 证书配置等操作一键搞定；
- **应用商店**：精选上架各类高质量的开源工具和应用软件，协助用户轻松安装并升级；
- **安全可靠**：基于容器管理并部署应用，实现最小的漏洞暴露面，同时提供病毒防护、防火墙和日志审计等功能；
- **一键备份**：支持一键备份和恢复，用户可以将数据备份到各类云端存储介质，永不丢失。

### 安装 1Panel

关于 1Panel 的安装部署与基础功能介绍，请参考 [1Panel 官方文档](https://1panel.cn/docs/v2)。此处假设你已经完成了 1Panel 的安装部署，并对其功能有了基础了解。

## 安装 UPage

进入应用商店应用列表，选择其中的 UPage 应用进行安装。

![](/img/deployment/1panel/install_upage.png)

在应用详情页面，选择最新版本的 UPage 进行安装，并按照页面属性完成配置。

![](/img/deployment/1panel/upage_detail.png)

参数说明：

| 参数 | 说明 | 示例 |
| --- | --- | --- |
| 名称 | 要创建的 UPage 应用的名称。 | `upage` |
| 版本 | 要安装的 UPage 版本，选择最新即可 | `1.0.0` |
| HTTP 端口 | UPage 应用的服务端口 | `3000` |
| LLM 提供商 | UPage 所使用的 LLM 提供商 | `OpenAI` |
| API 密钥 | 对应 LLM 提供商的 API 密钥 | `sk-xxxx` |
| API 地址 | 部分 LLM 需要填写此项 | `https://api.openai.com/v1` |
| 页面默认模型 | UPage 生成页面所使用的主要模型 | `gpt-4.1` |
| 辅助页面生成模型 | UPage 辅助页面生成所使用的次级模型 | `gpt-4.1-mini` |

:::tip
完整详细的参数说明请参考[配置参考](../configuration)。
:::

点击安装后，系统将自动安装 UPage 应用，等待应用安装完成。

![](/img/deployment/1panel/upage_installing.png)

安装完成后，可以看到刚刚安装的 UPage 应用已经变为 `已启动` 状态。

![](/img/deployment/1panel/upage_installed.png)

如果开启了 **端口外部访问** 选项，现在就可以直接在浏览器中访问 `http://<服务器IP>:<HTTP 端口>` 来访问 UPage 应用。

## 创建网站（可选）

完成 UPage 应用的安装后，此时并不会自动创建一个网站，我们需要手动创建一个网站，然后将 UPage 应用绑定到这个网站上才能使用域名访问。

### 安装 OpenResty

点击 1Panel 菜单的 **应用商店**，找到 OpenResty 应用，点击 **安装** 按钮进行安装。

![](/img/deployment/1panel/install_openresty.png)

在应用详情页面，选择最新版本的 OpenResty 进行安装，并按照页面属性完成配置。

### 创建 UPage 网站

安装完成后，点击 1Panel 菜单的 **网站**，进入网站列表页，点击 **创建网站** 按钮。

![](/img/deployment/1panel/create_website.png)

1. 在已装应用中选择我们刚刚新建的 Halo 应用。
2. 正确填写主域名，需要注意的是需要 **提前解析好域名到服务器 IP**。
3. 点击确认按钮，等待网站创建完成即可访问 UPage。

![](/img/deployment/1panel/create_website_success.png)
