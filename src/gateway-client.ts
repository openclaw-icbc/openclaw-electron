import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { LogManager } from './log-manager.js';
import { loadOrCreateDeviceIdentity, signDevicePayload, buildDeviceAuthPayload, publicKeyRawBase64UrlFromPem, type DeviceIdentity } from './device-identity.js';

export interface GatewayConfig {
  url: string;
  token?: string;
  password?: string;
}

// Valid client IDs from Gateway protocol
const GATEWAY_CLIENT_IDS = {
  WEBCHAT_UI: 'webchat-ui',
  CONTROL_UI: 'openclaw-control-ui',
  WEBCHAT: 'webchat',
  CLI: 'cli',
  GATEWAY_CLIENT: 'gateway-client',
  MACOS_APP: 'openclaw-macos',
  IOS_APP: 'openclaw-ios',
  ANDROID_APP: 'openclaw-android',
  NODE_HOST: 'node-host',
  TEST: 'test',
  FINGERPRINT: 'fingerprint',
  PROBE: 'openclaw-probe',
} as const;

// Valid client modes from Gateway protocol
const GATEWAY_CLIENT_MODES = {
  WEBCHAT: 'webchat',
  CLI: 'cli',
  UI: 'ui',
  BACKEND: 'backend',
  NODE: 'node',
  PROBE: 'probe',
  TEST: 'test',
} as const;

export interface GatewayHelloOk {
  type: 'hello-ok';
  protocol: number;
  server?: {
    version?: string;
    connId?: string;
  };
  features?: { methods?: string[]; events?: string[] };
  snapshot?: any;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
}

export interface GatewayEventFrame {
  type: 'event';
  event: string;
  payload?: any;
  seq?: number;
  stateVersion?: { presence: number; health: number };
}

