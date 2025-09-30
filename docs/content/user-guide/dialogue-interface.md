---
id: dialogue-interface
title: 会话及生成界面
---

# 会话及生成界面概述

会话及生成界面是 UPage 的核心功能界面，用户可以在此界面中与 AI 进行多轮对话，生成网页。

![](/img/user-guide/dialogue-interface/index.png)

:::tip
此页面需要至少与 AI 进行首次对话后，才能出现，否则会自动跳转至首页。
:::

## 标题区域

在标题区域中，可以展示当前聊天的标题，用户可以在此区域中重命名聊天名称。重命名后的聊天名称将展示在历史记录中。

:::note
不建议重命名特别长的聊天名称，过长的聊天名称会被遮挡。
:::

## 部署功能区

当页面生成完成之后，可以使用部署功能区将生成的页面部署至 **1Panel**、**Netlify**、**Vercel** 等平台。

![](/img/user-guide/dialogue-interface/deployment.png)

### 部署至 1Panel

:::warning
当前仅支持 **1Panel V2** 版本。并且请确保 **1Panel** 已安装 `OpenResty` 应用。
:::

首次部署时，会弹出**连接 1Panel** 的对话框，用户需要在此对话框中填写 1Panel 的连接信息。

![](/img/user-guide/dialogue-interface/connect_1panel.png)

在此对话框中，用户需要填写 **服务器地址** 和 **API 密钥**。

:::tip
API 密钥可以前往 1Panel 的 `面板设置 - API 接口` 中获取。

请参阅 [1Panel API 文档](https://1panel.cn/docs/v2/dev_manual/api_manual/)。
:::

填写完成后，点击**连接**按钮，会打开**部署至 1Panel** 的对话框。

![](/img/user-guide/dialogue-interface/deploy_1panel.png)

在此对话框中，用户可以输入 **协议**、**自定义域名** 等信息，点击**部署到 1Panel**按钮后，会自动将生成的页面部署至 1Panel 的网站中。

### 部署至 Netlify

首次部署时，会弹出**连接 Netlify** 的对话框，用户需要在此对话框中填写 Netlify 的连接信息。

![](/img/user-guide/dialogue-interface/connect_netlify.png)

在此对话框中，用户需要填写 Netlify 的 **访问令牌**。

填写完成后，点击**连接**按钮，会打开**部署至 Netlify** 的对话框。

![](/img/user-guide/dialogue-interface/deploy_netlify.png)

在此对话框中，可以对已部署的网站进行 **清除缓存**、**删除站点** 等操作。

点击 **部署到 Netlify** 按钮后，会自动将生成的页面部署至 Netlify 中。

### 部署至 Vercel

首次部署时，会弹出**连接 Vercel** 的对话框，用户需要在此对话框中填写 Vercel 的连接信息。

![](/img/user-guide/dialogue-interface/connect_vercel.png)

在此对话框中，用户需要填写 Vercel 的 **访问令牌**。

填写完成后，点击**连接**按钮，会打开**部署至 Vercel** 的对话框。

![](/img/user-guide/dialogue-interface/deploy_vercel.png)

在此对话框中，可以查看已部署至 Vercel 的网站信息。

点击 **部署到 Vercel** 按钮后，会自动将生成的页面部署至 Vercel 中。

## 对话交互

在对话交互区中，可以展示用户与 AI 的聊天信息，例如用户发送的消息、AI 回复的消息以及 AI 当前正在生成或已生成完成的页面 `Section` 信息。

![](/img/user-guide/dialogue-interface/chat_interaction.png)

点击对应的 `Section` 可以查看该 `Section` 在整个页面中所处的位置。

## 对话输入框

对话输入框中，可以与 AI 进行多轮对话，对已生成的页面进行调整。

## 编辑器功能菜单

编辑器功能菜单用于对已生成的页面进行可视化、预览、下载源码、推送至 Github 等操作。并且还可以在用户手动编辑后，展示与 AI 生成内容的差异性。

### 可视化

建设中...

### 差异

建设中...

### 预览

建设中...

### 下载源码

建设中...

### 推送至 Github

建设中...

## 可视化编辑器

可视化编辑器用于对已生成的页面进行可视化编辑，支持对文本直接修改、上传图片、修改图标、 AI 定点修改等操作。

### 上传图片

建设中...

### 修改图标

建设中...

### AI定点修改

建设中...
