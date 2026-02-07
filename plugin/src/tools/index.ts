/**
 * Pincer Agent Tools
 * All tools are optional - must be enabled via tools.allow
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi, ToolDefinition, ToolResult } from "../../types.js";
import type { ConnectionStore } from "../connection-store.js";

export function createPincerTools(
  store: ConnectionStore,
  api: OpenClawPluginApi
): ToolDefinition[] {
  return [
    createTabsTool(store),
    createContextTool(store),
    createSnapshotTool(store),
    createClickTool(store),
    createTypeTool(store),
    createHighlightTool(store),
    createScrollTool(store),
    createNavigateTool(store),
  ];
}

// ============================================================
// pincer_tabs - List connected browser tabs
// ============================================================

function createTabsTool(store: ConnectionStore): ToolDefinition {
  return {
    name: "pincer_tabs",
    description:
      "List browser tabs connected via Pincer extension. Shows tab ID, URL, title, and last activity.",
    parameters: Type.Object({}),

    async execute(_id, _params): Promise<ToolResult> {
      const tabs = store.list().map((conn) => ({
        id: conn.id,
        tabId: conn.tabId,
        url: conn.url,
        title: conn.title,
        lastActivity: new Date(conn.lastActivity).toISOString(),
        hasContext: !!conn.context,
      }));

      if (tabs.length === 0) {
        return {
          content: [{ type: "text", text: "No browser tabs connected. User needs to install and enable the Pincer extension." }],
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(tabs, null, 2),
        }],
      };
    },
  };
}

// ============================================================
// pincer_context - Get page context from a tab
// ============================================================

function createContextTool(store: ConnectionStore): ToolDefinition {
  return {
    name: "pincer_context",
    description:
      "Get the current page context (URL, title, visible text, selected text) from a connected browser tab.",
    parameters: Type.Object({
      tabId: Type.Optional(Type.String({
        description: "Tab connection ID. If not provided, uses the most recently active tab.",
      })),
      refresh: Type.Optional(Type.Boolean({
        description: "Request fresh context from the browser (default: use cached).",
      })),
    }),

    async execute(_id, params): Promise<ToolResult> {
      const connId = params.tabId as string | undefined;
      const refresh = params.refresh as boolean | undefined;

      const conn = connId ? store.get(connId) : store.getActive();

      if (!conn) {
        return {
          content: [{ type: "text", text: "No browser tab connected or found." }],
          isError: true,
        };
      }

      if (refresh) {
        // Request fresh context from browser
        try {
          const result = await store.sendCommand(conn.id, {
            type: "get_context",
            requestId: `ctx-${Date.now()}`,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `Failed to get context: ${err}` }],
            isError: true,
          };
        }
      }

      // Return cached context
      if (!conn.context) {
        return {
          content: [{ type: "text", text: `Tab connected but no context cached. URL: ${conn.url}` }],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(conn.context, null, 2) }],
      };
    },
  };
}

// ============================================================
// pincer_snapshot - Get DOM snapshot with element refs
// ============================================================

function createSnapshotTool(store: ConnectionStore): ToolDefinition {
  return {
    name: "pincer_snapshot",
    description:
      "Get a DOM snapshot from the browser tab with element references for clicking/typing.",
    parameters: Type.Object({
      tabId: Type.Optional(Type.String({
        description: "Tab connection ID. If not provided, uses the most recently active tab.",
      })),
    }),

    async execute(_id, params): Promise<ToolResult> {
      const conn = params.tabId
        ? store.get(params.tabId as string)
        : store.getActive();

      if (!conn) {
        return {
          content: [{ type: "text", text: "No browser tab connected." }],
          isError: true,
        };
      }

      try {
        const result = await store.sendCommand(conn.id, {
          type: "get_snapshot",
          requestId: `snap-${Date.now()}`,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to get snapshot: ${err}` }],
          isError: true,
        };
      }
    },
  };
}

// ============================================================
// pincer_click - Click an element
// ============================================================

function createClickTool(store: ConnectionStore): ToolDefinition {
  return {
    name: "pincer_click",
    description: "Click an element in the browser by reference ID (from pincer_snapshot) or CSS selector.",
    parameters: Type.Object({
      tabId: Type.Optional(Type.String({ description: "Tab connection ID." })),
      ref: Type.Optional(Type.String({ description: "Element reference from snapshot (e.g., 'e12')." })),
      selector: Type.Optional(Type.String({ description: "CSS selector (fallback if ref not provided)." })),
    }),

    async execute(_id, params): Promise<ToolResult> {
      const conn = params.tabId
        ? store.get(params.tabId as string)
        : store.getActive();

      if (!conn) {
        return { content: [{ type: "text", text: "No browser tab connected." }], isError: true };
      }

      if (!params.ref && !params.selector) {
        return { content: [{ type: "text", text: "Either ref or selector required." }], isError: true };
      }

      try {
        const result = await store.sendCommand(conn.id, {
          type: "click",
          requestId: `click-${Date.now()}`,
          ref: params.ref,
          selector: params.selector,
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Click failed: ${err}` }], isError: true };
      }
    },
  };
}

// ============================================================
// pincer_type - Type text into an element
// ============================================================

function createTypeTool(store: ConnectionStore): ToolDefinition {
  return {
    name: "pincer_type",
    description: "Type text into an input field or editable element.",
    parameters: Type.Object({
      tabId: Type.Optional(Type.String({ description: "Tab connection ID." })),
      ref: Type.Optional(Type.String({ description: "Element reference from snapshot." })),
      selector: Type.Optional(Type.String({ description: "CSS selector." })),
      text: Type.String({ description: "Text to type." }),
    }),

    async execute(_id, params): Promise<ToolResult> {
      const conn = params.tabId
        ? store.get(params.tabId as string)
        : store.getActive();

      if (!conn) {
        return { content: [{ type: "text", text: "No browser tab connected." }], isError: true };
      }

      try {
        const result = await store.sendCommand(conn.id, {
          type: "type",
          requestId: `type-${Date.now()}`,
          ref: params.ref,
          selector: params.selector,
          text: params.text,
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Type failed: ${err}` }], isError: true };
      }
    },
  };
}

// ============================================================
// pincer_highlight - Highlight an element visually
// ============================================================

function createHighlightTool(store: ConnectionStore): ToolDefinition {
  return {
    name: "pincer_highlight",
    description: "Highlight an element in the browser for the user to see.",
    parameters: Type.Object({
      tabId: Type.Optional(Type.String({ description: "Tab connection ID." })),
      ref: Type.Optional(Type.String({ description: "Element reference from snapshot." })),
      selector: Type.Optional(Type.String({ description: "CSS selector." })),
      duration: Type.Optional(Type.Number({ description: "Highlight duration in ms (default: 2000)." })),
    }),

    async execute(_id, params): Promise<ToolResult> {
      const conn = params.tabId
        ? store.get(params.tabId as string)
        : store.getActive();

      if (!conn) {
        return { content: [{ type: "text", text: "No browser tab connected." }], isError: true };
      }

      try {
        const result = await store.sendCommand(conn.id, {
          type: "highlight",
          requestId: `hl-${Date.now()}`,
          ref: params.ref,
          selector: params.selector,
          options: { duration: params.duration },
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Highlight failed: ${err}` }], isError: true };
      }
    },
  };
}

// ============================================================
// pincer_scroll - Scroll the page or to an element
// ============================================================

function createScrollTool(store: ConnectionStore): ToolDefinition {
  return {
    name: "pincer_scroll",
    description: "Scroll the page up/down or scroll an element into view.",
    parameters: Type.Object({
      tabId: Type.Optional(Type.String({ description: "Tab connection ID." })),
      ref: Type.Optional(Type.String({ description: "Element reference to scroll into view." })),
      direction: Type.Optional(Type.String({ description: "Scroll direction: 'up' or 'down' (default: down)." })),
    }),

    async execute(_id, params): Promise<ToolResult> {
      const conn = params.tabId
        ? store.get(params.tabId as string)
        : store.getActive();

      if (!conn) {
        return { content: [{ type: "text", text: "No browser tab connected." }], isError: true };
      }

      try {
        const result = await store.sendCommand(conn.id, {
          type: "scroll",
          requestId: `scroll-${Date.now()}`,
          ref: params.ref,
          options: { direction: params.direction },
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Scroll failed: ${err}` }], isError: true };
      }
    },
  };
}

// ============================================================
// pincer_navigate - Navigate to a URL
// ============================================================

function createNavigateTool(store: ConnectionStore): ToolDefinition {
  return {
    name: "pincer_navigate",
    description: "Navigate the browser tab to a URL.",
    parameters: Type.Object({
      tabId: Type.Optional(Type.String({ description: "Tab connection ID." })),
      url: Type.String({ description: "URL to navigate to." }),
    }),

    async execute(_id, params): Promise<ToolResult> {
      const conn = params.tabId
        ? store.get(params.tabId as string)
        : store.getActive();

      if (!conn) {
        return { content: [{ type: "text", text: "No browser tab connected." }], isError: true };
      }

      try {
        const result = await store.sendCommand(conn.id, {
          type: "navigate",
          requestId: `nav-${Date.now()}`,
          url: params.url,
        });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Navigate failed: ${err}` }], isError: true };
      }
    },
  };
}
