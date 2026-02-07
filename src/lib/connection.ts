/**
 * WebSocket connection to OpenClaw Gateway
 */

import type { PincerMessage, ClawCommand, PincerConfig, DEFAULT_CONFIG } from './protocol';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionEvents {
  onStatusChange: (status: ConnectionStatus) => void;
  onCommand: (command: ClawCommand) => void;
  onError: (error: Error) => void;
}

export class GatewayConnection {
  private ws: WebSocket | null = null;
  private config: PincerConfig;
  private events: ConnectionEvents;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(config: PincerConfig, events: ConnectionEvents) {
    this.config = config;
    this.events = events;
  }

  get status(): ConnectionStatus {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.events.onStatusChange('connecting');

    try {
      const url = new URL(this.config.gateway.url);
      if (this.config.gateway.token) {
        url.searchParams.set('token', this.config.gateway.token);
      }

      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.events.onStatusChange('connected');
        console.log('[Pincer] Connected to OpenClaw Gateway');
      };

      this.ws.onmessage = (event) => {
        try {
          const command = JSON.parse(event.data) as ClawCommand;
          this.events.onCommand(command);
        } catch (err) {
          console.error('[Pincer] Failed to parse command:', err);
        }
      };

      this.ws.onclose = () => {
        this.events.onStatusChange('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (event) => {
        this.events.onStatusChange('error');
        this.events.onError(new Error('WebSocket error'));
      };
    } catch (err) {
      this.events.onStatusChange('error');
      this.events.onError(err as Error);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
    this.ws?.close();
    this.ws = null;
    this.events.onStatusChange('disconnected');
  }

  send(message: PincerMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[Pincer] Cannot send - not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('[Pincer] Send failed:', err);
      return false;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Pincer] Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[Pincer] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  updateConfig(config: Partial<PincerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
