# OpenAppCli

[中文文档](./README_CN.md)

> **AI explores Android apps, automatically wraps their capabilities into CLI, and accumulates reusable assets.**

OpenAppCli enables AI agents to autonomously discover, automate, and package any Android app's functionality into reusable command-line tools — no app modification, no root, no manual scripting.

## Why OpenAppCli?

**The Problem**: Every Android app is a capability silo. To automate it, you need to manually write scripts, maintain them, and repeat for each app.

**The Solution**: Let AI do the work. OpenAppCli gives AI agents the ability to:
1. **Explore** any app's UI autonomously
2. **Wrap** discovered workflows into CLI commands
3. **Accumulate** these as reusable plugins that grow over time

```bash
# AI can now do this:
openapp run xiaoyuzhou/search --keyword=AI    # Search podcasts
openapp run taobao/search --keyword=iPhone    # Search products  
openapp run weibo/trending                     # Get trending topics
```

## Key Features

### Any App, Zero Modification
- Works with **any** Android app out of the box
- No app source code or modification needed
- No root required — just USB debugging

### AI-First Design
- **Structured JSON output** for reliable AI parsing
- **Deterministic results** suitable for automation pipelines
- **Plugin system** for reusable workflows

### Explore → Wrap → Accumulate
```
AI encounters new app
       ↓
Explores UI autonomously (snapshot, click, type)
       ↓
Discovers and validates workflow
       ↓
Wraps as .ad plugin → Reusable CLI asset
```

**The killer feature**: Every AI interaction with a new app becomes a permanent, reusable CLI tool. Your plugin library grows automatically.

### Full Chinese Support
- Unicode text input via ADBKeyboard
- Chinese UI element recognition
- Works with Chinese apps natively

## Quick Start

```bash
# Install
git clone https://github.com/anthropics/openAppCli.git
cd openAppCli && npm install && npm run build && npm link

# Use
openapp list                                  # List available plugins
openapp run xiaoyuzhou/search --keyword=AI    # Run a plugin
```

### Prerequisites
- Node.js 18+
- ADB in PATH
- Android device with USB debugging enabled

## How It Works

```
┌─────────────┐     CLI      ┌─────────────┐     ADB      ┌─────────────┐
│  AI Agent   │ ──────────▶  │  openapp    │ ──────────▶  │  Android    │
│  (Claude)   │ ◀──────────  │    CLI      │ ◀──────────  │   Device    │
└─────────────┘    JSON      └─────────────┘   UI Dump    └─────────────┘
```

1. AI calls `openapp snapshot` → gets UI hierarchy as JSON
2. AI analyzes elements, decides action
3. AI calls `openapp click/type/scroll`
4. Repeat until task complete
5. AI saves workflow as `.ad` plugin

## Commands

### Plugin Commands (Preferred)
```bash
openapp list                              # List all plugins
openapp run <plugin> [--var key=value]    # Run plugin
```

### Low-level Commands (For Exploration)
```bash
openapp devices          # List connected devices
openapp open <package>   # Open app
openapp snapshot         # Get UI hierarchy (JSON)
openapp click <selector> # Click element
openapp type <text>      # Type text
openapp scroll <dir>     # Scroll up/down/left/right
openapp back/home/enter  # Navigation
```

### Selectors
```bash
openapp click 'text=Search'
openapp click 'resourceId=com.app:id/btn'
openapp click 'contentDesc=Menu'
openapp click '@e0'    # ref from snapshot
```

## Plugin System

Plugins are reusable automation scripts: `plugins/<app>/<action>.ad`

```bash
# @name Search Podcasts
# @description Search in Xiaoyuzhou app
# @app Xiaoyuzhou
# @package app.podcast.cosmos
# @params keyword: Search term

context platform=android
open app.podcast.cosmos
wait 2000
click contentDesc=Search
type {{keyword}}
enter
wait 2000
snapshot
```

## Real-World Examples

### Podcast Search
```bash
openapp run xiaoyuzhou/search --keyword="artificial intelligence"
# Returns: List of matching podcasts with titles, descriptions, play counts
```

### E-commerce Price Check
```bash
openapp run taobao/search --keyword="iPhone 15"
# Returns: Product listings with prices, ratings, sales volume
```

### Social Media Monitoring
```bash
openapp run weibo/trending
# Returns: Current trending topics with heat index
```

## Limitations

| Limitation | Reason |
|------------|--------|
| WeChat, Banking apps | Security-protected, blocks UI inspection |
| iOS | Not yet supported (planned) |
| Emulators | Some may work, physical device recommended |

## For AI Developers

OpenAppCli is designed as a tool for AI agents. Integration pattern:

```python
# Pseudocode
plugins = run("openapp list")
if matching_plugin_exists(user_request, plugins):
    result = run(f"openapp run {plugin} --var {params}")
else:
    # Exploration mode
    run("openapp open com.example.app")
    ui = run("openapp snapshot")
    # AI analyzes UI, performs actions, creates plugin
```

**The key insight**: AI doesn't just use apps — it **wraps them into CLI tools**. Each interaction accumulates as a reusable asset, building an ever-growing library of Android app automations.

## License

Apache 2.0

## Contributing

Contributions welcome! Areas of interest:
- New app plugins
- iOS support
- Improved element recognition
