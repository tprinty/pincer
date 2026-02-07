/**
 * Pincer Protocol - Message types between extension and OpenClaw
 */

// ============================================================
// Pincer → OpenClaw Messages
// ============================================================

export interface PageContext {
  url: string;
  title: string;
  favicon?: string;
  selectedText?: string;
  visibleText?: string;
  meta?: Record<string, string>;
}

export interface DomSnapshot {
  html?: string;
  accessibility?: AccessibilityNode[];
  elements?: ElementInfo[];
}

export interface AccessibilityNode {
  role: string;
  name: string;
  ref: string;
  children?: AccessibilityNode[];
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

export interface ScreenshotData {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

export type PincerMessageType =
  | 'connect'
  | 'disconnect'
  | 'page_context'
  | 'selection'
  | 'screenshot'
  | 'dom_snapshot'
  | 'click_event'
  | 'scroll_event'
  | 'command_result';

export interface PincerMessage {
  type: PincerMessageType;
  tabId: number;
  url: string;
  timestamp: number;
  requestId?: string;
  payload: unknown;
}

// ============================================================
// OpenClaw → Pincer Commands
// ============================================================

export type ClawCommandType =
  | 'get_context'
  | 'get_snapshot'
  | 'screenshot'
  | 'highlight'
  | 'click'
  | 'type'
  | 'scroll'
  | 'navigate'
  | 'execute';

export interface ClawCommand {
  type: ClawCommandType;
  requestId: string;
  tabId?: number;
  selector?: string;
  ref?: string;
  coordinates?: { x: number; y: number };
  text?: string;
  url?: string;
  script?: string;
  options?: Record<string, unknown>;
}

// ============================================================
// Connection State
// ============================================================

export interface ConnectionState {
  connected: boolean;
  gatewayUrl: string;
  lastPing?: number;
  tabCount: number;
  activeTabId?: number;
}

// ============================================================
// Storage Schema
// ============================================================

export interface PincerConfig {
  gateway: {
    url: string;
    token?: string;
  };
  autoConnect: boolean;
  sendOnTabSwitch: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

export const DEFAULT_CONFIG: PincerConfig = {
  gateway: {
    url: 'ws://localhost:18789/pincer',
  },
  autoConnect: true,
  sendOnTabSwitch: true,
};
