# OpenClaw Electron Desktop Client

一个基于 Electron 的 OpenClaw Gateway 桌面客户端，提供现代化的聊天界面和完整的功能支持。

## 目录

- [项目概述](#项目概述)
- [架构设计](#架构设计)
- [目录结构](#目录结构)
- [核心组件](#核心组件)
- [技术栈](#技术栈)
- [安装与使用](#安装与使用)
- [开发指南](#开发指南)
- [配置说明](#配置说明)
- [故障排除](#故障排除)

## 项目概述

OpenClaw Electron Desktop Client 是一个功能完整的桌面应用程序，用于连接和交互 OpenClaw Gateway。它提供了：

- 🔐 **安全的设备认证**：基于公钥密码学的设备身份验证
- 💬 **实时聊天**：支持多个会话的实时消息传输
- 📋 **会话管理**：创建、切换和管理多个聊天会话
- 🔍 **日志查看**：内置日志查看和过滤功能
- ⚙️ **配置管理**：可视化的配置界面
- 🎨 **现代化 UI**：仿微信风格的用户界面，支持高 DPI 显示

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ ConfigManager│  │ LogManager   │  │GatewayClient │ │
│  │              │  │              │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                           │                              │
│                      IPC 通信                            │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Preload Script │
                    │  (API 桥接)      │
                    └───────┬────────┘
                            │
                    ┌───────▼───────────────────────────┐
                    │     Renderer Process               │
                    │  ┌──────────────────────────────┐ │
                    │  │     UI Components            │ │
                    │  │  ┌──────┐  ┌──────────┐     │ │
                    │  │  │HTML  │  │   CSS    │     │ │
                    │  │  └──────┘  └──────────┘     │ │
                    │  │  ┌──────────────────────────┐│ │
                    │  │  │    app.js (应用逻辑)      ││ │
                    │  │  └──────────────────────────┘│ │
                    │  └──────────────────────────────┘ │
                    └───────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │ OpenClaw Gateway│
                    │  (WebSocket)    │
                    └─────────────────┘
```

### 进程架构

应用程序采用 Electron 的多进程架构：

1. **主进程 (Main Process)**
   - 管理应用生命周期
   - 处理 IPC 通信
   - 管理 WebSocket 连接
   - 处理文件系统操作

2. **渲染进程 (Renderer Process)**
   - 渲染用户界面
   - 处理用户交互
   - 调用主进程 API
   - 显示聊天消息和日志

3. **预加载脚本 (Preload Script)**
   - 安全地暴露 API 给渲染进程
   - 实现 Context Bridge 隔离

## 目录结构

```
openclaw-electron/
├── src/                        # TypeScript 源代码
│   ├── main.ts                 # 主进程入口
│   ├── preload.ts              # 预加载脚本
│   ├── gateway-client.ts       # Gateway WebSocket 客户端
│   ├── config-manager.ts       # 配置管理器
│   ├── log-manager.ts          # 日志管理器
│   ├── device-identity.ts      # 设备身份认证
│   └── types.d.ts              # TypeScript 类型定义
├── renderer/                   # 渲染进程文件
│   ├── index.html              # 主页面
│   ├── app.js                  # 应用逻辑
│   ├── styles.css              # 样式文件
│   └── test-*.html             # 测试页面
├── dist/                       # 编译输出目录
├── package.json                # 项目配置
├── tsconfig.json               # TypeScript 配置
└── README-ARCHITECTURE.md      # 本文档
```

## 核心组件

### 1. 主进程 (src/main.ts)

**职责**：
- 创建和管理应用窗口
- 设置 IPC 通信处理器
- 协调各个管理器
- 处理应用生命周期事件

**核心功能**：

```typescript
// 窗口创建
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
}

// IPC 处理器
ipcMain.handle('connect-gateway', async (event, config) => {
  // 连接 Gateway
});

ipcMain.handle('send-message', async (event, sessionKey, message) => {
  // 发送消息
});
```

**生命周期管理**：
- `app.whenReady()`: 初始化应用
- `window-all-closed`: 处理窗口关闭
- `before-quit`: 清理资源

### 2. Gateway 客户端 (src/gateway-client.ts)

**职责**：
- 管理 WebSocket 连接
- 实现 Gateway 协议握手
- 处理消息发送和接收
- 管理请求/响应匹配

**核心类**：

```typescript
export class GatewayClient extends EventEmitter {
  // 连接管理
  async connect(): Promise<void>
  disconnect(): void

  // 聊天方法
  async sendMessage(sessionKey, message, attachments?): Promise<string>
  async getChatHistory(sessionKey, limit?): Promise<any>

  // 会话方法
  async listSessions(params?): Promise<any>
  async resolveSession(params?): Promise<any>
  async patchSession(key, patch): Promise<void>
  async deleteSession(key, deleteTranscript?): Promise<void>

  // 事件
  on('connected', (hello) => {})
  on('disconnected', (reason) => {})
  on('event', (evt) => {})
}
```

**协议实现**：

1. **连接握手**：
   ```
   Client                          Gateway
     │                               │
     │────────── connect.challenge ──>│
     │<──────────────────────────────│
     │                               │
     │<───── nonce ──────────────────│
     │                               │
     │────────── connect ───────────>│
     │  (with signature)             │
     │                               │
     │<────── hello-ok ──────────────│
     │                               │
   ```

2. **请求/响应模式**：
   - 每个请求有唯一 ID
   - 超时机制：30 秒
   - 自动清理挂起的请求

3. **设备认证**：
   - 使用 Ed25519 签名
   - 设备身份持久化
   - 支持 nonce 挑战-响应

### 3. 配置管理器 (src/config-manager.ts)

**职责**：
- 保存和加载应用配置
- 管理用户数据持久化
- 提供配置更新接口

**配置结构**：

```typescript
interface AppConfig {
  gateway: {
    url: string;          // Gateway WebSocket URL
    token?: string;       // 可选的认证 token
    password?: string;    // 可选的密码
  };
  lastSessionKey?: string;      // 最后使用的会话
  windowBounds?: {              // 窗口位置和大小
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}
```

**核心方法**：

```typescript
class ConfigManager {
  getConfig(): AppConfig                    // 获取配置
  saveConfig(config): boolean               // 保存配置
  updateGatewayConfig(config): boolean      // 更新 Gateway 配置
  updateLastSessionKey(key): boolean        // 更新最后会话
  updateWindowBounds(bounds): boolean       // 更新窗口状态
}
```

**存储位置**：
- Windows: `%APPDATA%\openclaw-electron\config.json`
- macOS: `~/Library/Application Support/openclaw-electron/config.json`
- Linux: `~/.config/openclaw-electron/config.json`

### 4. 日志管理器 (src/log-manager.ts)

**职责**：
- 记录应用运行日志
- 实现日志轮转
- 提供日志查询接口

**日志级别**：
- `info`: 一般信息
- `warn`: 警告信息
- `error`: 错误信息
- `debug`: 调试信息

**核心功能**：

```typescript
class LogManager {
  // 写入日志
  log(source, message, level): void
  info(source, message): void
  warn(source, message): void
  error(source, message): void
  debug(source, message): void

  // 读取日志
  getLogs(options): LogEntry[]

  // 清理
  clearLogs(): boolean
}
```

**日志轮转**：
- 按日期分割日志文件
- 单文件最大 10MB
- 保留最近 7 天的日志
- 文件命名：`openclaw-YYYY-MM-DD.log`

### 5. 设备身份认证 (src/device-identity.ts)

**职责**：
- 生成和管理设备身份
- 实现密码学签名
- 持久化设备密钥对

**认证流程**：

```typescript
// 1. 加载或创建设备身份
const identity = loadOrCreateDeviceIdentity();
// {
//   deviceId: 'device_xxx',
//   privateKeyPem: '...',
//   publicKeyPem: '...'
// }

// 2. 构建认证载荷
const authPayload = buildDeviceAuthPayload({
  deviceId: identity.deviceId,
  clientId: 'openclaw-macos',
  clientMode: 'ui',
  role: 'operator',
  scopes: ['operator.admin', ...],
  signedAtMs: Date.now(),
  nonce: challengeNonce,
  platform: 'win32',
  deviceFamily: 'desktop'
});

// 3. 签名
const signature = signDevicePayload(
  identity.privateKeyPem,
  authPayload
);

// 4. 发送连接请求
await gatewayClient.connect();
```

**密钥管理**：
- 使用 Ed25519 签名算法
- 密钥对存储在用户数据目录
- 自动生成唯一设备 ID
- 支持密钥轮换

### 6. 预加载脚本 (src/preload.ts)

**职责**：
- 安全地暴露 API 给渲染进程
- 实现 Context Bridge 隔离
- 防止代码注入攻击

**API 接口**：

```typescript
interface ElectronAPI {
  // 配置
  getConfig(): Promise<any>
  saveConfig(config): Promise<boolean>

  // Gateway 连接
  connectGateway(config): Promise<{success, error?}>
  disconnectGateway(): Promise<{success, error?}>

  // 聊天
  sendMessage(sessionKey, message, attachments?): Promise<{success, runId?, error?}>
  getChatHistory(sessionKey, limit?): Promise<{success, data?, error?}>

  // 会话
  listSessions(params?): Promise<{success, data?, error?}>
  resolveSession(params?): Promise<{success, data?, error?}>

  // 日志
  getLogs(options?): Promise<LogEntry[]>
  clearLogs(): Promise<boolean>

  // 事件监听
  onGatewayConnected(callback): void
  onGatewayDisconnected(callback): void
  onGatewayEvent(callback): void

  removeAllListeners(): void
}
```

**安全特性**：
- ✅ 禁用 Node.js 集成 (`nodeIntegration: false`)
- ✅ 启用上下文隔离 (`contextIsolation: true`)
- ✅ 使用 Context Bridge 暴露 API
- ✅ 验证所有 IPC 参数

### 7. 渲染进程 (renderer/app.js)

**职责**：
- 实现用户界面逻辑
- 处理用户交互
- 管理应用状态
- 调用 Electron API

**应用状态**：

```javascript
const state = {
  connected: false,           // Gateway 连接状态
  currentSessionKey: null,    // 当前选中的会话
  currentView: 'chat',        // 当前视图
  sessions: [],               // 会话列表
  messages: [],               // 当前会话的消息
  config: {                   // Gateway 配置
    url: 'ws://localhost:18789',
    token: '',
    password: ''
  }
};
```

**核心功能模块**：

1. **导航管理**：
   - 视图切换 (Chat/Sessions/Config/Logs)
   - 侧边栏导航
   - 内容区域更新

2. **连接管理**：
   - Gateway 连接
   - 断线重连
   - 状态显示

3. **会话管理**：
   - 新建会话
   - 切换会话
   - 显示会话列表

4. **消息处理**：
   - 发送消息
   - 接收消息
   - 显示聊天历史

5. **自定义 UI 组件**：
   - 模态对话框（替代 `prompt()`）
   - Toast 通知
   - 加载动画

### 8. 用户界面 (renderer/)

**HTML 结构** (`index.html`)：

```html
<div id="app">
  <div id="app-panel" class="panel">
    <div class="app-layout">
      <!-- 侧边栏 -->
      <div class="sidebar">
        <div class="sidebar-header">...</div>
        <nav class="sidebar-nav">...</nav>
        <div class="sidebar-content">
          <!-- Chat 视图侧边栏 -->
          <!-- Sessions 视图侧边栏 -->
        </div>
      </div>

      <!-- 主内容区域 -->
      <div class="main-content">
        <!-- Chat 视图 -->
        <!-- Config 视图 -->
        <!-- Logs 视图 -->
        <!-- Sessions 视图 -->
      </div>
    </div>
  </div>

  <!-- 加载遮罩 -->
  <div id="loading-overlay">...</div>

  <!-- Toast 容器 -->
  <div id="toast-container">...</div>
</div>
```

**CSS 架构** (`styles.css`)：

- 使用 CSS 变量定义主题
- Flexbox 布局
- 响应式设计
- 高 DPI 优化
- 自定义滚动条
- 动画效果

## 技术栈

### 核心技术

- **Electron**: v34.0.0 - 桌面应用框架
- **TypeScript**: v5.7.2 - 类型安全的 JavaScript
- **Node.js**: v22+ - 运行时环境

### 主要依赖

- **ws**: v8.18.0 - WebSocket 客户端
- **tweetnacl**: v1.0.3 - 密码学库（Ed25519）
- **tweetnacl-util**: v0.15.1 - 编码转换工具

### 开发依赖

- **@types/node**: v22.0.0 - Node.js 类型定义
- **@types/ws**: v8.5.13 - WebSocket 类型定义

## 安装与使用

### 环境要求

- Node.js 22 或更高版本
- npm 或 pnpm
- Windows/macOS/Linux 操作系统

### 安装步骤

1. **克隆或下载项目**：
   ```bash
   cd openclaw-electron
   ```

2. **安装依赖**：
   ```bash
   npm install
   ```

3. **编译 TypeScript**：
   ```bash
   npm run build
   ```

4. **启动应用**：
   ```bash
   npm run dev
   ```

### 生产构建

```bash
# 编译
npm run build

# 启动
npm start
```

### Windows 高 DPI 优化

如果在 Windows 上遇到模糊问题：

```bash
# 使用高 DPI 启动脚本
npm run start:windows

# 或使用高 DPI 诊断工具
npm run diagnose
```

## 开发指南

### 项目结构说明

```
src/                    # TypeScript 源代码（主进程）
├── main.ts            # 主进程入口，创建窗口和设置 IPC
├── preload.ts         # 预加载脚本，安全地暴露 API
├── gateway-client.ts  # Gateway WebSocket 客户端实现
├── config-manager.ts  # 配置持久化管理
├── log-manager.ts     # 日志记录和查询
├── device-identity.ts # 设备身份和签名
└── types.d.ts         # TypeScript 类型定义

renderer/              # 渲染进程文件
├── index.html        # 主页面 HTML
├── app.js            # 应用逻辑（JavaScript）
├── styles.css        # 样式表
└── test-*.html       # 测试页面

dist/                  # 编译输出目录
└── *.js              # 编译后的 JavaScript 文件
```

### 添加新的 IPC 方法

1. **在 `preload.ts` 中定义接口**：
   ```typescript
   export interface ElectronAPI {
     myNewMethod: (param: string) => Promise<{success: boolean}>;
   }
   ```

2. **在 `preload.ts` 中实现**：
   ```typescript
   const electronAPI: ElectronAPI = {
     myNewMethod: (param) => ipcRenderer.invoke('my-new-method', param),
     // ... 其他方法
   };
   ```

3. **在 `main.ts` 中添加处理器**：
   ```typescript
   ipcMain.handle('my-new-method', async (event, param) => {
     // 实现逻辑
     return { success: true };
   });
   ```

4. **在 `app.js` 中调用**：
   ```javascript
   const result = await window.electronAPI.myNewMethod('param');
   ```

### 添加新的 Gateway 方法

1. **在 `gateway-client.ts` 中添加方法**：
   ```typescript
   async myNewMethod(params?: any): Promise<any> {
     return this.request('my.new.method', params || {});
   }
   ```

2. **在 `main.ts` 中暴露 IPC**：
   ```typescript
   ipcMain.handle('my-new-method', async (event, params) => {
     if (!gatewayClient) {
       return { success: false, error: 'Not connected' };
     }
     try {
       const result = await gatewayClient.myNewMethod(params);
       return { success: true, data: result };
     } catch (error: any) {
       return { success: false, error: error.message };
     }
   });
   ```

### 调试技巧

1. **打开开发者工具**：
   - 应用启动时自动打开（开发模式）
   - 或按 `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (macOS)

2. **查看日志**：
   - 在应用的 "Logs" 标签页查看
   - 或查看日志文件：用户数据目录/logs/

3. **控制台调试**：
   ```javascript
   // 在开发者工具 Console 中
   console.log('Current state:', state);
   console.log('Sessions:', state.sessions);
   ```

4. **WebSocket 调试**：
   - 查看 Network 标签页的 WebSocket 帧
   - 检查 `gateway-client.ts` 中的日志输出

### 代码风格

- **TypeScript**: 使用严格类型检查
- **命名**: 驼峰命名法（camelCase）
- **注释**: 复杂逻辑添加注释说明
- **错误处理**: 所有异步操作都应有错误处理

## 配置说明

### Gateway 连接配置

在应用中的 "Config" 标签页配置：

- **Gateway URL**: WebSocket 服务器地址
  - 默认: `ws://localhost:18789`
  - 格式: `ws://host:port` 或 `wss://host:port` (TLS)

- **Gateway Token** (可选): 认证令牌
- **Gateway Password** (可选): 密码认证

### 应用配置文件

位置：用户数据目录/config.json

```json
{
  "gateway": {
    "url": "ws://localhost:18789",
    "token": "",
    "password": ""
  },
  "lastSessionKey": "agent:main:my-chat",
  "windowBounds": {
    "width": 1200,
    "height": 800,
    "x": 100,
    "y": 100
  }
}
```

### 会话 Key 格式

OpenClaw 使用以下格式的会话 Key：

```
agent:<agentId>:<label>
```

示例：
- `agent:main:my-chat` - main agent 的 my-chat 会话
- `agent:codex:debug-session` - codex agent 的 debug-session 会话

## 故障排除

### 常见问题

1. **无法连接到 Gateway**
   - 检查 Gateway URL 是否正确
   - 确认 Gateway 正在运行
   - 检查防火墙设置
   - 查看 "Logs" 标签页的错误信息

2. **认证失败**
   - 检查 token/password 是否正确
   - 确认设备已配对（如果需要）
   - 查看 Gateway 日志

3. **消息发送失败**
   - 确认已选择会话
   - 检查网络连接
   - 查看控制台错误信息

4. **界面显示模糊（Windows）**
   - 使用 `npm run start:windows` 启动
   - 或运行 `npm run diagnose` 检查 DPI 设置

5. **应用无法启动**
   - 删除配置文件和日志重试
   - 检查 Node.js 版本（需要 v22+）
   - 查看控制台错误信息

### 日志位置

- **Windows**: `%APPDATA%\openclaw-electron\logs\`
- **macOS**: `~/Library/Application Support/openclaw-electron/logs/`
- **Linux**: `~/.config/openclaw-electron/logs/`


