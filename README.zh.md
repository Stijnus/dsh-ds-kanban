# dsh-ds-kanban

[English](README.md) | 中文

## 概要

DS Kanban 是面向 DeepSeek Harness Web 的树外 bundle 格式插件。它增加一个侧边栏入口和一个全壳层实时看板，不替换 Harness 应用壳，也不保存第二份任务数据库。Session、Workspace、projection、待处理交互和连接服务始终是权威数据源；插件只在现有的认证 settings 能力中保存 Inbox/Ready 位置和显示偏好。本包可通过下面的 `dsh plugin` 命令安装到任何 profile，要求 Harness 版本处于 `0.1.2-alpha.1` 服务词汇或更新。

## 目录

- [安装本包](#install-this-package)
- [操作看板](#operate-the-board)
- [理解实现](#understand-the-implementation)
- [安全与隐私](#security-and-privacy)
- [支持与不可用能力](#supported-and-unavailable-capabilities)
- [从源码构建](#build-from-source)
- [故障排查](#troubleshooting)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)

-----

<a id="install-this-package"></a>
## 安装本包

前置条件：已安装带 `dsh` CLI 的 DeepSeek Harness，并有目标 profile（Web profile 提供完整看板）。安装、更新或移除会改变 profile 组合和 Client bundle 发现，因此之后需要重启该 profile 的 Host。任选一种渠道：

**npm（无需构建许可）：**

```text
dsh plugin --profile <name> add dsh-ds-kanban
```

**固定 git 引用（源码安装；pnpm 会运行一次包的 `prepare` 构建）：**

```text
dsh plugin --profile <name> add github:Stijnus/dsh-ds-kanban#<sha-or-tag>
```

git 安装拉取的是源码，因此 pnpm ≥10 会先拒绝 `prepare` 构建，直到显式允许：把 pnpm 打印的包键原样复制进 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds` 映射，再重新执行 `add`。固定 commit 或 tag，避免后续推送静默改变所运行的内容；并把这个允许视为在你的机器上执行该包构建的许可。

**发布 tarball（无需构建许可）：**

从 [GitHub Releases](https://github.com/Stijnus/dsh-ds-kanban/releases) 页面下载 `dsh-ds-kanban-<version>.tgz`，然后：

```text
dsh plugin --profile <name> add ./dsh-ds-kanban-<version>.tgz
```

执行 `add` 并重启 Host 后，从侧边栏选择 **DS 看板**。添加更新版本即可完成更新；以下命令移除包及其有序 profile 层，但不会删除 Harness Session 或 Workspace 数据：

```text
dsh plugin --profile <name> remove dsh-ds-kanban
```

移除包后看板不再加载。除非操作者明确删除，否则 `ds-kanban` settings 节仍是用户数据并会保留。

### 获得的功能

侧边栏徽标统计等待、失败、目标受阻和高上下文压力任务。完整看板提供 Inbox、Ready、Running、Waiting、Blocked or Failed、Idle 和 Goal complete 列，以及实时统计、搜索筛选、Workspace 分组、密度和时间戳选项、显式 JSON/CSV 导出、诊断、任务创建、现有任务导航、取消、归档和复制任务 ID。自动状态始终优先于手动 Inbox/Ready 位置。

<a id="operate-the-board"></a>
## 操作看板

点击卡片或聚焦后按 Enter，可打开其现有 Harness 任务。左右方向键在有内容的列之间移动焦点，`/` 聚焦搜索，Escape 关闭当前看板层或对话框。看板覆盖包括侧边栏在内的整个外壳，因此返回路径不依赖被覆盖的 UI：打开看板时焦点落在工具栏的“返回会话”控件上，点击该控件或按全局 Escape 会关闭看板并把焦点交还侧边栏入口。只有空白的 Inbox/Ready 卡片可以拖动；运行、等待、失败、完成和归档事实不能被拖放覆盖。归档和取消都需要确认。归档、取消或复制任务 ID 失败时，会在看板顶部显示带关闭按钮的错误横幅。导出只包含明确允许的卡片摘要字段，绝不包含提示词、完整对话、凭据、工具结果或文件内容。

### 理解执行状态与目标状态

已停止且非空白的会话显示为 **Idle（空闲）**，除非 Harness 提供已完成的目标。**Goal complete（目标已完成）** 表示当前持久目标已完成，并不表示审核者已接受结果。待处理交互、当前执行和失败状态优先于目标完成状态；已停止但仍有排队消息的会话保持空闲。侧边栏的未读完成提示不作为任务成功的依据。

当 Harness 提供 `goal` 投影时，卡片显示目标内容、状态、已使用轮次与上限，以及记录的阻塞原因。轮次表示自动继续的用量，并非任务完成百分比。目标处于进行中时，会话仍可能空闲；投影不提供自动继续是否已启用的信息。打开会话即可使用现有目标控件。目标投影缺失或被清除时，目标详情消失，但不影响看板的常规操作。

在状态筛选中选择 **需要处理**，可查看待审批、待回答、执行失败、目标受阻和上下文使用率高的任务。每张相关卡片说明原因，并打开现有会话控件。未知交互类型使用通用的“需要输入”操作。这些按钮只负责导航；审批与回答仍由 Harness 当前交互处理。导出不包含目标内容和阻塞原因。

<a id="understand-the-implementation"></a>
## 理解实现

本包在 [`package.json`](package.json) 中声明 `dsh.bundle.patch`。[`cordis.patch.yml`](cordis.patch.yml) 插入 Host settings 注册。[`src/client/index.ts`](src/client/index.ts) 通过生命周期所有的 slot 添加一个侧边栏 footer action 和一个 shell overlay。[`src/client/board.ts`](src/client/board.ts) 是纯权威状态 projection，[`src/settings.ts`](src/settings.ts) 只拥有版本化手动位置和视图偏好。[`ARCHITECTURE.md`](ARCHITECTURE.md) 记录所有权和更新流程。

Host 不增加 HTTP route。浏览器变更复用 Web profile 已公开且经过认证的 Session、Workspace、Agent Preset 和 settings RPC 服务。现有 settings provider 验证已注册 schema，使用 revision fence，并原子提交插件拥有的节。

<a id="security-and-privacy"></a>
## 安全与隐私

插件不发出外部网络请求，不启动服务器，不执行浏览器提供的 shell 命令，也不发送 telemetry。它读取列表摘要和轻量生命周期/projection 状态，包括可用的目标内容和阻塞原因，但不会请求完整对话内容。畸形或未知版本的 settings 会被拒绝，不会重写已存储的节；Client 保留上一个已接受 snapshot。生命周期清理会移除 Session 订阅、slot 行、locale 字典和注入的 style 元素。威胁和数据摘要见 [`SECURITY.md`](SECURITY.md)。

<a id="supported-and-unavailable-capabilities"></a>
## 支持与不可用能力

当前 Harness API 提供实时 Session 状态、Workspace 归属和归档状态、待处理交互类型、可选的目标状态与轮次用量、模型与预设 projection、完成步数、Token 用量、上下文压力、取消、Session 导航和直接子 Agent Session 数量。

当前 API 不在任务列表 projection 中提供权威成本、任务开始/运行历史、用于“今日完成”的持久完成时间戳、工具调用总数、Git 分支/worktree、变更文件数或简短最终结果摘要。API 也不提供置顶/取消置顶或取消归档操作。DS Kanban 将汇总成本和运行时间排序标为不可用，省略不可用的卡片指标，并且绝不合成这些值。完成统计仅计算当前筛选条件下“目标已完成”列中的卡片，并非每日完成数。

<a id="build-from-source"></a>
## 从源码构建

```text
pnpm install
pnpm typecheck
pnpm build
pnpm test
```

运行 `pnpm exec vitest bench --run tests/runtime.bench.ts` 可测量 1,000 个会话、20 个活动 Agent 的运行状态发布性能。该基准不包含 React 渲染或网络传输。行为测试另行验证每次更新读取的会话快照数和未变化对象的稳定性，不使用耗时阈值。

测试命令会读取已构建的 Client 产物，因此干净 checkout 需要先构建再测试。浏览器兼容测试会拒绝已删除的 `@deepseek-ai/dsh-client-runtime` import 和任何意外的外部 `require()` 调用。开发在 `main` 分支进行；发布以 `vX.Y.Z` tag 标记，由 `ci.yml` 和 `release.yml` workflow 交付。

<a id="troubleshooting"></a>
## 故障排查

- **没有侧边栏入口：** 重新构建，再次执行 profile `add`，并重启该 profile 的 Host。检查 Host 启动输出中是否有失败的 bundle 行。
- **偏好显示仅内存：** Host profile 没有向该 Client 连接公开 settings namespace。看板仍可工作，但偏好写入不会持久化。
- **断开连接指示：** 现有 Harness 连接循环重连时，看板会保留最后收到的 snapshot。连接恢复后若列表仍陈旧，请使用刷新。
- **某项指标或操作缺失：** 打开看板中的诊断。设计上，不支持的能力保持禁用或不显示。
- **Client loader 失败：** 运行 `pnpm build` 和 `pnpm test`；bundle 测试会列出支持的外部模块。

<a id="model-experience"></a>
## 模型体验

无。DS Kanban 是面向操作者的 Client projection，不增加模型可见工具、提示词内容或请求输入。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

看板展示顶层任务。每张已显示的任务卡片自动观察所有可达子 Agent 列表，折叠时也显示后代总数和运行数量。列表加载中、失败或包含诊断项时，统计标为部分结果。“显示 Agent”展开层级；运行中和等待中筛选保留匹配项及其祖先路径。子行显示单次或可继续类型，并打开对应会话。卡片离开看板时释放列表观察。状态区分运行中、未运行和可用时的等待用户处理；未运行不代表成功完成。顶层筛选和汇总不包含子行。模型、预设、用量和目标详情仅在 Harness 会话摘要提供时显示，不为补齐详情而打开对话记录。模型标注为下次使用模型，不代表当前或历史请求使用的模型。每列起初渲染 60 张卡片，并以每次 60 张的方式显示更多；筛选和统计仍覆盖完整权威集合。由于缺少权威值，运行时间和成本排序选项在下拉框中处于禁用状态。当前受支持的 Client API 只能单向归档。完整 overlay 关闭时，侧边栏注意徽标仍需读取轻量缓存 Session face；它不会打开完整对话窗口，也不会轮询 Host。

### 开发说明

<details>
<summary>维护者工作上下文——点击展开</summary>

该 bundle 面向 `0.1.2-alpha.1` Client service vocabulary，并明确不为已删除的 `dsh-client-runtime` 包提供兼容路径。独立版 devDependencies 固定代码已验证的 `@deepseek-ai/dsh-*` 快照（`0.1.2-alpha.3`）；peerDependencies 保持 `>=0.1.2-alpha.1`。goal 包仅用于开发时的类型检查；bundle 不会挂载该服务或新增浏览器外部依赖。目标展示已针对已发布的 `0.1.2-alpha.3` 投影验证。要升级到更新的 alpha，请把 devDependencies 提升到最新发布的 `0.1.2-alpha.x`，重新运行测试套件，并把结果作为新版本发布。

</details>

诊断面板提供 API 能力说明，不执行实时健康检查。只有任务数量卡片可按状态筛选；Token、成本、上下文和工作区汇总仅用于展示。刷新、筛选设置写入和手动移动失败时，看板会显示错误。手动移动只接受已知的空白 Inbox/Ready 任务。
