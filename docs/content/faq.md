---
id: faq
title: 常见问题
---

# 常见问题

本文档整理了使用 UPage 时的常见问题和解答，帮助您快速解决可能遇到的问题。

## 基本问题

### UPage 是什么？

UPage 是一款基于大模型的可视化网页构建平台，支持多种 AI 提供商集成，基于自然语言快速实现定制化网页。它允许用户通过简单的文字描述生成完整的网页，并提供可视化编辑工具进行进一步定制。

### UPage 适合哪些用户？

UPage 适合各类需要快速创建网页的用户，包括但不限于：

- 开发者：快速创建原型和演示页面
- 设计师：将设计理念转化为实际网页
- 内容创作者：创建展示内容的网页
- 营销人员：制作营销着陆页
- 小企业主：创建企业网站和产品展示页面
- 教育工作者：制作教学资源和课程页面

### UPage 是开源的吗？

是的，UPage 是一个开源项目，采用 [基于 GPLv3 的补充协议许可证](https://github.com/halo-dev/upage/blob/main/LICENSE.txt)。您可以在 [GitHub](https://github.com/halo-dev/upage) 上查看源代码，也可以参与项目开发和改进。

## 安装和部署

### 如何安装 UPage？

UPage 提供多种安装方式，最简单的方法是使用 Docker：

```bash
docker run -d \
  --name upage \
  --restart unless-stopped \
  -p 3000:3000 \
  -e LLM_PROVIDER=OpenAILike \
  -e PROVIDER_BASE_URL=your-openai-like-api-base-url \
  -e PROVIDER_API_KEY=your-openai-like-api-key \
  -e LLM_DEFAULT_MODEL=your-default-model \
  -e LLM_MINOR_MODEL=your-minor-model \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  -v ./storage:/app/storage \
  halo-dev/upage:latest
```

详细的安装说明请参考[快速开始](./quick-start)文档。

### UPage 的系统要求是什么？

UPage 的最低系统要求：

- Docker 20.10.0 或更高版本（如果使用 Docker 部署）
- Node.js 18.18.0 或更高版本（如果源码部署）
- 至少 2GB 可用内存
- 至少 2GB 可用磁盘空间
- 互联网连接（用于访问 AI API）

### 如何更新 UPage？

如果使用 Docker 部署，可以按照以下步骤更新 UPage：

```bash
# 拉取最新镜像
docker pull halo-dev/upage:latest

# 停止并删除旧容器
docker stop upage
docker rm upage

# 使用新镜像启动容器（使用与之前相同的环境变量和挂载）
docker run -d \
  --name upage \
  --restart unless-stopped \
  -p 3000:3000 \
  ... # 其他环境变量和挂载
  halo-dev/upage:latest
```

如果使用 Docker Compose，则可以执行：

```bash
docker-compose pull
docker-compose down
docker-compose up -d
```

## AI 集成

### UPage 支持哪些 AI 提供商？

UPage 支持多种 AI 提供商，包括：

- DeepSeek（DeepSeek-Chat、DeepSeek-Reasoner）
- OpenAI（GPT-4o、GPT-5 等）
- Anthropic Claude
- Google Gemini
- 兼容 OpenAI 接口的服务（如 Azure OpenAI、智谱 AI 等）
- Ollama（本地部署的开源模型）

所有支持的 AI 提供商请参考[配置参考- AI 提供商配置](./configuration#ai-提供商配置)文档。

### 如何配置 AI 提供商？

通过环境变量配置 AI 提供商，例如：

```bash
# OpenAI
-e LLM_PROVIDER=OpenAI \
-e PROVIDER_API_KEY=your-openai-api-key \
-e LLM_DEFAULT_MODEL=gpt-4-turbo \
-e LLM_MINOR_MODEL=gpt-3.5-turbo

# Anthropic Claude
-e LLM_PROVIDER=Anthropic \
-e PROVIDER_API_KEY=your-anthropic-api-key \
-e LLM_DEFAULT_MODEL=claude-3-opus-20240229 \
-e LLM_MINOR_MODEL=claude-3-haiku-20240307
```

详细的配置选项请参考[配置参考 - AI 提供商配置](./configuration#ai-提供商配置)文档。

### 使用 AI 生成页面需要多少 token？

生成一个标准页面通常需要 2,000-10,000 个 token，具体取决于页面的复杂度和内容量。复杂的页面可能需要更多 token。UPage 会尽可能优化 prompt，尽量减少 token 消耗。

### 如何优化 AI 提示以获得更好的结果？

有效的 AI 提示应该：

- 明确指定页面类型和目的
- 列出所需的主要组件和内容
- 描述设计风格和布局偏好
- 提供具体的内容示例或要求
- 使用清晰、具体的语言

例如：
```
创建一个现代风格的产品登录页面，用于展示我们的智能手表产品。页面应包含：
1. 顶部导航栏，带有品牌标志和菜单
2. 醒目的标题和副标题，强调产品的主要卖点
3. 产品图片展示区，包含至少3张不同角度的产品图
...
```

你可以使用 UPage 的优化提示功能来优化您的提示。

## 使用问题

### 如何编辑 AI 生成的页面？

1. 在页面列表中选择要编辑的页面
2. 使用可视化编辑器点击要修改的页面元素
3. 对于文本组件，可以直接输入文本进行修改
4. 对于图片组件，可以点击上传图片进行替换
5. 使用弹出的属性面板修改组件属性和样式
6. 也可以使用 AI 辅助功能进行局部或整体调整

### UPage 支持响应式设计吗？

是的，UPage 生成的页面默认支持响应式设计，可以自动适应不同屏幕尺寸。您可以在编辑器中预览页面在不同设备上的显示效果，并进行针对性调整。如果生成的页面不符合您的预期，您可以尝试使用 AI 辅助调整。

## 数据和安全

### UPage 如何存储数据？

UPage 使用 SQLite 数据库存储页面数据和用户配置，存储在挂载的 `data` 目录中。上传的文件和资源存储在挂载的 `storage` 目录中。日志文件存储在挂载的 `logs` 目录中。

### 如何备份 UPage 数据？

备份 UPage 数据的最简单方法是备份挂载的数据目录：

```bash
# 备份数据目录
tar -czf upage-data-backup-$(date +%Y%m%d).tar.gz ./data

# 备份存储目录
tar -czf upage-storage-backup-$(date +%Y%m%d).tar.gz ./storage
```

### UPage 如何处理用户隐私？

UPage 本身不会收集或传输用户数据，除非明确配置。当使用 AI 功能时，页面内容会发送到配置的 AI 提供商进行处理。请确保您使用的 AI 提供商符合您的隐私要求。

### 如何配置 UPage 的多用户？

UPage 支持通过 Logto 进行用户认证和访问控制。详细配置请参考[Logto 认证集成](deployment/logto)文档。

## 故障排除

### 页面生成失败怎么办？

如果页面生成失败，可能的原因和解决方法：

1. **AI API 连接问题**：检查网络连接和 API 密钥是否正确
2. **提示过于复杂**：尝试简化页面描述，分步骤生成
3. **token 限制**：检查是否达到 AI 提供商的 token 限制
4. **模型不支持**：尝试使用更强大的模型或不同的 AI 提供商
5. **生成内容超过限制**：UPage 默认限制单次回答不超过 3 次 Token 上限，您可以尝试分步骤生成

### 如何查看系统日志？

默认情况下，UPage 会将日志保存在挂载的 `logs` 目录中，可以通过以下方式查看系统日志：

```bash
# 查看容器日志
docker logs upage

# 查看错误日志文件
cat logs/error-*.log

# 查看所有日志文件
cat logs/combined-*.log
```

### 如何解决数据库错误？

如果遇到数据库相关错误，可以尝试：

1. 检查数据目录的权限：`chmod -R 755 ./data`
2. 备份并重新初始化数据库：
   ```bash
   # 备份当前数据库
   cp ./data/upage.db ./data/upage.db.bak
   
   # 删除并重新初始化
   rm ./data/upage.db
   docker restart upage
   ```

### 容器无法启动怎么办？

如果 Docker 容器无法启动，可以尝试：

1. 检查日志：`docker logs upage`
2. 验证环境变量：确保所有必需的环境变量都已正确设置
3. 检查磁盘空间：确保有足够的磁盘空间
4. 检查端口冲突：确保端口 3000 没有被其他服务占用
5. 检查文件权限：确保挂载的目录具有正确的权限

## 高级问题

### UPage 支持插件系统吗？

UPage 不提供正式的插件系统，但作为开源项目，您可以通过 fork 代码库并进行修改来扩展功能。

### 如何与现有系统集成？

UPage 提供多种集成方式：

1. **API 集成**：使用 UPage API 与其他系统交互
2. **导出集成**：下载页面源代码（HTML/CSS/JS）并集成到现有系统
3. **部署集成**：使用 Vercel 或 Netlify 集成直接部署页面
4. **认证集成**：通过 Logto 与现有认证系统集成
