---
description: "在 DeepSeek Harness Web profile 中安装并运行 DS Kanban 实时任务看板。"
kind: "package-bundle"
---

# dsh-ds-kanban

[English](README.md) | 中文

## 概要

DS Kanban 是面向 DeepSeek Harness Web 0.1.2-alpha.1 的树外 bundle 格式插件。它增加一个侧边栏入口和一个全壳层实时看板，不替换 Harness 应用壳，也不保存第二份任务数据库。Session、Workspace、projection、待处理交互和连接服务始终是权威数据源；插件只在现有的认证 settings 能力中保存 Inbox/Ready 位置和显示偏好。下列命令把当前 checkout 安装到本机 `web` profile。

## 目录

- [使用本包](#use-this-package)
- [操作看板](#operate-the-board)
- [理解实现](#understand-the-implementation)
- [安全与隐私](#security-and-privacy)
- [支持与不可用能力](#supported-and-unavailable-capabilities)
- [故障排查](#troubleshooting)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

### 安装依赖、验证并构建

在 DeepSeek Harness 仓库根目录中运行：

```text
pnpm install --dir plugins/ds-kanban
pnpm --dir plugins/ds-kanban typecheck
pnpm --dir plugins/ds-kanban build
pnpm --dir plugins/ds-kanban test
```

测试命令会读取已构建的 Client 产物，因此干净 checkout 需要先构建再测试。浏览器兼容测试会拒绝已删除的 `@deepseek-ai/dsh-client-runtime` import 和任何意外的外部 `require()` 调用。

### 安装到本机 Web profile

```text
pnpm dsh plugin --profile web add ./plugins/ds-kanban
pnpm dsh --profile web --port 3080
```

打开命令输出的 loopback URL，再从侧边栏选择 **DS 看板**。安装、更新或移除后必须重启已经运行的 Host，因为 profile 组合和 Client bundle 发现发生在 Host 启动期间。

### 更新或移除

重新构建并再次执行 `add` 命令即可协调更新后的 checkout。以下命令移除包及其有序 profile 层，但不会删除 Harness Session 或 Workspace 数据：

```text
pnpm dsh plugin --profile web remove dsh-ds-kanban
```

移除包后看板不再加载。除非操作者明确删除，否则 `ds-kanban` settings 节仍是用户数据并会保留。

### 获得的功能

侧边栏徽标统计等待、失败和高上下文压力任务。完整看板提供 Inbox、Ready、Running、Waiting、Blocked or Failed 和 Done 列，以及实时统计、搜索筛选、Workspace 分组、密度和时间戳选项、显式 JSON/CSV 导出、诊断、任务创建、现有任务导航、取消、归档和复制任务 ID。自动状态始终优先于手动 Inbox/Ready 位置。

<a id="operate-the-board"></a>
## 操作看板

点击卡片或聚焦后按 Enter，可打开其现有 Harness 任务。左右方向键在有内容的列之间移动焦点，`/` 聚焦搜索，Escape 关闭当前看板层或对话框。看板覆盖包括侧边栏在内的整个外壳，因此返回路径不依赖被覆盖的 UI：打开看板时焦点落在工具栏的“返回会话”控件上，点击该控件或按全局 Escape 会关闭看板并把焦点交还侧边栏入口。只有空白的 Inbox/Ready 卡片可以拖动；运行、等待、失败、完成和归档事实不能被拖放覆盖。归档和取消都需要确认。归档、取消或复制任务 ID 失败时，会在看板顶部显示带关闭按钮的错误横幅。导出只包含明确允许的卡片摘要字段，绝不包含提示词、完整对话、凭据、工具结果或文件内容。

<a id="understand-the-implementation"></a>
## 理解实现

本包在 [`package.json`](package.json) 中声明 `dsh.bundle.patch`。[`cordis.patch.yml`](cordis.patch.yml) 插入 Host settings 注册。[`src/client/index.ts`](src/client/index.ts) 通过生命周期所有的 slot 添加一个侧边栏 footer action 和一个 shell overlay。[`src/client/board.ts`](src/client/board.ts) 是纯权威状态 projection，[`src/settings.ts`](src/settings.ts) 只拥有版本化手动位置和视图偏好。[`ARCHITECTURE.md`](ARCHITECTURE.md) 记录所有权和更新流程。

Host 不增加 HTTP route。浏览器变更复用 Web profile 已公开且经过认证的 Session、Workspace、Agent Preset 和 settings RPC 服务。现有 settings provider 验证已注册 schema，使用 revision fence，并原子提交插件拥有的节。

<a id="security-and-privacy"></a>
## 安全与隐私

插件不发出外部网络请求，不启动服务器，不执行浏览器提供的 shell 命令，也不发送 telemetry。它读取列表摘要和轻量生命周期/projection 状态，而不读取任务内容。畸形或未知版本的 settings 会被拒绝，不会重写已存储的节；Client 保留上一个已接受 snapshot。生命周期清理会移除 Session 订阅、slot 行、locale 字典和注入的 style 元素。威胁和数据摘要见 [`SECURITY.md`](SECURITY.md)。

<a id="supported-and-unavailable-capabilities"></a>
## 支持与不可用能力

当前 Harness API 提供实时 Session 状态、Workspace 归属和归档状态、待用户处理交互、模型与预设 projection、完成步数、Token 用量、上下文压力、取消、Session 导航和直接子 Agent Session 数量。

当前 API 不在任务列表 projection 中提供权威成本、任务开始/运行历史、用于“今日完成”的持久完成时间戳、工具调用总数、Git 分支/worktree、变更文件数或简短最终结果摘要。API 也不提供置顶/取消置顶或取消归档操作。DS Kanban 将汇总成本、运行时间排序和今日完成统计标为不可用，省略不可用的卡片指标，并且绝不合成这些值。

<a id="troubleshooting"></a>
## 故障排查

- **没有侧边栏入口：** 重新构建，再次执行 profile `add`，并重启 Web Host。检查 Host 启动输出中是否有失败的 bundle 行。
- **偏好显示仅内存：** Host profile 没有向该 Client 连接公开 settings namespace。看板仍可工作，但偏好写入不会持久化。
- **断开连接指示：** 现有 Harness 连接循环重连时，看板会保留最后收到的 snapshot。连接恢复后若列表仍陈旧，请使用刷新。
- **某项指标或操作缺失：** 打开看板中的诊断。设计上，不支持的能力保持禁用或不显示。
- **Client loader 失败：** 运行 `pnpm --dir plugins/ds-kanban build` 和 `pnpm --dir plugins/ds-kanban test`；bundle 测试会列出支持的外部模块。

<a id="model-experience"></a>
## 模型体验

无。DS Kanban 是面向操作者的 Client projection，不增加模型可见工具、提示词内容或请求输入。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

看板 projection 顶层任务并统计直接子 Agent Session，不把子 Agent Session 渲染为独立卡片。每列起初渲染 60 张卡片，并以每次 60 张的方式显示更多；筛选和统计仍覆盖完整权威集合。由于缺少权威值，运行时间和成本排序选项在下拉框中处于禁用状态。当前受支持的 Client API 只能单向归档。完整 overlay 关闭时，侧边栏注意徽标仍需读取轻量缓存 Session face；它不会打开完整对话窗口，也不会轮询 Host。

### 开发说明

<details>
<summary>维护者工作上下文——点击展开</summary>

该 bundle 面向 0.1.2-alpha.1 Client service vocabulary，并明确不为已删除的 `dsh-client-runtime` 包提供兼容路径。

</details>
