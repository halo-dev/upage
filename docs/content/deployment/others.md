---
id: others
title: 其他配置
---

# 其他配置

本文档提供了部署 UPage 时的一些其他配置选项和最佳实践。

## 使用 Nginx 反向代理

如果您需要使用 Nginx 作为反向代理，可以参考以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 配置 HTTPS

建议使用 Nginx 或其他反向代理来处理 HTTPS 请求。您可以使用 Let's Encrypt 获取免费的 SSL 证书。

## 数据备份

UPage 的数据存储在挂载的 `data` 目录中，您可以定期备份该目录来保护您的数据：

```bash
# 备份数据目录
tar -czf upage-data-backup-$(date +%Y%m%d).tar.gz ./upage/data
```
