# OpenAppCli

[English](./README_EN.md)

> **把任何 Android 应用变成 AI 可调用的命令行。**

OpenAppCli 让 AI 代理能够控制**任何** Android 应用 —— 无需修改 App，无需 Root。

## 为什么需要 OpenAppCli？

**问题**：AI 代理可以浏览网页，但 90% 的移动应用功能被锁在原生 UI 背后，AI 无法触及。

**解决方案**：OpenAppCli 弥合了这一鸿沟。它赋予 AI 代理「眼睛」和「双手」，像人类一样操作任何 Android 应用。

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

### 探索 → 自动化 → 复用
```
AI 遇到新应用
       ↓
使用底层命令探索 (snapshot, click, type)
       ↓
发现操作流程
       ↓
保存为 .ad 插件，供未来复用
```

这是杀手级特性：**AI 学习一次，永久复用**。

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
openapp click <selector> # 点击元素
openapp type <text>      # 输入文本
openapp scroll <dir>     # 滚动 up/down/left/right
openapp back/home/enter  # 导航
```

### 选择器
```bash
openapp click 'text=搜索'
openapp click 'resourceId=com.app:id/btn'
openapp click 'contentDesc=菜单'
openapp click '@e0'    # snapshot 中的 ref
```

## 插件系统

插件是可复用的自动化脚本：`plugins/<app>/<action>.ad`

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

核心洞察：**每次新应用交互都会沉淀为可复用插件**，构建不断增长的 Android 应用自动化库。

## 许可证

Apache 2.0

## 贡献

欢迎贡献！感兴趣的方向：
- 新应用插件
- iOS 支持
- 改进元素识别
