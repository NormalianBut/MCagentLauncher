# MCagentlauncher 项目总体计划书 v2

版本：v0.2-draft  
日期：2026-07-08  
项目代号：**MCagentlauncher**  
阶段名称：**v0.1 - Natural Instance**  
项目性质：开源、社区驱动、去商业大模型强依赖  
技术链路：**GitHub–Vercel–Supabase–MCAgent–Desktop**

---

## 0. 项目一句话定义

**MCagentlauncher 是一个面向 Minecraft 社区的开源智能启动器项目。它通过开放的 MCAgent、社区知识库和确定性规则引擎，让玩家可以用自然语言配置、维护和修复游戏实例，同时把真实问题沉淀为社区共享的模型能力。**

更短的表达：

> 让“描述想玩什么”成为 Minecraft 启动器的新入口。

---

## 1. 项目定位

MCagentlauncher 不是传统启动器的 AI 插件，也不是 PCL/HMCL/Prism 的“+AI”版本。

它是一种新的启动器范式：

```text
玩家描述想玩什么
    ↓
MCAgent 解析需求
    ↓
资源解析器查询真实资源
    ↓
规则引擎确定性校验
    ↓
生成可审查配置方案
    ↓
用户确认
    ↓
桌面端本地执行器安装与配置
    ↓
启动前检查
    ↓
启动 Minecraft
    ↓
后续反馈调整
```

传统启动器默认用户知道“我要装什么”。  
MCagentlauncher 默认用户只知道“我想玩什么”。

---

## 2. 完整技术链路

本项目采用：

```text
GitHub–Vercel–Supabase–MCAgent–Desktop
```

而不是单纯的 GitHub–Vercel–Supabase。

### 2.1 GitHub

GitHub 是项目协作和发布中枢。

职责：

- 代码托管；
- Issue；
- Pull Request；
- GitHub Actions；
- Release；
- 项目看板；
- 贡献者协作；
- 桌面端构建产物发布。

不负责：

- AI 推理；
- 社区数据存储主库；
- Minecraft 资源镜像；
- 用户本地实例操作。

### 2.2 Vercel

Vercel 是项目 Web 层。

职责：

- 官网；
- 文档站；
- Roadmap；
- Web 控制台；
- 规则/别名贡献入口；
- PR Preview；
- 轻量 API；
- Supabase 数据展示前端。

不负责：

- GPU 模型推理；
- Minecraft 资源镜像；
- 长时间后台任务；
- 用户本地文件操作；
- 桌面端执行逻辑。

### 2.3 Supabase

Supabase 是社区数据层。

职责：

- Postgres；
- Auth；
- Storage；
- Edge Functions；
- 社区别名库；
- 社区规则库；
- 匿名配置案例；
- 匿名错误案例；
- 模型评测样本索引；
- 社区节点列表；
- 审核状态。

不负责：

- GPU 模型推理；
- Minecraft 资源分发；
- 桌面端安装执行；
- 未脱敏日志存储；
- 商业大模型强绑定。

### 2.4 MCAgent Inference Endpoint

MCAgent Endpoint 是独立的 AI 推理服务。

职责：

- `parse_intent`；
- `plan_resources`；
- `explain_plan`；
- 后续 `diagnose_log`；
- 后续 `repair_plan`；
- 接入开源模型；
- 支持自托管；
- 支持社区节点；
- 支持规则模式降级。

不负责：

- 直接写入用户文件；
- 直接下载资源；
- 直接删除文件；
- 绕过规则引擎；
- 保存未脱敏隐私数据。

### 2.5 Desktop Local Executor

Desktop Local Executor 是本项目的可信执行层。

职责：

- 创建实例；
- 安装 Minecraft；
- 安装 Fabric；
- 下载 mods/resourcepacks/shaderpacks；
- Hash 校验；
- 写入配置；
- 生成 lockfile；
- 启动前检查；
- 启动 Minecraft；
- 捕获日志；
- 快照与回滚。

不负责：

- 训练模型；
- 存储社区数据库；
- 维护公共知识库；
- 充当资源平台镜像。

---

## 3. 核心原则

### 3.1 AI 不直接执行

MCAgent 只生成计划，不直接执行。

允许：

- 解析需求；
- 生成方案；
- 解释原因；
- 提供修复建议。

不允许：

- 直接执行命令；
- 直接删除文件；
- 直接写入实例；
- 直接下载未知文件；
- 直接绕过资源平台规则。

### 3.2 程序化校验优先

资源兼容性必须由规则引擎和真实元数据判断：

- Minecraft 版本；
- 加载器；
- 依赖；
- 文件 hash；
- 发布类型；
- 资源类型；
- 冲突；
- 来源；
- 许可证提示。

### 3.3 用户确认优先

任何安装动作必须展示给用户：

- 安装什么；
- 为什么安装；
- 来源哪里；
- 风险是什么；
- 是否 required；
- 是否可回滚。

### 3.4 隐私优先

日志、路径、昵称、服务器地址等必须本地脱敏。

默认不上传完整日志。

### 3.5 去商业大模型强依赖

商业大模型最多作为：

- 开发期教师；
- 疑难案例辅助；
- 可选兜底；
- 数据标注辅助。

项目长期依赖：

- 开源 MCAgent；
- 社区数据；
- 规则库；
- 别名库；
- 自托管节点。

---

## 4. v0.1 目标

v0.1 名称：

```text
MCagentlauncher v0.1 - Natural Instance
```

目标：

> 用户输入一句自然语言需求，系统生成可审查的资源配置方案，并在用户确认后创建一个真实可启动的 Minecraft Fabric 实例。

主链路：

