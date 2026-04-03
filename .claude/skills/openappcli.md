# OpenAppCli

Turn Android apps into CLI tools for AI agents.

## When to Use

Use this when the user wants to:
- Automate any Android app (open, click, type, scroll)
- Extract data from Android app screens
- Create reusable app automation workflows

## Quick Start

```bash
# List available plugins
openapp list

# Run a plugin
openapp run <plugin-path> [--var key=value ...]
```

## Architecture

```
AI Agent (Claude)
    ↓ calls
openapp CLI
    ├── Plugins (preferred) ← reusable workflows
    └── Low-level commands  ← for exploration
```

**Workflow:**
1. `openapp list` - check available plugins
2. If plugin exists → `openapp run <plugin>`
3. If not → explore with low-level commands → create new plugin

## Commands

### Plugin Commands

```bash
openapp list                                    # List all plugins
openapp run xiaoyuzhou/search --keyword=AI      # Run plugin with params
```

### Low-level Commands (for exploration)

```bash
openapp devices              # List connected devices
openapp open <package>       # Open app by package name
openapp snapshot             # Get UI hierarchy (JSON)
openapp click <selector>     # Click element
openapp type <text>          # Type text (supports Chinese)
openapp scroll <direction>   # up/down/left/right
openapp back                 # Press back
openapp home                 # Press home
openapp enter                # Press enter/confirm
```

### Selectors

```bash
openapp click 'text=搜索'
openapp click 'resourceId=com.app:id/btn'
openapp click 'contentDesc=Search'
openapp click '@e0'          # ref from snapshot
```

## Plugin Format (.ad files)

Location: `plugins/<app>/<action>.ad`

```bash
# @name Display Name
# @description What this plugin does
# @app App Name
# @package com.example.app
# @params keyword: Search keyword

context platform=android
open com.example.app
wait 2000
click text=Search
type {{keyword}}
enter
wait 1500
snapshot
```

### Available Commands in .ad

- `context platform=android` - declare platform
- `open <package>` - open app
- `wait <ms>` - wait milliseconds
- `snapshot` - capture UI
- `click <selector>` - click element
- `type <text>` - type text (supports `{{variable}}`)
- `scroll <direction>` - scroll
- `back` / `home` / `enter` - navigation
- `pause "message"` - wait for user input
- `extract <mode>` - extract structured data

## Creating New Plugins

When no plugin exists:

1. Explore: `openapp open <package>` → `openapp snapshot`
2. Interact: `openapp click/type/scroll`
3. Repeat until task complete
4. Create `.ad` file with discovered steps
5. Test: `openapp run <plugin>`

## Limitations

- Some apps (WeChat, banking) block UI inspection
- ADBKeyboard required for Chinese input
- USB debugging must be enabled
