import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

export class LogManager {
  private logDir: string;
  private currentLogFile: string;
  private maxLogFiles = 7; // Keep 7 days of logs
  private maxLogSize = 10 * 1024 * 1024; // 10 MB per file

  constructor() {
    const userDataPath = app.getPath('userData');
    this.logDir = path.join(userDataPath, 'logs');

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.logDir, `openclaw-${today}.log`);

    this.cleanOldLogs();
  }

  private cleanOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Delete old files beyond maxLogFiles
      if (files.length > this.maxLogFiles) {
        for (const file of files.slice(this.maxLogFiles)) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  log(source: string, message: string, level: string = 'info'): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}\n`;

    try {
      // Check if we need to rotate the log file
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        if (stats.size >= this.maxLogSize) {
          // Rotate to a new file with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedPath = path.join(this.logDir, `openclaw-${timestamp}.log`);
          fs.renameSync(this.currentLogFile, rotatedPath);
        }
      }

      // Append to current log file
      fs.appendFileSync(this.currentLogFile, logEntry);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  info(source: string, message: string): void {
    this.log(source, message, 'info');
  }

  warn(source: string, message: string): void {
    this.log(source, message, 'warn');
  }

  error(source: string, message: string): void {
    this.log(source, message, 'error');
  }

  debug(source: string, message: string): void {
    this.log(source, message, 'debug');
  }

  getLogs(options: { limit?: number; level?: string; source?: string } = {}): LogEntry[] {
    const { limit = 1000, level, source } = options;

    try {
      if (!fs.existsSync(this.currentLogFile)) {
        return [];
      }

      const content = fs.readFileSync(this.currentLogFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      const entries: LogEntry[] = [];

      for (const line of lines.reverse()) {
        // Parse log line format: [timestamp] [level] [source] message
        const match = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.+)$/);
        if (match) {
          const [, timestamp, logLevel, logSource, message] = match;

          // Filter by level if specified
          if (level && logLevel.toLowerCase() !== level.toLowerCase()) {
            continue;
          }

          // Filter by source if specified
          if (source && logSource.toLowerCase() !== source.toLowerCase()) {
            continue;
          }

          entries.push({
            timestamp,
            level: logLevel,
            source: logSource,
            message,
          });

          if (entries.length >= limit) {
            break;
          }
        }
      }

      return entries;
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  }

  clearLogs(): boolean {
    try {
      if (fs.existsSync(this.currentLogFile)) {
        fs.unlinkSync(this.currentLogFile);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return false;
    }
  }

  getLogFilePath(): string {
    return this.currentLogFile;
  }
}
