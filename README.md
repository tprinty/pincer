# Pincer 🦀

A browser extension that connects your browser to OpenClaw, enabling AI-assisted browsing with shared context.

## What It Does

Pincer grabs what you're seeing and sends it to your AI assistant:

- **Page Context** — URL, title, selected text, visible content
- **DOM Snapshots** — structured page data for navigation
- **Screenshots** — visual context when needed
- **Two-Way Control** — AI can highlight elements, scroll, click (with permission)

## Architecture

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│  Browser Tab    │◄──────────────────►│   OpenClaw      │
│  (Pincer ext)   │                    │   Gateway       │
└─────────────────┘                    └─────────────────┘
        │                                      │
        ▼                                      ▼
  Content Script                         AI Assistant
  - DOM access                           - Receives context
  - Event capture                        - Sends commands
  - Visual overlay                       - Processes pages
```

## Features

### Phase 1: Read Context
- [ ] Capture current page URL + title
- [ ] Extract selected text
- [ ] Get visible text content (cleaned)
- [ ] Take viewport screenshots
- [ ] Send page metadata on tab switch

### Phase 2: DOM Interaction
- [ ] Generate accessible DOM snapshot
- [ ] Element highlighting on hover
- [ ] Click-to-select elements
- [ ] Scroll position tracking

### Phase 3: AI Control
- [ ] AI-initiated element highlighting
- [ ] AI-requested clicks (with confirmation)
- [ ] Form filling assistance
- [ ] Navigation commands

### Phase 4: Advanced
- [ ] Multi-tab awareness
- [ ] Session persistence
- [ ] Custom page extractors
- [ ] Keyboard shortcuts

## Browser Support

- **Chrome/Chromium** (Manifest V3)
- **Firefox** (Manifest V2/V3 compatibility)

## Project Structure

```
pincer/
├── src/
│   ├── manifest.chrome.json    # Chrome manifest v3
│   ├── manifest.firefox.json   # Firefox manifest
│   ├── background/
│   │   └── service-worker.ts   # Background script
│   ├── content/
│   │   └── content.ts          # Content script (injected)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── lib/
│   │   ├── connection.ts       # WebSocket to OpenClaw
│   │   ├── context.ts          # Page context extraction
│   │   ├── dom.ts              # DOM utilities
│   │   └── protocol.ts         # Message types
│   └── assets/
│       └── icons/
├── dist/                        # Built extension
├── scripts/
│   └── build.ts                # Build script
├── package.json
├── tsconfig.json
└── README.md
```

## Protocol

Pincer communicates with OpenClaw via WebSocket:

```typescript
// Pincer → OpenClaw
interface PincerMessage {
  type: 'page_context' | 'selection' | 'screenshot' | 'dom_snapshot' | 'click' | 'scroll';
  tabId: number;
  url: string;
  timestamp: number;
  payload: unknown;
}

// OpenClaw → Pincer
interface ClawCommand {
  type: 'highlight' | 'click' | 'scroll' | 'screenshot' | 'get_context';
  selector?: string;
  coordinates?: { x: number; y: number };
  options?: unknown;
}
```

## Development

```bash
# Install dependencies
npm install

# Build for Chrome
npm run build:chrome

# Build for Firefox
npm run build:firefox

# Watch mode
npm run dev
```

## Configuration

Pincer connects to OpenClaw Gateway:

```json
{
  "gateway": {
    "url": "ws://localhost:18789",
    "token": "your-gateway-token"
  }
}
```

## Security

- **Permissions are minimal** — only activeTab + storage by default
- **No data leaves your machine** — connects to local OpenClaw
- **AI actions require confirmation** — no silent clicks
- **Allowlist support** — restrict to specific domains

## Project Structure

This repo contains two components:

### Browser Extension (`src/`)
Chrome/Firefox extension that runs in your browser.

### OpenClaw Plugin (`plugin/`)
Gateway plugin that handles WebSocket connections and exposes agent tools.

See [plugin/README.md](plugin/README.md) for plugin installation and configuration.

## License

MIT

---

Built with 🦀 by Tom & Echo