export interface GatewayResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: { code: string; message: string; details?: any };
}

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (err: any) => void;
};

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private handshakeComplete = false; // Track if handshake is complete
  private config: GatewayConfig;
  private logManager: LogManager;
  private deviceIdentity: ReturnType<typeof loadOrCreateDeviceIdentity>;
  private requestId = 0;

  constructor(config: GatewayConfig, logManager: LogManager) {
    super();
    this.config = config;
    this.logManager = logManager;

    // Load or create device identity
    this.deviceIdentity = loadOrCreateDeviceIdentity();
  }

  async connect(): Promise<void> {
    this.closed = false;
    await this.connectInternal();
  }

  private async connectInternal(): Promise<void> {
    if (this.closed) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.log('info', `Connecting to gateway at ${this.config.url}`);

        this.ws = new WebSocket(this.config.url);

        this.ws.on('open', async () => {
          this.log('info', 'WebSocket connection established');
          // Connect will be sent after receiving connect.challenge
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data.toString('utf-8'));
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          const reasonStr = reason.toString('utf-8');
          this.log('info', `WebSocket closed: ${code} - ${reasonStr}`);
          this.ws = null;
          this.handshakeComplete = false; // Reset handshake state
          this.connectSent = false;
          this.connectNonce = null;
          this.flushPending(new Error(`Gateway closed (${code}): ${reasonStr}`));
          this.emit('disconnected', { code, reason: reasonStr });
        });

        this.ws.on('error', (err: Error) => {
          this.log('error', `WebSocket error: ${err.message}`);
          // Error is usually followed by close, so we'll handle it there
        });
      } catch (error: any) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.closed = true;
    if (this.ws) {
      this.log('info', 'Disconnecting from gateway');

      // Send a graceful disconnect notification if connected
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          // Note: Gateway doesn't have a formal disconnect message,
          // but we log the intent
          this.log('info', 'Client-initiated disconnect');
        } catch (err) {
          // Ignore errors during disconnect
        }
      }

      this.ws.close();
      this.ws = null;
    }
    this.flushPending(new Error('Gateway client stopped'));
    this.connectNonce = null;
    this.connectSent = false;
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.handshakeComplete;
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent) {
      return;
    }
    this.connectSent = true;

    this.log('info', 'Sending connect message');

    const auth = this.config.token || this.config.password
      ? {
          token: this.config.token,
          password: this.config.password,
        }
      : undefined;

    // Build device auth payload
    const signedAtMs = Date.now();
    const nonce = this.connectNonce || '';

    const authPayload = buildDeviceAuthPayload({
      deviceId: this.deviceIdentity.deviceId,
      clientId: GATEWAY_CLIENT_IDS.MACOS_APP,
      clientMode: GATEWAY_CLIENT_MODES.UI,
      role: 'operator',
      scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
      signedAtMs,
      token: this.config.token ?? null,
      nonce,
      platform: process.platform,
      deviceFamily: 'desktop',
    });

    const signature = signDevicePayload(this.deviceIdentity.privateKeyPem, authPayload);

    // Debug logging
    this.log('info', `Device auth payload: ${authPayload}`);
    this.log('info', `Device ID: ${this.deviceIdentity.deviceId}`);
    this.log('info', `Public key (raw): ${publicKeyRawBase64UrlFromPem(this.deviceIdentity.publicKeyPem)}`);
    this.log('info', `Signature: ${signature.substring(0, 20)}...`);

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: GATEWAY_CLIENT_IDS.MACOS_APP,
        version: '1.0.0',
        platform: process.platform,
        mode: GATEWAY_CLIENT_MODES.UI,
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
      device: {
        id: this.deviceIdentity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(this.deviceIdentity.publicKeyPem),
        signature: signature,
        signedAt: signedAtMs,
        nonce: this.connectNonce || '',
      },
      caps: ['tool-events'],
      auth,
      userAgent: `openclaw-electron/1.0.0 (${process.platform})`,
      locale: 'en-US',
    };

    try {
      const hello = await this.request<GatewayHelloOk>('connect', params);
      this.log('info', `Connected successfully. Protocol version: ${hello.protocol}`);

      // Mark handshake as complete
      this.handshakeComplete = true;

      // Store device token if issued
      if (hello.auth?.deviceToken) {
        this.log('info', 'Device token issued');
        // In production, persist this token for future connections
      }

      this.emit('connected', hello);
    } catch (error: any) {
      this.log('error', `Connect failed: ${error.message}`);
      if (error.stack) {
        this.log('error', `Error stack: ${error.stack}`);
      }
      this.ws?.close(4008, 'connect failed');
      throw error;
    }
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.log('warn', `Failed to parse message: ${raw.substring(0, 100)}`);
      return;
    }

    const frame = parsed as { type?: unknown };

    if (frame.type === 'event') {
      const evt = parsed as GatewayEventFrame;

      // Handle connect.challenge
      if (evt.event === 'connect.challenge') {
        const payload = evt.payload as { nonce?: string } | undefined;
        const nonce = payload && typeof payload.nonce === 'string' ? payload.nonce : null;
        if (nonce) {
          this.log('info', 'Received connect.challenge');
          this.connectNonce = nonce;
          this.sendConnect();
        }
        return;
      }

      // Handle other events
      const seq = typeof evt.seq === 'number' ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq !== this.lastSeq + 1) {
          this.emit('gap', { expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }

      this.log('debug', `Received event: ${evt.event}`);
      this.emit('event', evt);
      return;
    }

    if (frame.type === 'res') {
      const res = parsed as GatewayResponseFrame;
      const pending = this.pending.get(res.id);

      if (pending) {
        this.pending.delete(res.id);
        if (res.ok) {
          pending.resolve(res.payload);
        } else {
          // Enhanced error logging
          const errorDetails = res.error?.details ? ` (${JSON.stringify(res.error.details)})` : '';
          pending.reject(new Error(`${res.error?.message || 'Request failed'}${errorDetails}`));
        }
      }
      return;
    }
  }

  async request<T = any>(method: string, params?: any): Promise<T> {
    // Allow 'connect' request even if handshake is not complete
    const isConnectRequest = method === 'connect';
    if ((!this.connected && !isConnectRequest) || !this.ws) {
      throw new Error('Not connected to gateway');
    }

    const id = `req-${++this.requestId}`;
    const frame = {
      type: 'req',
      id,
      method,
      params: params || {},
    };

    this.log('debug', `Sending request: ${method}`);

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000); // 30 second timeout

      try {
        this.ws!.send(JSON.stringify(frame));
      } catch (err) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(err);
      }

      // Note: The promise will be resolved when the response is received
      // The timeout handles the case where no response is received
    });
  }

  // Chat methods
  async sendMessage(sessionKey: string, message: string, attachments?: any[]): Promise<string> {
    const idempotencyKey = `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    const params: any = {
      sessionKey,
      message,
      idempotencyKey,
    };

    if (attachments && attachments.length > 0) {
      params.attachments = attachments;
    }

    const result = await this.request<{ runId: string }>('chat.send', params);
    return result.runId;
  }

  async abortChat(sessionKey: string, runId?: string): Promise<void> {
    const params: any = { sessionKey };
    if (runId) {
      params.runId = runId;
    }
    await this.request('chat.abort', params);
  }

  async getChatHistory(sessionKey: string, limit: number = 200): Promise<any> {
    return this.request('chat.history', { sessionKey, limit });
  }

  // Session methods
  async listSessions(params?: any): Promise<any> {
    return this.request('sessions.list', params || {});
  }

  async resolveSession(params?: any): Promise<any> {
    return this.request('sessions.resolve', params || {});
  }

  async patchSession(key: string, patch: any): Promise<void> {
    await this.request('sessions.patch', { key, ...patch });
  }

  async deleteSession(key: string, deleteTranscript: boolean = true): Promise<void> {
    await this.request('sessions.delete', { key, deleteTranscript });
  }

  // Agents methods
  async listAgents(): Promise<any> {
    return this.request('agents.list', {});
  }

  // Cron methods
  async listCronJobs(params?: any): Promise<any> {
    return this.request('cron.list', params || {});
  }

  async addCronJob(job: any): Promise<any> {
    return this.request('cron.add', job);
  }

  async updateCronJob(id: string, patch: any): Promise<any> {
    return this.request('cron.update', { id, patch });
  }

  async removeCronJob(id: string): Promise<any> {
    return this.request('cron.remove', { id });
  }

  async runCronJob(id: string, mode?: string): Promise<any> {
    return this.request('cron.run', { id, mode: mode || 'force' });
  }

  // Presence method
  async getSystemPresence(): Promise<any> {
    return this.request('system-presence', {});
  }

  // Health method
  async getHealth(): Promise<any> {
    return this.request('health', {});
  }

  private flushPending(err: Error): void {
    for (const [, p] of this.pending) {
      p.reject(err);
    }
    this.pending.clear();
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    this.logManager.log('gateway', logMessage);
  }
}
