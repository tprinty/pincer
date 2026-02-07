/**
 * WebSocket Handler - Handles browser extension connections
 */

import type { IncomingMessage } from "http";
import type { WebSocket, WebSocketServer } from "ws";
import type { OpenClawPluginApi } from "../types.js";
import type { PincerConfig } from "../index.js";
import type { ConnectionStore, PageContext } from "./connection-store.js";
import { handleCommandResult } from "./connection-store.js";

interface PincerMessage {
  type: string;
  tabId: number;
  url: string;
  timestamp: number;
  requestId?: string;
  payload: unknown;
}

export function createWsHandler(
  store: ConnectionStore,
  config: PincerConfig,
  api: OpenClawPluginApi
) {
  return function handleUpgrade(ws: WebSocket, req: IncomingMessage) {
    const connId = generateId();

    api.log?.info(`[Pincer] New connection: ${connId}`);

    // Initial connection state
    let tabId: number | undefined;

    ws.on("message", (data: Buffer | string) => {
      try {
        const message: PincerMessage = JSON.parse(data.toString());
        handleMessage(connId, message);
      } catch (err) {
        api.log?.error(`[Pincer] Invalid message: ${err}`);
      }
    });

    ws.on("close", () => {
      api.log?.info(`[Pincer] Connection closed: ${connId}`);
      store.remove(connId);
    });

    ws.on("error", (err) => {
      api.log?.error(`[Pincer] WebSocket error: ${err}`);
      store.remove(connId);
    });

    function handleMessage(id: string, message: PincerMessage) {
      // Update tabId if provided
      if (message.tabId && !tabId) {
        tabId = message.tabId;
        store.add({
          id,
          tabId: message.tabId,
          url: message.url || "",
          title: "",
          ws,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        });
      }

      switch (message.type) {
        case "connect":
          api.log?.info(`[Pincer] Tab ${message.tabId} connected: ${message.url}`);
          break;

        case "disconnect":
          store.remove(id);
          break;

        case "page_context":
          handlePageContext(id, message.payload as PageContext);
          break;

        case "selection":
          handleSelection(id, message.payload as { text: string });
          break;

        case "command_result":
          if (message.requestId) {
            handleCommandResult(store, id, message.requestId, message.payload);
          }
          break;

        case "screenshot":
          // Store screenshot data for retrieval
          api.log?.debug(`[Pincer] Screenshot received from tab ${message.tabId}`);
          break;

        case "dom_snapshot":
          api.log?.debug(`[Pincer] DOM snapshot received from tab ${message.tabId}`);
          break;

        default:
          api.log?.debug(`[Pincer] Unknown message type: ${message.type}`);
      }
    }

    function handlePageContext(id: string, context: PageContext) {
      store.updateContext(id, {
        ...context,
        timestamp: Date.now(),
      });

      api.log?.debug(`[Pincer] Context updated: ${context.url}`);

      // If configured, push context to agent session
      if (config.pushContextOnSwitch && api.sendSystemEvent) {
        const summary = formatContextSummary(context);
        // Find the main session and send a subtle context update
        // This is non-blocking, just informational
      }
    }

    function handleSelection(id: string, payload: { text: string }) {
      const conn = store.get(id);
      if (conn && payload.text) {
        api.log?.debug(`[Pincer] Selection: "${payload.text.slice(0, 50)}..."`);
        // Could trigger a system event or store for tool access
      }
    }
  };
}

function generateId(): string {
  return `pincer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatContextSummary(context: PageContext): string {
  const parts = [`Browser tab: ${context.title || context.url}`];
  if (context.selectedText) {
    parts.push(`Selected: "${context.selectedText.slice(0, 100)}..."`);
  }
  return parts.join("\n");
}
