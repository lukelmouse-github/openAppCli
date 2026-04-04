# OpenAppCli

[中文文档](./README_CN.md)

> **AI explores any app, automatically wraps its capabilities into CLI, and accumulates reusable assets.**

**Works with ANY app** — including WeChat, banking apps, WebView, Flutter, and security-protected apps. When UI inspection is blocked, AI uses screenshot + tap coordinates as fallback. No app is off-limits.

OpenAppCli enables AI agents to autonomously discover, automate, and package any app's functionality into reusable command-line tools — no app modification, no root, no manual scripting.

## Why OpenAppCli?

**The Problem**: Every app is a capability silo. To automate it, you need to manually write scripts, maintain them, and repeat for each app.

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
- Works with **any** app out of the box
- No app source code or modification needed
- No special privileges or jailbreak required

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
git clone https://github.com/lukelmouse-github/openAppCli.git
cd openAppCli && npm install && npm run build && npm link

# Use
openapp list                                  # List available plugins
openapp run xiaoyuzhou/search --keyword=AI    # Run a plugin
```

### Prerequisites
- Node.js 18+
- Device with USB debugging enabled (Android currently supported, iOS planned)

## How It Works

```
┌─────────────┐     CLI      ┌─────────────┐    Device    ┌─────────────┐
│  AI Agent   │ ──────────▶  │  openapp    │ ──────────▶  │     Any     │
│  (Claude)   │ ◀──────────  │    CLI      │ ◀──────────  │     App     │
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
openapp screenshot [path] # Capture screen image
openapp click <selector> # Click element by selector
openapp tap <x> <y>      # Tap at normalized coordinates (0-1000)
openapp type <text>      # Type text
openapp scroll <dir>     # Scroll up/down/left/right
openapp back/home/enter  # Navigation
```

### Normalized Coordinates

All coordinates use a **0-1000 normalized range**, making scripts device-independent:

```bash
openapp tap 500 500      # Center of screen (any device)
openapp tap 950 50       # Top-right corner
```

The system automatically converts to physical pixels based on screen resolution.

### Selectors
```bash
openapp click 'text=Search'
openapp click 'resourceId=com.app:id/btn'
openapp click 'contentDesc=Menu'
openapp click '@e0'    # ref from snapshot
```

## Plugin System

Plugins are reusable automation scripts stored in `plugins/` directory.

### Plugin Types

| Type | Location | Description |
|------|----------|-------------|
| **Universal** | `plugins/<app>/<action>.ad` | Uses semantic selectors, cross-device, shareable |
| **Personal** | `plugins/.personal/<app>/<action>.ad` | Uses tap coordinates, device-specific, git-ignored |

### Universal Plugin (Recommended)

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

### Personal Plugin (Device-Specific)

For apps with WebView or non-standard UI where semantic selectors don't work:

```bash
# @name Search (Tap Version)
# @description Search using coordinates
# @app SomeApp
# @package com.example.app
# @device 5cbab8d9
# @params keyword

context platform=android
open com.example.app
wait 2000
tap 500 120    # Search button position
wait 500
type {{keyword}}
tap 900 120    # Submit button
snapshot
```

**Note**: 
- Personal plugins are stored in `plugins/.personal/` which is git-ignored
- They fail with a clear error if run on a different device:
```json
{"error": "Device mismatch", "required": "5cbab8d9", "connected": "other-device"}
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

## Features

### Auto Popup Dismissal
OpenAppCli automatically detects and dismisses common popups (ads, permission dialogs, tips) using semantic rules before taking snapshots.

### Change Detection
Each snapshot includes a `changed` flag indicating whether the UI changed since the last snapshot — useful for detecting if an action had effect.

### Screenshot Support
When semantic selectors fail (WebView, Flutter, custom UI), use screenshots for AI vision analysis:
```bash
openapp screenshot /tmp/screen.png
# AI can analyze the image and use tap coordinates
```

## Universal Compatibility

OpenAppCli works with **ANY APP** through a two-layer approach:

| App Type | Method | Examples |
|----------|--------|----------|
| Apps with accessible UI | UI inspection (semantic selectors) | Most apps |
| Security-protected / UI-blocked apps | Screenshot + tap coordinates | WeChat, banking apps, WebView, Flutter |

**No app is off-limits.** When an app blocks UI inspection, AI automatically falls back to visual analysis with screenshots and normalized coordinates.

### Platform Support

| Platform | Status |
|----------|--------|
| Android | Fully supported |
| iOS | Planned for future release |

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

**The key insight**: AI doesn't just use apps — it **wraps them into CLI tools**. Each interaction accumulates as a reusable asset, building an ever-growing library of app automations.

## License

Apache 2.0

## Contributing

Contributions welcome! Areas of interest:
- New app plugins  
- Platform support (iOS, web, desktop)
- Improved UI recognition
