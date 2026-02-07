/**
 * Connection Store - Tracks connected browser tabs
 */

import type { WebSocket } from "ws";

export interface TabConnection {
  id: string;
  tabId: number;
  url: string;
  title: string;
  ws: WebSocket;
  connectedAt: number;
  lastActivity: number;
  context?: PageContext;
}

export interface PageContext {
  url: string;
  title: string;
  selectedText?: string;
  visibleText?: string;
  meta?: Record<string, string>;
  timestamp: number;
}

export interface DomSnapshot {
  elements: ElementInfo[];
  timestamp: number;
}

export interface ElementInfo {
  ref: string;
  tag: string;
  id?: string;
  classes?: string[];
  text?: string;
  rect: { x: number; y: number; width: number; height: number };
  attributes?: Record<string, string>;
}

export interface ConnectionStore {
  /** Add a new tab connection */
  add(conn: TabConnection): void;

  /** Remove a connection by id */
  remove(id: string): void;

  /** Get a connection by id */
  get(id: string): TabConnection | undefined;

  /** Get connection by tabId */
  getByTabId(tabId: number): TabConnection | undefined;

  /** List all connections */
  list(): TabConnection[];

  /** Update context for a connection */
  updateContext(id: string, context: PageContext): void;

  /** Get the most recently active connection */
  getActive(): TabConnection | undefined;

  /** Send a command to a tab */
  sendCommand(id: string, command: PincerCommand): Promise<unknown>;

  /** Subscribe to context updates */
  onContextUpdate(handler: (conn: TabConnection, context: PageContext) => void): void;
}

export interface PincerCommand {
  type: string;
  requestId: string;
  [key: string]: unknown;
}

export function createConnectionStore(): ConnectionStore {
  const connections = new Map<string, TabConnection>();
  const pendingCommands = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  const contextHandlers: Array<(conn: TabConnection, context: PageContext) => void> = [];

  return {
    add(conn: TabConnection) {
      connections.set(conn.id, conn);
    },

    remove(id: string) {
      const conn = connections.get(id);
      if (conn) {
        connections.delete(id);
        // Clean up any pending commands for this connection
        for (const [reqId, pending] of pendingCommands) {
          if (reqId.startsWith(id)) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("Connection closed"));
            pendingCommands.delete(reqId);
          }
        }
      }
    },

    get(id: string) {
      return connections.get(id);
    },

    getByTabId(tabId: number) {
      for (const conn of connections.values()) {
        if (conn.tabId === tabId) {
          return conn;
        }
      }
      return undefined;
    },

    list() {
      return Array.from(connections.values());
    },

    updateContext(id: string, context: PageContext) {
      const conn = connections.get(id);
      if (conn) {
        conn.context = context;
        conn.lastActivity = Date.now();
        conn.url = context.url;
        conn.title = context.title;

        // Notify handlers
        for (const handler of contextHandlers) {
          try {
            handler(conn, context);
          } catch (err) {
            console.error("[Pincer] Context handler error:", err);
          }
        }
      }
    },

    getActive() {
      let active: TabConnection | undefined;
      let maxActivity = 0;

      for (const conn of connections.values()) {
        if (conn.lastActivity > maxActivity) {
          maxActivity = conn.lastActivity;
          active = conn;
        }
      }

      return active;
    },

    async sendCommand(id: string, command: PincerCommand): Promise<unknown> {
      const conn = connections.get(id);
      if (!conn) {
        throw new Error(`Connection not found: ${id}`);
      }

      if (conn.ws.readyState !== 1) { // WebSocket.OPEN
        throw new Error(`Connection not open: ${id}`);
      }

      return new Promise((resolve, reject) => {
        const requestId = `${id}:${command.requestId}`;
        const timeout = setTimeout(() => {
          pendingCommands.delete(requestId);
          reject(new Error("Command timeout"));
        }, 30000);

        pendingCommands.set(requestId, { resolve, reject, timeout });

        conn.ws.send(JSON.stringify(command));
      });
    },

    onContextUpdate(handler) {
      contextHandlers.push(handler);
    },
  };
}

/**
 * Handle a command result from the browser
 */
export function handleCommandResult(
  store: ConnectionStore,
  connId: string,
  requestId: string,
  result: unknown
) {
  const fullId = `${connId}:${requestId}`;
  const pending = (store as any).pendingCommands?.get(fullId);
  if (pending) {
    clearTimeout(pending.timeout);
    pending.resolve(result);
    (store as any).pendingCommands?.delete(fullId);
  }
}
