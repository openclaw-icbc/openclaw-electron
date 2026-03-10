# OpenClaw Electron Desktop Client

基于 Electron 的 OpenClaw Gateway 桌面客户端。

## 功能特点

- **会话管理**: 支持新建会话、查看历史会话、继续之前的聊天
- **配置管理**: 可视化配置 Gateway 连接参数（URL、Token、Password）
- **连接测试**: 配置界面提供测试连接功能，验证配置是否正确
- **日志查看**: 内置日志查看器，支持按级别过滤和日志清理
- **自动重连**: 应用启动时自动使用保存的配置连接 Gateway
- **优雅关闭**: 关闭应用时自动通知 Gateway 断开连接
- ✅ WebSocket 客户端连接到 OpenClaw Gateway
- ✅ 支持配置 Gateway URL 和认证令牌
- ✅ 实时聊天功能：发送消息、接收响应
- ✅ 本地日志记录和查看
- ✅ 优雅的关闭通知（通知 Gateway 客户端断开）

## 技术栈

- **Electron**: 桌面应用框架
- **Node.js**: 后端运行时
- **TypeScript**: 主要开发语言
- **WebSocket**: 与 Gateway 通信
- **ws**: Node.js WebSocket 客户端库

## 安装和运行

### 前置要求

- Node.js 18+
- npm 或 pnpm
- 已运行的 OpenClaw Gateway

### 安装依赖

```bash
cd openclaw-electron
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 构建并运行

```bash
npm run build
npm start
```

## 使用说明

### 1. 首次使用配置

1. 启动应用后，点击左侧导航栏的 **"Config"** 进入配置界面
2. 填写 Gateway 配置：
   - **Gateway URL**: Gateway 的 WebSocket 地址（例如：`ws://localhost:18789`）
   - **Gateway Token**: (可选) Gateway 令牌
   - **Gateway Password**: (可选) Gateway 密码
3. 点击 **"Test Connection"** 测试连接是否成功
4. 测试成功后，点击 **"Save & Connect"** 保存配置并连接

### 2. 聊天功能

1. 连接成功后，点击左侧导航栏的 **"Chat"** 进入聊天界面
2. 点击 **"+ New Chat"** 按钮创建新会话
3. 输入会话标签（可选）并确认
4. 在底部输入框输入消息，按 Ctrl+Enter 或点击 **"Send"** 发送
5. 历史消息会自动加载显示，可以继续之前的聊天

### 3. 历史会话

1. 点击左侧导航栏的 **"Sessions"** 查看所有历史会话
2. 查看会话详细信息（创建时间、消息数量等）
3. 点击 **"Open Chat"** 按钮打开某个会话继续聊天

### 4. 日志查看

1. 点击左侧导航栏的 **"Logs"** 进入日志查看界面
2. 可以按日志级别过滤（Info、Warning、Error、Debug）
3. 设置显示的日志数量限制
4. 点击 **"Refresh"** 刷新日志
5. 点击 **"Clear Logs"** 清除所有日志

### 界面说明

- **连接指示器**: 左上角圆点显示连接状态（绿色=已连接，红色=未连接）
- **导航栏**: 左侧提供 Chat、Sessions、Config、Logs 四个导航选项
- **会话列表**: Chat 视图左侧显示所有会话，点击切换当前会话
- **消息区域**: 显示当前会话的聊天历史
- **输入区域**: 底部输入框，支持 Ctrl+Enter 快捷发送

## 协议兼容性

本客户端实现了 OpenClaw Gateway Protocol v3，主要功能包括：

- **连接认证**: 支持 token/password 认证和设备身份
- **聊天功能**:
  - `chat.send`: 发送消息
  - `chat.history`: 获取历史记录
- **会话管理**:
  - `sessions.list`: 列出会话
  - `sessions.create`: 创建会话
  - `sessions.patch`: 更新会话
  - `sessions.delete`: 删除会话
- **实时事件**: 处理 Gateway 推送的事件

## 项目结构

```
openclaw-electron/
├── src/                    # TypeScript 源码
│   ├── main.ts            # Electron 主进程
│   ├── preload.ts         # 预加载脚本（安全 IPC）
│   ├── gateway-client.ts  # Gateway WebSocket 客户端
│   ├── config-manager.ts  # 配置管理
│   └── log-manager.ts     # 日志管理
├── renderer/              # 渲染进程（UI）
│   ├── index.html        # 主页面
│   ├── styles.css        # 样式
│   └── app.js            # UI 逻辑
├── dist/                 # 编译输出
├── package.json
└── tsconfig.json
```

## 配置文件

配置保存在:
- **Windows**: `%APPDATA%\openclaw-electron\config.json`
- **macOS**: `~/Library/Application Support/openclaw-electron/config.json`
- **Linux**: `~/.config/openclaw-electron/config.json`

## 日志文件

日志保存在应用的 `logs` 目录中：
- 每天一个日志文件
- 自动清理超过 7 天的日志
- 单个日志文件最大 10MB

## 安全注意事项

1. **认证信息**: Token 和 Password 存储在本地配置文件中，请确保文件系统安全
2. **设备认证**: 客户端实现了设备身份认证，支持 Gateway 的配对功能

## 开发参考

本项目参考了 OpenClaw 官方 UI 的实现：
- `openclaw-2026.3.2/ui/src/ui/gateway.ts`: WebSocket 客户端实现
- `openclaw-2026.3.2/ui/src/ui/controllers/chat.ts`: 聊天功能
- `openclaw-2026.3.2/ui/src/ui/controllers/sessions.ts`: 会话管理

## 故障排查

### 连接失败

1. 检查 Gateway 是否运行: `openclaw gateway status`
2. 确认 URL 格式正确（ws:// 或 wss://）
3. 验证认证信息是否正确
4. 查看 Gateway 日志: `openclaw logs --follow`

### 消息发送失败

1. 确认已选择会话
2. 检查 Gateway 连接状态
3. 查看客户端日志获取详细错误


