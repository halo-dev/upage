---
id: workflow
title: 工作流程
---

# 工作流程

本文档描述了 UPage 项目的开发工作流程，包括分支策略、Pull Request 流程和版本发布流程。

## 分支策略

UPage 项目使用以下分支策略：

### 主要分支

- **`main`**: 主分支，包含最新的开发代码，用于集成功能和修复，同时也对应最新的发布版本

### 功能分支

开发新功能时，应从 `main` 分支创建功能分支：

- **`feature/*`**: 功能分支，用于开发新功能
  - 例如：`feature/drag-and-drop`、`feature/user-authentication`

### 修复分支

修复 bug 时，应从 `main` 分支创建修复分支：

- **`fix/*`**: 修复分支，用于修复 bug
  - 例如：`fix/login-error`、`fix/memory-leak`

### 发布分支

准备新版本发布时，从 `main` 分支创建发布分支：

- **`release/*`**: 发布分支，用于准备新版本发布
  - 例如：`release/v1.0.0`、`release/v1.1.0`

### 热修复分支

对已发布版本的紧急修复，从 `main` 分支创建热修复分支：

- **`hotfix/*`**: 热修复分支，用于对已发布版本的紧急修复
  - 例如：`hotfix/v1.0.1`、`hotfix/v1.1.2`

## 工作流程图

```
main    ─────┬───────────────┬─────────────────────────────────
              │               │                 ↑           ↑
              ↓               ↓                 │           │
feature   feature/A      feature/B              │           │
                                                │           │
fix                                         fix/bug-1    fix/bug-2
              │                                 │           │
              │                                 │           │
release       └─────────────────────────────────┴───────────┘
              release/v1.0.0
```

## Pull Request 流程

### 准备 Pull Request

1. 确保您的代码符合项目的[代码规范](./code-standards.md)
2. 更新相关文档（如适用）
3. 添加或更新测试（如适用）
4. 确保所有测试通过
5. 将您的分支与目标分支（通常是 `main`）同步

### 创建 Pull Request

1. 在 GitHub 上创建一个新的 Pull Request
2. 选择正确的目标分支（通常是 `main`）
3. 填写 Pull Request 模板，提供以下信息：
   - 清晰的标题，简要描述更改
   - 详细的描述，解释更改的目的和实现方式
   - 相关的 issue 链接（如适用）
   - 截图或视频（如适用）
   - 任何需要审核者特别注意的事项

### Pull Request 审核

1. 至少需要一个项目维护者的批准才能合并 PR
2. 审核者可能会要求进行更改
3. 根据反馈进行必要的更改
4. 确保 CI 检查通过

### 合并 Pull Request

1. 一旦 PR 获得批准并且所有检查通过，它将被合并
2. 通常使用 "Squash and merge" 策略，将所有提交合并为一个
3. 合并后，相关的分支可以被删除

## 版本发布流程

UPage 遵循 [语义化版本控制](https://semver.org/) 规范。版本号格式为 `X.Y.Z`：

- **X**: 主版本号，当进行不兼容的 API 更改时递增
- **Y**: 次版本号，当添加向后兼容的功能时递增
- **Z**: 修订号，当进行向后兼容的 bug 修复时递增

### 发布准备

1. 从 `main` 分支创建发布分支，例如 `release/v1.0.0`
2. 在发布分支上进行最终测试和修复
3. 更新版本号和更新日志
4. 创建 Pull Request 将发布分支合并回 `main`

### 发布步骤

1. 合并发布分支到 `main`
2. 在 `main` 分支上创建版本标签，例如 `v1.0.0`
3. 发布 GitHub Release，包含详细的更新日志

### 热修复发布

1. 从 `main` 分支创建热修复分支，例如 `hotfix/v1.0.1`
2. 实现必要的修复
3. 更新版本号和更新日志
4. 创建 Pull Request 将热修复分支合并到 `main`
5. 必要时创建 cherry-pick PR 将热修复分支合并到对应的发布分支

## 持续集成和部署

UPage 使用 GitHub Actions 进行持续集成和部署：

### CI 工作流程

- 每个 PR 会触发构建和测试
- 代码质量检查（linting、类型检查）
- 单元测试和集成测试
- 构建检查

### CD 工作流程

- 合并到 `main` 分支会触发开发构建和部署
- 自动生成和发布 Docker 镜像
- 更新文档网站

## 问题跟踪

UPage 使用 GitHub [Issues](https://github.com/halo-dev/upage/issues) 进行问题跟踪，使用标签对问题进行分类（bug、feature、documentation 等）
