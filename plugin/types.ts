/**
 * OpenClaw Plugin API types
 * These are the types available to plugins via the api parameter
 */

export interface OpenClawPluginApi {
  /** Plugin-specific config from plugins.entries.<id>.config */
  pluginConfig?: unknown;

  /** Full OpenClaw config (read-only) */
  config?: {
    agents?: {
      defaults?: {
        model?: { primary?: string };
        workspace?: string;
      };
    };
    gateway?: {
      port?: number;
      auth?: { token?: string };
    };
  };

  /** Logger */
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
    debug: (msg: string) => void;
  };

  /** Register an agent tool */
  registerTool: (
    tool: ToolDefinition,
    options?: { optional?: boolean }
  ) => void;

  /** Register an HTTP/WebSocket handler */
  registerHttpHandler: (handler: HttpHandler) => void;

  /** Send a system event to a session */
  sendSystemEvent?: (sessionKey: string, text: string) => Promise<void>;

  /** Request a heartbeat/wake for a session */
  requestHeartbeat?: (sessionKey: string) => void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: unknown; // TypeBox schema or JSON Schema
  execute: (id: string, params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  isError?: boolean;
}

export interface HttpHandler {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  handler: (req: unknown, res: unknown) => void | Promise<void>;
  upgrade?: "websocket";
}
