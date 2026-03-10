import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface GatewayConnectionConfig {
  url: string;
  token?: string;
  password?: string;
}

export interface AppConfig {
  gateway: GatewayConnectionConfig;
  lastSessionKey?: string;
  windowBounds?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  gateway: {
    url: 'ws://localhost:18789',
    token: '',
    password: '',
  },
};

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    // Use Electron's app.getPath for userData directory
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');

    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data);
        return { ...DEFAULT_CONFIG, ...loaded };
      }
    } catch (error: any) {
      console.error('Failed to load config, using defaults:', error.message);
    }
    return { ...DEFAULT_CONFIG };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  saveConfig(config: Partial<AppConfig>): boolean {
    try {
      this.config = { ...this.config, ...config };

      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error: any) {
      console.error('Failed to save config:', error.message);
      return false;
    }
  }

  updateGatewayConfig(gatewayConfig: Partial<GatewayConnectionConfig>): boolean {
    return this.saveConfig({
      gateway: { ...this.config.gateway, ...gatewayConfig },
    });
  }

  updateLastSessionKey(sessionKey: string): boolean {
    return this.saveConfig({ lastSessionKey: sessionKey });
  }

  updateWindowBounds(bounds: { width: number; height: number; x?: number; y?: number }): boolean {
    return this.saveConfig({ windowBounds: bounds });
  }
}