```text
自然语言
    ↓
intent.json
    ↓
resource-plan.json
    ↓
install-action.json
    ↓
Desktop Local Executor
    ↓
instance-lock.json
    ↓
启动 Minecraft
```

---

## 5. v0.1 范围

### 支持

- Minecraft Java Edition；
- Windows 优先；
- Fabric 优先；
- Modrinth 优先；
- mods；
- 初步支持 resourcepacks；
- 初步支持 shaderpacks；
- 1.20.1 和 1.21.x 优先；
- 低配优化；
- 光影生存；
- 小地图；
- 苹果皮；
- 轻量建筑辅助；
- 原版增强。

### 不支持或不作为主目标

- Forge 完整支持；
- NeoForge 完整支持；
- CurseForge 完整自动下载；
- 服务端开服；
- 大型整合包生成；
- 完整自动修复；
- 模型训练平台；
- 多节点治理；
- 商业 API 强依赖；
- 资源镜像站。

---

## 6. 推荐仓库结构

采用 monorepo：

```text
mcagentlauncher/
├─ apps/
│  ├─ desktop/                 # Tauri 桌面启动器
│  └─ web/                     # Vercel 官网/文档/控制台
├─ crates/
│  ├─ instance/
│  ├─ installer/
│  ├─ launcher/
│  ├─ downloader/
│  ├─ lockfile/
│  ├─ snapshot/
│  └─ security/
├─ services/
│  └─ mcagent-server/          # 独立 MCAgent Endpoint
├─ packages/
│  ├─ schemas/
│  ├─ rules/
│  ├─ alias-db/
│  ├─ api-client/
│  └─ shared-types/
├─ supabase/
│  ├─ migrations/
│  ├─ functions/
│  └─ seed.sql
├─ datasets/
│  ├─ intent/
│  ├─ planning/
│  └─ logs/
├─ docs/
├─ examples/
├─ .github/
├─ README.md
└─ LICENSE
```

---

## 7. 推荐技术栈

### Desktop

```text
Tauri + React + TypeScript + Rust
```

### MCAgent Server

```text
Python + FastAPI
```

### Web

```text
Next.js + Vercel
```

### Data

```text
Supabase Postgres + Auth + Storage + Edge Functions
```

### Rule/Schemas

```text
JSON Schema + YAML/JSON Rules + TypeScript Validator
```

### Local Core

```text
Rust crates
```

---

## 8. Supabase 数据设计

v0.1 初始表：

### community_aliases

社区别名库。

### resource_rules

社区规则库。

### anonymous_cases

匿名配置/失败案例。

### model_eval_cases

模型评测样本索引。

### community_nodes

MCAgent 社区节点登记。

重要限制：

- 不保存完整未脱敏日志；
- 不保存用户本地完整路径；
- 不保存 access token；
- 不保存 Minecraft 资源文件；
- 不作为下载镜像。

---

## 9. Vercel Web 设计

页面：

```text
/
 /docs
 /roadmap
 /privacy
 /security
 /contribute
 /nodes
 /rules
 /aliases
```

用途：

- 介绍项目；
- 展示文档；
- 展示路线图；
- 提交别名；
- 提交规则；
- 查看节点；
- 查看贡献指南；
- 展示匿名案例统计。

不做：

- 本地启动器执行；
- Minecraft 下载；
- GPU 推理；
- 长任务执行。

---

## 10. MCAgent API

v0.1：

```http
GET  /health
POST /v1/intent/parse
POST /v1/resources/plan
POST /v1/explain/plan
```

v0.2：

```http
POST /v1/logs/diagnose
POST /v1/repair/plan
```

输出必须是可校验 JSON。

---

## 11. Desktop App 页面

v0.1 页面：

- Home；
- CreateInstance；
- PlanReview；
- InstallProgress；
- InstanceDetail；
- Settings。

核心入口：

```text
你想玩什么？
```

不是传统版本选择页。

---

## 12. v0.1 里程碑

### M0：仓库与文档

- monorepo；
- README；
- docs；
- GitHub templates；
- License draft。

### M1：Schema

- intent；
- resource-plan；
- install-action；
- instance-lock；
- examples；
- validator。

### M2：MCAgent Server Mock

- FastAPI；
- parse intent；
- plan generator；
- explain plan。

### M3：Resource Resolver

- alias-db；
- Modrinth API；
- version filter；
- loader filter；
- dependency MVP。

### M4：Desktop Mock

- 输入页；
- 方案页；
- 模拟安装流程。

### M5：Local Executor

- 实例目录；
- 下载；
- hash；
- lockfile。

### M6：Launch Smoke Test

- Java 检测；
- 启动命令；
- 日志捕获；
- 成功/失败状态。

---

## 13. v0.1 Definition of Done

v0.1 完成条件：

1. 用户输入自然语言；
2. 生成合法 intent；
3. 生成合法 resource-plan；
4. 能从 Modrinth 获取真实资源；
5. 能筛选 MC 版本和 Fabric；
6. 能展示方案；
7. 用户能确认；
8. 能创建实例；
9. 能下载资源；
10. 能 hash 校验；
11. 能生成 instance-lock；
12. 能尝试启动 Minecraft；
13. 不依赖商业大模型；
14. 不上传完整未脱敏日志；
15. 不绕过资源平台规则；
16. 本地执行器承担真实文件操作。

---

## 14. Codex 执行原则

Codex 必须遵守：

1. 先 Schema，后业务；
2. 先 mock，后真实 API；
3. 先 Fabric + Modrinth，不扩散；
4. MCAgent 不执行文件操作；
5. Desktop Local Executor 执行本地动作；
6. Vercel 只做 Web 层；
7. Supabase 只做社区数据层；
8. MCAgent Endpoint 独立；
9. 所有输出可校验；
10. 不提交 secret。
