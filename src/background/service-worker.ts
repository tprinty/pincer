/**
 * Pincer Background Service Worker
 * Manages WebSocket connection to OpenClaw and coordinates tabs
 */

import { GatewayConnection, type ConnectionStatus } from '../lib/connection';
import type { PincerMessage, ClawCommand, PincerConfig, DEFAULT_CONFIG } from '../lib/protocol';

let connection: GatewayConnection | null = null;
let config: PincerConfig = { ...DEFAULT_CONFIG };

// Track active tabs
const activeTabs = new Map<number, { url: string; title: string }>();

/**
 * Initialize the extension
 */
async function init() {
  // Load config from storage
  const stored = await chrome.storage.local.get('config');
  if (stored.config) {
    config = { ...config, ...stored.config };
  }

  // Connect to gateway
  if (config.autoConnect) {
    connect();
  }

  // Listen for tab changes
  chrome.tabs.onActivated.addListener(handleTabActivated);
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  chrome.tabs.onRemoved.addListener(handleTabRemoved);

  console.log('[Pincer] Background service worker initialized');
}

/**
 * Connect to OpenClaw Gateway
 */
function connect() {
  if (connection?.status === 'connected') return;

  connection = new GatewayConnection(config, {
    onStatusChange: (status) => {
      broadcastStatus(status);
    },
    onCommand: handleCommand,
    onError: (error) => {
      console.error('[Pincer] Connection error:', error);
    },
  });

  connection.connect();
}

/**
 * Disconnect from Gateway
 */
function disconnect() {
  connection?.disconnect();
  connection = null;
}

/**
 * Handle commands from OpenClaw
 */
async function handleCommand(command: ClawCommand) {
  console.log('[Pincer] Received command:', command.type);

  const tabId = command.tabId || (await getActiveTabId());
  if (!tabId) {
    console.warn('[Pincer] No active tab for command');
    return;
  }

  // Forward command to content script
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'pincer_command',
      command,
    });

    // Send result back to gateway
    if (response && connection) {
      connection.send({
        type: 'command_result',
        tabId,
        url: activeTabs.get(tabId)?.url || '',
        timestamp: Date.now(),
        requestId: command.requestId,
        payload: response,
      });
    }
  } catch (err) {
    console.error('[Pincer] Failed to execute command:', err);
  }
}

/**
 * Handle tab activation
 */
async function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (!tab.url || tab.url.startsWith('chrome://')) return;

  activeTabs.set(activeInfo.tabId, {
    url: tab.url,
    title: tab.title || '',
  });

  if (config.sendOnTabSwitch && connection?.status === 'connected') {
    requestContextFromTab(activeInfo.tabId);
  }
}

/**
 * Handle tab updates
 */
function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) {
  if (changeInfo.status === 'complete' && tab.url) {
    activeTabs.set(tabId, {
      url: tab.url,
      title: tab.title || '',
    });
  }
}

/**
 * Handle tab removal
 */
function handleTabRemoved(tabId: number) {
  activeTabs.delete(tabId);
}

/**
 * Request context from a tab's content script
 */
async function requestContextFromTab(tabId: number) {
  try {
    const context = await chrome.tabs.sendMessage(tabId, {
      type: 'get_context',
    });

    if (context && connection) {
      connection.send({
        type: 'page_context',
        tabId,
        url: context.url,
        timestamp: Date.now(),
        payload: context,
      });
    }
  } catch (err) {
    // Content script may not be injected yet
    console.debug('[Pincer] Could not get context from tab:', tabId);
  }
}

/**
 * Get the currently active tab ID
 */
async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/**
 * Broadcast connection status to popup
 */
function broadcastStatus(status: ConnectionStatus) {
  chrome.runtime.sendMessage({
    type: 'status_update',
    status,
    tabCount: activeTabs.size,
  }).catch(() => {
    // Popup may not be open
  });
}

// Message handler for popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'get_status':
      sendResponse({
        status: connection?.status || 'disconnected',
        tabCount: activeTabs.size,
        config,
      });
      break;

    case 'connect':
      connect();
      sendResponse({ ok: true });
      break;

    case 'disconnect':
      disconnect();
      sendResponse({ ok: true });
      break;

    case 'update_config':
      config = { ...config, ...message.config };
      chrome.storage.local.set({ config });
      connection?.updateConfig(config);
      sendResponse({ ok: true });
      break;

    case 'page_context':
      // Forward context from content script to gateway
      if (connection?.status === 'connected' && sender.tab?.id) {
        connection.send({
          type: 'page_context',
          tabId: sender.tab.id,
          url: sender.tab.url || '',
          timestamp: Date.now(),
          payload: message.context,
        });
      }
      sendResponse({ ok: true });
      break;

    case 'selection':
      // Forward selection from content script
      if (connection?.status === 'connected' && sender.tab?.id) {
        connection.send({
          type: 'selection',
          tabId: sender.tab.id,
          url: sender.tab.url || '',
          timestamp: Date.now(),
          payload: { text: message.text },
        });
      }
      sendResponse({ ok: true });
      break;
  }

  return true; // Keep channel open for async response
});

// Initialize on load
init();
