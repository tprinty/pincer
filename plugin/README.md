# Pincer Plugin for OpenClaw

OpenClaw plugin that enables the Pincer browser extension to communicate with your AI assistant.

## Installation

### From local path (development)

```bash
openclaw plugins install --path /path/to/pincer/plugin
```

### From npm (when published)

```bash
openclaw plugins install @openclaw/pincer
```

## Configuration

Add to your OpenClaw config:

```json
{
  "plugins": {
    "entries": {
      "pincer": {
        "enabled": true,
        "config": {
          "autoAcceptTabs": true,
          "pushContextOnSwitch": true,
          "wsPath": "/pincer"
        }
      }
    }
  }
}
```

## Enabling Tools

Pincer tools are optional. Enable them in your agent config:

```json
{
  "agents": {
    "list": [{
      "id": "main",
      "tools": {
        "alsoAllow": ["pincer"]
      }
    }]
  }
}
```

Or enable specific tools:

```json
{
  "tools": {
    "alsoAllow": [
      "pincer_tabs",
      "pincer_context", 
      "pincer_snapshot",
      "pincer_click",
      "pincer_type"
    ]
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `pincer_tabs` | List connected browser tabs |
| `pincer_context` | Get page URL, title, text, selection |
| `pincer_snapshot` | Get DOM with clickable element refs |
| `pincer_click` | Click an element by ref or selector |
| `pincer_type` | Type text into an input field |
| `pincer_highlight` | Visually highlight an element |
| `pincer_scroll` | Scroll page or element into view |
| `pincer_navigate` | Navigate to a URL |

## How It Works

1. User installs Pincer browser extension
2. Extension connects to OpenClaw Gateway via WebSocket (`ws://localhost:18789/pincer`)
3. Plugin tracks connected tabs and their page context
4. Agent can use `pincer_*` tools to interact with browser tabs

## Security

- WebSocket only accepts connections from localhost by default
- Gateway token authentication supported
- All browser actions (click, type) are logged
- No silent actions - user can see highlights before clicks

## Development

```bash
# Test the plugin locally
cd pincer/plugin
openclaw plugins install --path .

# Check if loaded
openclaw plugins list
```
