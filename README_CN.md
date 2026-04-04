# OpenAppCli

[English](./README.md)

> **AI 自主探索 Android 应用，自动封装能力为 CLI，沉淀为可复用资产。**

OpenAppCli 让 AI 代理能够自主发现、自动化并封装任何 Android 应用的功能为可复用的命令行工具 —— 无需修改 App，无需 Root，无需手写脚本。

## 为什么需要 OpenAppCli？

**问题**：每个 Android 应用都是一个能力孤岛。要自动化它，你需要手动编写脚本、维护它们，然后对每个应用重复这个过程。

**解决方案**：让 AI 来做这件事。OpenAppCli 赋予 AI 代理以下能力：
1. **探索**：自主发现任何应用的 UI
2. **封装**：将发现的工作流包装为 CLI 命令
3. **沉淀**：积累为可复用的插件，持续增长

```bash
# AI 现在可以这样做：
openapp run xiaoyuzhou/search --keyword=AI    # 搜索播客
openapp run taobao/search --keyword=iPhone    # 搜索商品  
openapp run weibo/trending                     # 获取热搜
```

## 核心特性

### 任何应用，零修改
- 开箱即用，支持**任何** Android 应用
- 无需应用源码或修改
- 无需 Root —— 只需开启 USB 调试

### AI 优先设计
- **结构化 JSON 输出**，AI 可靠解析
- **确定性结果**，适合自动化流水线
- **插件系统**，可复用的工作流

### 探索 → 封装 → 沉淀
```
AI 遇到新应用
       ↓
自主探索 UI (snapshot, click, type)
       ↓
发现并验证工作流
       ↓
封装为 .ad 插件 → 可复用的 CLI 资产
```

**杀手级特性**：每次 AI 与新应用的交互，都会沉淀为永久可复用的 CLI 工具。你的插件库自动增长。

### 完整中文支持
- 通过 ADBKeyboard 输入 Unicode 文本
- 中文 UI 元素识别
- 原生支持中文应用

## 快速开始

```bash
# 安装
git clone https://github.com/anthropics/openAppCli.git
cd openAppCli && npm install && npm run build && npm link

# 使用
openapp list                                  # 列出可用插件
openapp run xiaoyuzhou/search --keyword=AI    # 运行插件
```

### 环境要求
- Node.js 18+
- ADB 已添加到 PATH
- Android 设备已开启 USB 调试

## 工作原理

```
┌─────────────┐     CLI      ┌─────────────┐     ADB      ┌─────────────┐
│  AI 代理    │ ──────────▶  │  openapp    │ ──────────▶  │  Android    │
│  (Claude)   │ ◀──────────  │    CLI      │ ◀──────────  │    设备     │
└─────────────┘    JSON      └─────────────┘   UI Dump    └─────────────┘
```

1. AI 调用 `openapp snapshot` → 获取 UI 层级结构（JSON）
2. AI 分析元素，决定操作
3. AI 调用 `openapp click/type/scroll`
4. 重复直到任务完成
5. AI 将流程保存为 `.ad` 插件

## 命令

### 插件命令（推荐）
```bash
openapp list                              # 列出所有插件
openapp run <plugin> [--var key=value]    # 运行插件
```

### 底层命令（用于探索）
```bash
openapp devices          # 列出已连接设备
openapp open <package>   # 打开应用
openapp snapshot         # 获取 UI 层级（JSON）
openapp screenshot [path] # 截取屏幕图片
openapp click <selector> # 通过选择器点击元素
openapp tap <x> <y>      # 通过归一化坐标点击（0-1000）
openapp type <text>      # 输入文本
openapp scroll <dir>     # 滚动 up/down/left/right
openapp back/home/enter  # 导航
```

### 归一化坐标

所有坐标使用 **0-1000 归一化范围**，使脚本设备无关：

```bash
openapp tap 500 500      # 屏幕中心（任何设备）
openapp tap 950 50       # 右上角
```

系统会根据屏幕分辨率自动转换为物理像素。

### 选择器
```bash
openapp click 'text=搜索'
openapp click 'resourceId=com.app:id/btn'
openapp click 'contentDesc=菜单'
openapp click '@e0'    # snapshot 中的 ref
```

## 插件系统

插件是可复用的自动化脚本：`plugins/<app>/<action>.ad`

### 插件类型

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| **Universal（通用）** | 仅使用语义选择器 | 跨设备、可分享 |
| **Personal（私人）** | 通过 `@device` 绑定特定设备 | WebView、Flutter、设备专用 |

### Universal 插件（推荐）

```bash
# @name 搜索播客
# @description 在小宇宙中搜索
# @app 小宇宙
# @package app.podcast.cosmos
# @params keyword: 搜索关键词

context platform=android
open app.podcast.cosmos
wait 2000
click contentDesc=搜索页
type {{keyword}}
enter
wait 2000
snapshot
```

### Personal 插件（设备专用）

适用于 WebView 或非标准 UI（语义选择器无法工作时）：

```bash
# @name 搜索（坐标版）
# @description 使用坐标搜索
# @app 某应用
# @package com.example.app
# @device 5cbab8d9
# @params keyword

context platform=android
open com.example.app
wait 2000
tap 500 120    # 搜索按钮位置
wait 500
type {{keyword}}
tap 900 120    # 提交按钮
snapshot
```

**注意**：Personal 插件在其他设备上运行时会返回明确错误：
```json
{"error": "Device mismatch", "required": "5cbab8d9", "connected": "other-device"}
```

## 实际应用场景

### 播客搜索
```bash
openapp run xiaoyuzhou/search --keyword="人工智能"
# 返回：匹配的播客列表，包含标题、描述、播放量
```

### 电商比价
```bash
openapp run taobao/search --keyword="iPhone 15"
# 返回：商品列表，包含价格、评分、销量
```

### 社交媒体监控
```bash
openapp run weibo/trending
# 返回：当前热搜话题及热度指数
```

## 特性

### 自动弹窗清理
OpenAppCli 在获取快照前会自动检测并关闭常见弹窗（广告、权限弹窗、引导提示），使用语义规则识别。

### 变化检测
每次快照包含 `changed` 标志，指示 UI 是否自上次快照后发生变化 —— 用于检测操作是否生效。

### 截图支持
当语义选择器失效时（WebView、Flutter、自定义 UI），使用截图供 AI 视觉分析：
```bash
openapp screenshot /tmp/screen.png
# AI 可以分析图片并使用 tap 坐标
```

## 限制

| 限制 | 原因 |
|------|------|
| 微信、银行类应用 | 安全保护，阻止 UI 检查 |
| iOS | 暂不支持（计划中） |
| 模拟器 | 部分可用，推荐真机 |

## 面向 AI 开发者

OpenAppCli 专为 AI 代理设计。集成模式：

```python
# 伪代码
plugins = run("openapp list")
if matching_plugin_exists(user_request, plugins):
    result = run(f"openapp run {plugin} --var {params}")
else:
    # 探索模式
    run("openapp open com.example.app")
    ui = run("openapp snapshot")
    # AI 分析 UI，执行操作，创建插件
```

**核心洞察**：AI 不只是使用应用 —— 它**把应用封装成 CLI 工具**。每次交互都沉淀为可复用资产，构建不断增长的 Android 应用自动化库。

## 许可证

Apache 2.0

## 贡献

欢迎贡献！感兴趣的方向：
- 新应用插件
- iOS 支持
- 改进元素识别
