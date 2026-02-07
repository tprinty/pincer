/**
 * Pincer Plugin - Browser Extension Bridge for OpenClaw
 *
 * Registers:
 * - WebSocket handler at /pincer for browser extension connections
 * - Agent tools for interacting with connected browser tabs
 */

import type { OpenClawPluginApi } from "./types.js";
import { createConnectionStore } from "./src/connection-store.js";
import { createWsHandler } from "./src/ws-handler.js";
import { createPincerTools } from "./src/tools/index.js";

export interface PincerConfig {
  enabled?: boolean;
  autoAcceptTabs?: boolean;
  pushContextOnSwitch?: boolean;
  allowedOrigins?: string[];
  wsPath?: string;
}

const DEFAULT_CONFIG: PincerConfig = {
  enabled: true,
  autoAcceptTabs: true,
  pushContextOnSwitch: true,
  allowedOrigins: ["http://localhost:*", "https://localhost:*"],
  wsPath: "/pincer",
};

export default function register(api: OpenClawPluginApi) {
  const pluginConfig = {
    ...DEFAULT_CONFIG,
    ...(api.pluginConfig as PincerConfig),
  };

  if (!pluginConfig.enabled) {
    api.log?.info("[Pincer] Plugin disabled");
    return;
  }

  // Create shared connection store
  const store = createConnectionStore();

  // Register WebSocket handler
  const wsHandler = createWsHandler(store, pluginConfig, api);
  api.registerHttpHandler({
    method: "GET",
    path: pluginConfig.wsPath || "/pincer",
    handler: wsHandler,
    upgrade: "websocket",
  });

  // Register agent tools (optional - must be enabled in tools.allow)
  const tools = createPincerTools(store, api);
  for (const tool of tools) {
    api.registerTool(tool, { optional: true });
  }

  api.log?.info(`[Pincer] Plugin loaded, WebSocket at ${pluginConfig.wsPath}`);
}
