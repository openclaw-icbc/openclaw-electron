# OpenClaw WebSocket 对接开发文档

本文档详细说明 OpenClaw Gateway 的 WebSocket 通信协议，帮助开发者实现客户端与 OpenClaw 的对接。

## 目录

1. [连接流程](#连接流程)
2. [消息帧格式](#消息帧格式)
3. [请求-响应机制](#请求-响应机制)
4. [事件推送机制](#事件推送机制)
5. [聊天事件详解](#聊天事件详解)
6. [Agent事件详解](#agent事件详解)
7. [其他事件类型](#其他事件类型)
8. [消息结束判断](#消息结束判断)
9. [完整示例](#完整示例)

---

## 连接流程

### 1. 建立 WebSocket 连接

**连接URL格式：**
```
ws://[host]:[port]/gateway
```

默认端口为 `18789`（可通过配置修改）。

### 2. 接收连接挑战

连接成功后，Gateway 会立即发送一个 `connect.challenge` 事件：

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": {
    "nonce": "uuid-v4",
    "ts": 1713456789000
  }
}
```

**重要：** 客户端必须保存此 `nonce`，用于后续的认证。

### 3. 发送认证请求

使用收到的 `nonce` 发送 `connect` 请求：

```json
{
  "type": "req",
  "id": "unique-request-id",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "your-client-id",
      "displayName": "Your Client Name",
      "version": "1.0.0",
      "platform": "web",
      "mode": "webchat",
      "instanceId": "optional-instance-id"
    },
    "caps": ["tool-events"],
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "auth": {
      "token": "your-auth-token"
    },
    "locale": "zh-CN",
    "userAgent": "YourClient/1.0.0"
  }
}
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `minProtocol/maxProtocol` | number | 是 | 协议版本，当前为 3 |
| `client.id` | string | 是 | 客户端标识 |
| `client.mode` | string | 是 | 客户端模式：`webchat`, `cli`, `node` |
| `caps` | string[] | 否 | 能力声明，推荐包含 `["tool-events"]` |
| `role` | string | 是 | 角色，通常为 `operator` |
| `scopes` | string[] | 是 | 权限范围 |
| `auth.token` | string | 条件 | Gateway token（生产环境需要） |
| `auth.password` | string | 条件 | 密码认证（本地开发） |

### 4. 接收握手成功响应

```json
{
  "type": "hello-ok",
  "protocol": 3,
  "server": {
    "version": "2026.04.03",
    "connId": "connection-uuid"
  },
  "features": {
    "methods": ["chat.send", "chat.history", ...],
    "events": ["chat", "agent", "heartbeat", ...]
  },
  "snapshot": { ... },
  "auth": {
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "deviceToken": "device-token-if-applicable"
  },
  "policy": {
    "maxPayload": 10485760,
    "maxBufferedBytes": 1048576,
    "tickIntervalMs": 30000
  }
}
```

至此，连接建立成功，可以开始发送请求和接收事件。

---

## 消息帧格式

OpenClaw WebSocket 协议使用三种帧类型：

### 1. 请求帧 (Request)

```json
{
  "type": "req",
  "id": "unique-request-id",
  "method": "method.name",
  "params": { ... }
}
```

### 2. 响应帧 (Response)

```json
{
  "type": "res",
  "id": "unique-request-id",
  "ok": true,
  "payload": { ... }
}
```

或错误响应：

```json
{
  "type": "res",
  "id": "unique-request-id",
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": { ... }
  }
}
```

### 3. 事件帧 (Event)

```json
{
  "type": "event",
  "event": "event.name",
  "payload": { ... },
  "seq": 123,
  "stateVersion": {
    "presence": 456,
    "health": 789
  }
}
```

---

## 请求-响应机制

### 基本流程

1. 客户端发送请求帧（`type: "req"`）
2. 服务器处理请求
3. 服务器返回响应帧（`type: "res"`），`id` 与请求对应

### 常用方法

#### `chat.send` - 发送聊天消息

```json
{
  "type": "req",
  "id": "req-001",
  "method": "chat.send",
  "params": {
    "sessionKey": "main",
    "message": "你好，请介绍一下自己",
    "thinking": "high",
    "idempotencyKey": "unique-idempotency-key",
    "attachments": []
  }
}
```

**响应（立即返回）：**

```json
{
  "type": "res",
  "id": "req-001",
  "ok": true,
  "payload": {
    "runId": "run-uuid",
    "status": "started"
  }
}
```

**注意：** `runId` 是本次运行的唯一标识，后续的聊天事件会包含此 `runId`。

#### `chat.history` - 获取聊天历史

```json
{
  "type": "req",
  "id": "req-002",
  "method": "chat.history",
  "params": {
    "sessionKey": "main",
    "limit": 100
  }
}
```

#### `chat.abort` - 中止运行

```json
{
  "type": "req",
  "id": "req-003",
  "method": "chat.abort",
  "params": {
    "sessionKey": "main",
    "runId": "run-uuid"
  }
}
```

---

## 事件推送机制

服务器会主动向客户端推送多种事件。所有事件都是单向的，无需响应。

### 事件类型概览

| 事件名 | 说明 | 推送频率 |
|--------|------|----------|
| `chat` | 聊天消息状态更新 | 流式推送 |
| `agent` | Agent 运行事件（包括工具调用） | 流式推送 |
| `chat.side_result` | 副作用结果 | 按需推送 |
| `session.tool` | 会话工具事件 | 流式推送 |
| `session.message` | 会话消息事件 | 按需推送 |
| `heartbeat` | 心跳 | 每 30 秒 |
| `tick` | 时钟滴答 | 每 30 秒 |
| `health` | 健康状态 | 定期推送 |
| `shutdown` | 关闭通知 | 关闭时 |
| `presence` | 在线状态 | 变化时 |
| `device.pair.requested` | 设备配对请求 | 按需推送 |
| `device.pair.resolved` | 设备配对解决 | 按需推送 |
| `node.pair.requested` | 节点配对请求 | 按需推送 |
| `node.pair.resolved` | 节点配对解决 | 按需推送 |
| `exec.approval.requested` | 执行批准请求 | 按需推送 |
| `exec.approval.resolved` | 执行批准解决 | 按需推送 |
| `plugin.approval.requested` | 插件批准请求 | 按需推送 |
| `plugin.approval.resolved` | 插件批准解决 | 按需推送 |
| `voicewake.changed` | 语音唤醒变化 | 按需推送 |
| `update.available` | 更新可用 | 按需推送 |
| `talk.mode` | 对话模式变化 | 按需推送 |
| `cron` | 定时任务事件 | 按需推送 |

---

## 聊天事件详解

`chat` 事件是最重要的事件类型，包含聊天消息的所有状态更新。

### 事件结构

```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "run-uuid",
    "sessionKey": "main",
    "seq": 1,
    "state": "delta",
    "message": {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "你好！我是 OpenClaw..."
        }
      ],
      "timestamp": 1713456789000
    }
  }
}
```

### state 字段的可能值

| 值 | 说明 | 消息是否完整 |
|----|------|--------------|
| `delta` | 增量更新 | 否，还在继续 |
| `final` | 最终状态 | 是，本次回复结束 |
| `error` | 错误状态 | 是，发生错误 |
| `aborted` | 已中止 | 是，被中止 |

### role 字段的可能值

`message.role` 字段标识消息的发送者类型：

| 值 | 说明 | 使用场景 |
|----|------|----------|
| `user` | 用户消息 | 用户发送的消息内容 |
| `assistant` | 助手消息 | AI 助手的回复内容 |
| `tool` | 工具返回结果 | 工具调用后的返回数据 |
| `system` | 系统提示 | 系统级提示消息（通常不出现在用户界面） |
| `other` | 其他类型 | 其他未分类的消息类型 |

### seq 字段

`seq` 是单调递增的序列号，用于检测消息丢失。客户端应检查 `seq` 是否连续：

```javascript
let lastSeq = 0;

function handleChatEvent(payload) {
  if (payload.seq > lastSeq + 1) {
    console.warn(`消息丢失: 预期 ${lastSeq + 1}, 收到 ${payload.seq}`);
  }
  lastSeq = payload.seq;
  // ... 处理事件
}
```

### 消息内容结构

#### 文本消息

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "这是一段回复"
    }
  ],
  "timestamp": 1713456789000
}
```

#### 思考过程（verbose 模式）

```json
{
  "role": "assistant",
  "content": [
    {
      "type": "thinking",
      "thinking": "让我思考一下..."
    }
  ],
  "timestamp": 1713456789000
}
```

#### 使用信息

```json
{
  "role": "assistant",
  "content": [...],
  "timestamp": 1713456789000,
  "usage": {
    "inputTokens": 100,
    "outputTokens": 200,
    "totalTokens": 300
  },
  "stopReason": "stop"
}
```

#### 错误消息

```json
{
  "runId": "run-uuid",
  "sessionKey": "main",
  "seq": 10,
  "state": "error",
  "errorMessage": "API 请求失败"
}
```

---

## Agent 事件详解

`agent` 事件包含 Agent 运行时的详细信息，包括工具调用、生命周期等。

### 事件结构

```json
{
  "type": "event",
  "event": "agent",
  "payload": {
    "runId": "run-uuid",
    "sessionKey": "main",
    "seq": 5,
    "stream": "tool",
    "ts": 1713456789000,
    "data": {
      "phase": "start",
      "tool": "browser.search",
      "toolTitle": "搜索: 最新新闻",
      "kind": "search"
    }
  }
}
```

### stream 字段的可能值

| 值 | 说明 |
|----|------|
| `lifecycle` | 生命周期事件 |
| `tool` | 工具调用事件 |
| `assistant` | 助手回复事件（流式文本输出） |
| `error` | 错误事件 |
| `reasoning` | 推理过程事件 |
| `attachment` | 附件事件 |

### 工具调用事件 phases

| Phase | 说明 |
|-------|------|
| `start` | 工具调用开始 |
| `update` | 工具执行中（增量更新） |
| `result` | 工具执行完成（包含最终结果或错误） |

**注意：** 工具执行错误通过 `result` 阶段的 `data.isError` 字段标识，而非单独的 `error` 阶段。

### 完整工具调用流程示例

**1. 工具开始：**

```json
{
  "event": "agent",
  "payload": {
    "runId": "run-123",
    "seq": 10,
    "stream": "tool",
    "data": {
      "phase": "start",
      "tool": "browser.search",
      "toolTitle": "搜索: TypeScript 类型",
      "kind": "search"
    }
  }
}
```

**2. 工具进度：**

```json
{
  "event": "agent",
  "payload": {
    "runId": "run-123",
    "seq": 11,
    "stream": "tool",
    "data": {
      "phase": "update",
      "tool": "browser.search",
      "toolTitle": "搜索: TypeScript 类型",
      "kind": "search",
      "partialResult": "找到 5 个结果..."
    }
  }
}
```

**3. 工具完成：**

```json
{
  "event": "agent",
  "payload": {
    "runId": "run-123",
    "seq": 12,
    "stream": "tool",
    "data": {
      "phase": "result",
      "tool": "browser.search",
      "toolTitle": "搜索: TypeScript 类型",
      "kind": "search",
      "result": "完整搜索结果..."
    }
  }
}
```

### 生命周期事件

```json
{
  "event": "agent",
  "payload": {
    "runId": "run-123",
    "seq": 1,
    "stream": "lifecycle",
    "data": {
      "phase": "start",
      "provider": "anthropic",
      "model": "claude-sonnet-4.6"
    }
  }
}
```

### 助手回复事件

```json
{
  "event": "agent",
  "payload": {
    "runId": "run-123",
    "seq": 2,
    "stream": "assistant",
    "ts": 1713456789000,
    "data": {
      "text": "这是助手的流式回复内容",
      "delta": "内容"
    }
  }
}
```

生命周期 phases：

- `start`: Agent 开始运行
- `end`: Agent 运行完成
- `error`: Agent 运行出错

---

## 其他事件类型

### `chat.side_result` - 副作用结果

当 Agent 执行某些操作时产生的副作用：

```json
{
  "type": "event",
  "event": "chat.side_result",
  "payload": {
    "kind": "btw",
    "runId": "run-123",
    "sessionKey": "main",
    "question": "用户的问题",
    "text": "顺便回答的内容",
    "isError": false,
    "ts": 1713456789000,
    "seq": 1
  }
}
```

### `session.message` - 会话消息事件

当有新消息添加到会话转录时推送，用于后加入的客户端获取完整消息历史：

```json
{
  "type": "event",
  "event": "session.message",
  "payload": {
    "sessionKey": "main",
    "message": {
      "id": "message-id",
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "这是完整的消息内容"
        }
      ],
      "timestamp": 1713456789000
    },
    "messageId": "message-id",
    "messageSeq": 10,
    "session": {
      "sessionId": "session-uuid",
      "label": "主会话",
      "thinkingLevel": "high",
      "modelProvider": "anthropic",
      "model": "claude-sonnet-4.6"
    }
  }
}
```

### `session.tool` - 会话工具事件

与 `agent` 事件类似，但包含会话快照信息，用于后加入的客户端：

```json
{
  "type": "event",
  "event": "session.tool",
  "payload": {
    "runId": "run-123",
    "sessionKey": "main",
    "seq": 10,
    "stream": "tool",
    "data": {
      "phase": "start",
      "tool": "browser.search"
    },
    "session": {
      "sessionId": "session-uuid",
      "label": "主会话",
      "thinkingLevel": "high",
      "modelProvider": "anthropic",
      "model": "claude-sonnet-4.6",
      // ... 更多会话信息
    }
  }
}
```

### `heartbeat` - 心跳

```json
{
  "type": "event",
  "event": "heartbeat",
  "payload": {
    "ts": 1713456789000
  },
  "seq": 123
}
```

### `tick` - 时钟

```json
{
  "type": "event",
  "event": "tick",
  "payload": {
    "ts": 1713456789000
  }
}
```

### `health` - 健康状态

```json
{
  "type": "event",
  "event": "health",
  "payload": {
    "uptime": 3600000,
    "memory": {
      "used": 123456789,
      "total": 2000000000
    },
    "sessions": {
      "active": 5,
      "total": 100
    }
  },
  "stateVersion": {
    "health": 123
  }
}
```

### `shutdown` - 关闭通知

```json
{
  "type": "event",
  "event": "shutdown",
  "payload": {
    "reason": "maintenance",
    "restartExpectedMs": 60000
  }
}
```

### 批准事件

#### `exec.approval.requested` - 执行批准请求

```json
{
  "type": "event",
  "event": "exec.approval.requested",
  "payload": {
    "id": "approval-123",
    "request": {
      "command": "rm -rf /path",
      "commandArgv": ["rm", "-rf", "/path"],
      "commandPreview": "rm -rf /path",
      "envKeys": ["HOME", "PATH"],
      "systemRunBinding": {
        "argv": ["rm", "-rf", "/path"],
        "cwd": "/home/user",
        "commandText": "rm -rf /path"
      },
      "systemRunPlan": {
        "argv": ["rm", "-rf", "/path"],
        "cwd": "/home/user",
        "commandText": "rm -rf /path",
        "commandPreview": "rm -rf /path",
        "agentId": "agent-id",
        "sessionKey": "main"
      },
      "cwd": "/home/user",
      "nodeId": "node-id",
      "host": "local",
      "security": "full",
      "ask": "always",
      "allowedDecisions": ["allow-once", "deny"],
      "agentId": "agent-id",
      "resolvedPath": "/usr/bin/rm",
      "sessionKey": "main",
      "turnSourceChannel": "telegram",
      "turnSourceTo": "user-id",
      "turnSourceAccountId": "account-id",
      "turnSourceThreadId": 123
    },
    "createdAtMs": 1713456789000,
    "expiresAtMs": 1713456889000
  }
}
```

#### `exec.approval.resolved` - 执行批准解决

```json
{
  "type": "event",
  "event": "exec.approval.resolved",
  "payload": {
    "id": "approval-123",
    "decision": "allow-once",
    "resolvedBy": "operator",
    "ts": 1713456790000,
    "request": {
      "command": "rm -rf /path",
      "commandArgv": ["rm", "-rf", "/path"],
      "cwd": "/home/user",
      "host": "local",
      "agentId": "agent-id",
      "sessionKey": "main"
    }
  }
}
```

**decision 字段的可能值：**
- `allow-once`: 允许一次
- `allow-always`: 允许总是
- `deny`: 拒绝

#### `plugin.approval.requested` - 插件批准请求

```json
{
  "type": "event",
  "event": "plugin.approval.requested",
  "payload": {
    "id": "plugin-approval-123",
    "request": {
      "pluginId": "plugin-id",
      "title": "需要批准的敏感操作",
      "description": "此操作需要用户批准才能继续执行",
      "severity": "warning",
      "toolName": "sensitive-tool",
      "toolCallId": "tool-call-id",
      "agentId": "agent-id",
      "sessionKey": "main",
      "turnSourceChannel": "telegram",
      "turnSourceTo": "user-id",
      "turnSourceAccountId": "account-id",
      "turnSourceThreadId": 123
    },
    "createdAtMs": 1713456789000,
    "expiresAtMs": 1713456889000
  }
}
```

**severity 字段的可能值：**
- `info`: 信息
- `warning`: 警告
- `critical`: 严重

#### `plugin.approval.resolved` - 插件批准解决

```json
{
  "type": "event",
  "event": "plugin.approval.resolved",
  "payload": {
    "id": "plugin-approval-123",
    "decision": "allow-once",
    "resolvedBy": "operator",
    "ts": 1713456790000,
    "request": {
      "pluginId": "plugin-id",
      "title": "需要批准的敏感操作",
      "description": "此操作需要用户批准才能继续执行"
    }
  }
}
```

### 节点配对事件

#### `node.pair.requested` - 节点配对请求

```json
{
  "type": "event",
  "event": "node.pair.requested",
  "payload": {
    "requestId": "pair-123",
    "nodeId": "node-uuid",
    "displayName": "我的节点",
    "platform": "linux",
    "version": "1.0.0",
    "coreVersion": "2026.04.03",
    "uiVersion": "1.0.0",
    "deviceFamily": "desktop",
    "modelIdentifier": "x86_64",
    "caps": ["bash", "python"],
    "commands": ["bash", "python"],
    "permissions": {
      "bash": true,
      "python": false
    },
    "remoteIp": "192.168.1.100",
    "silent": false,
    "ts": 1713456789000
  }
}
```

#### `node.pair.resolved` - 节点配对解决

```json
{
  "type": "event",
  "event": "node.pair.resolved",
  "payload": {
    "requestId": "pair-123",
    "nodeId": "node-uuid",
    "decision": "approved",
    "ts": 1713456790000
  }
}
```

**decision 字段的可能值：**
- `approved`: 已批准
- `rejected`: 已拒绝

### 设备配对事件

#### `device.pair.requested` - 设备配对请求

```json
{
  "type": "event",
  "event": "device.pair.requested",
  "payload": {
    "requestId": "pair-123",
    "deviceId": "device-uuid",
    "publicKey": "public-key-string",
    "displayName": "我的 iPhone",
    "platform": "ios",
    "deviceFamily": "iPhone",
    "clientId": "control-ui",
    "clientMode": "webchat",
    "role": "operator",
    "roles": ["operator"],
    "scopes": ["operator.read", "operator.write"],
    "remoteIp": "192.168.1.100",
    "silent": false,
    "isRepair": false,
    "ts": 1713456789000
  }
}
```

#### `device.pair.resolved` - 设备配对解决

```json
{
  "type": "event",
  "event": "device.pair.resolved",
  "payload": {
    "requestId": "pair-123",
    "deviceId": "device-uuid",
    "decision": "approved",
    "ts": 1713456790000
  }
}
```

**decision 字段的可能值：**
- `approved`: 已批准
- `rejected`: 已拒绝

---

## 消息结束判断

### 1. 通过 `state` 字段判断

- `state === "final"`: 正常结束
- `state === "error"`: 发生错误
- `state === "aborted"`: 被中止

### 2. 通过 `seq` 字段判断

当收到 `final`/`error`/`aborted` 状态后，该 `runId` 的 `seq` 不再增加。

### 3. 客户端状态管理

建议客户端维护如下状态：

```javascript
const runs = new Map(); // runId -> { state, text, seq, toolCalls }

function handleChatEvent(payload) {
  const { runId, state, seq, message } = payload;

  if (!runs.has(runId)) {
    runs.set(runId, {
      state: 'running',
      text: '',
      seq: 0,
      toolCalls: []
    });
  }

  const run = runs.get(runId);
  run.seq = seq;

  if (state === 'delta') {
    // 追加文本
    const text = extractText(message);
    run.text = appendText(run.text, text);
  } else if (state === 'final') {
    run.state = 'completed';
    run.text = extractText(message);
    // 标记完成
  } else if (state === 'error') {
    run.state = 'error';
    run.error = payload.errorMessage;
  } else if (state === 'aborted') {
    run.state = 'aborted';
  }
}

function isRunFinished(runId) {
  const run = runs.get(runId);
  return run && ['completed', 'error', 'aborted'].includes(run.state);
}
```

### 4. 区分工具调用和聊天消息

**工具调用**会通过 `agent` 事件推送，`stream === "tool"`：

```javascript
function handleAgentEvent(payload) {
  if (payload.stream === 'tool') {
    const { phase, tool, toolTitle } = payload.data;

    if (phase === 'start') {
      console.log(`工具开始: ${toolTitle}`);
    } else if (phase === 'update') {
      console.log(`工具更新: ${toolTitle}`);
    } else if (phase === 'result') {
      const isError = data.isError === true;
      if (isError) {
        console.log(`工具错误: ${toolTitle}`);
      } else {
        console.log(`工具完成: ${toolTitle}`);
      }
    }
  }
}
```

**聊天消息**通过 `chat` 事件推送，`state === "delta"`/`"final"`。

---

## 完整示例

### JavaScript/WebSocket 客户端示例

```javascript
class OpenClawClient {
  constructor(url, token) {
    this.url = url;
    this.token = token;
    this.ws = null;
    this.pendingRequests = new Map();
    this.messageHandlers = new Map();
    this.runs = new Map();
    this.lastSeq = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.connectNonce = null;

      this.ws.onopen = () => {
        console.log('WebSocket 已连接');
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket 已关闭:', event.code, event.reason);
      };

      // 设置消息处理器
      this.on('connect.challenge', this.handleChallenge.bind(this));
      this.on('hello-ok', this.handleHelloOk.bind(this));
      this.on('chat', this.handleChatEvent.bind(this));
      this.on('agent', this.handleAgentEvent.bind(this));
    });
  }

  handleMessage(frame) {
    if (frame.type === 'event') {
      const handler = this.messageHandlers.get(frame.event);
      if (handler) {
        handler(frame.payload, frame.seq, frame.stateVersion);
      }
    } else if (frame.type === 'res') {
      const pending = this.pendingRequests.get(frame.id);
      if (pending) {
        this.pendingRequests.delete(frame.id);
        if (frame.ok) {
          pending.resolve(frame.payload);
        } else {
          pending.reject(new Error(frame.error?.message || '请求失败'));
        }
      }
    }
  }

  on(eventName, handler) {
    this.messageHandlers.set(eventName, handler);
  }

  handleChallenge(payload) {
    this.connectNonce = payload.nonce;
    console.log('收到连接挑战，发送认证请求...');
    this.authenticate();
  }

  handleHelloOk(payload) {
    console.log('认证成功!', payload);
  }

  async authenticate() {
    const response = await this.request('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'my-client',
        displayName: 'My Client',
        version: '1.0.0',
        platform: 'web',
        mode: 'webchat'
      },
      caps: ['tool-events'],
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      auth: {
        token: this.token
      },
      locale: 'zh-CN'
    });
    console.log('认证响应:', response);
  }

  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = generateUUID();
      this.ws.send(JSON.stringify({
        type: 'req',
        id,
        method,
        params
      }));

      this.pendingRequests.set(id, { resolve, reject });

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('请求超时'));
        }
      }, 30000);
    });
  }

  async sendMessage(sessionKey, message, options = {}) {
    const idempotencyKey = generateUUID();
    const response = await this.request('chat.send', {
      sessionKey,
      message,
      thinking: options.thinking,
      idempotencyKey,
      attachments: options.attachments || []
    });

    console.log('消息已发送:', response);
    return response.runId;
  }

  handleChatEvent(payload, seq) {
    // 检查序列号
    if (seq && this.lastSeq > 0 && seq > this.lastSeq + 1) {
      console.warn(`消息丢失: 预期 ${this.lastSeq + 1}, 收到 ${seq}`);
    }
    if (seq) {
      this.lastSeq = seq;
    }

    const { runId, state, message } = payload;

    // 初始化运行状态
    if (!this.runs.has(runId)) {
      this.runs.set(runId, {
        state: 'running',
        text: '',
        errorMessage: null,
        toolCalls: []
      });
    }

    const run = this.runs.get(runId);

    if (state === 'delta') {
      // 增量更新
      const text = this.extractText(message);
      run.text = this.appendText(run.text, text);
      this.onMessageDelta(runId, text);
    } else if (state === 'final') {
      // 最终消息
      run.state = 'completed';
      run.text = this.extractText(message);
      this.onMessageComplete(runId, run.text);
    } else if (state === 'error') {
      // 错误
      run.state = 'error';
      run.errorMessage = payload.errorMessage;
      this.onMessageError(runId, payload.errorMessage);
    } else if (state === 'aborted') {
      // 中止
      run.state = 'aborted';
      this.onMessageAborted(runId);
    }
  }

  handleAgentEvent(payload) {
    const { runId, stream, data, sessionKey } = payload;

    if (stream === 'tool') {
      const { phase, tool, toolTitle, kind } = data;

      if (phase === 'start') {
        this.onToolStart(runId, tool, toolTitle, kind);
      } else if (phase === 'update') {
        this.onToolUpdate(runId, tool, data.partialResult);
      } else if (phase === 'result') {
        const isError = data.isError === true;
        if (isError) {
          this.onToolError(runId, tool, data.error);
        } else {
          this.onToolDone(runId, tool, data.result);
        }
      }
    } else if (stream === 'lifecycle') {
      this.onLifecycleEvent(runId, data.phase, data);
    }
  }

  extractText(message) {
    if (!message) return '';
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      return message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');
    }
    return '';
  }

  appendText(previous, next) {
    if (!previous) return next;
    if (!next) return previous;
    if (next.startsWith(previous)) return next;
    return previous + next;
  }

  // 事件回调（由子类实现）
  onMessageDelta(runId, text) { console.log(`[${runId}] 增量:`, text); }
  onMessageComplete(runId, text) { console.log(`[${runId}] 完成:`, text); }
  onMessageError(runId, error) { console.error(`[${runId}] 错误:`, error); }
  onMessageAborted(runId) { console.log(`[${runId}] 已中止`); }
  onToolStart(runId, tool, title, kind) { console.log(`[${runId}] 工具开始:`, title); }
  onToolUpdate(runId, tool, progress) { console.log(`[${runId}] 工具更新:`, progress); }
  onToolDone(runId, tool, result) { console.log(`[${runId}] 工具完成:`, tool); }
  onToolError(runId, tool, error) { console.error(`[${runId}] 工具错误:`, error); }
  onLifecycleEvent(runId, phase, data) { console.log(`[${runId}] 生命周期:`, phase); }
}

// 使用示例
(async () => {
  const client = new OpenClawClient('ws://localhost:18789/gateway', 'your-token');
  await client.connect();

  // 发送消息
  const runId = await client.sendMessage('main', '你好，请介绍一下自己');

  // 等待完成（在实际应用中，应该通过回调处理）
  await new Promise(resolve => setTimeout(resolve, 5000));
})();
```

### Python 示例

```python
import asyncio
import json
import uuid
import websockets
from typing import Dict, Callable, Any

class OpenClawClient:
    def __init__(self, url: str, token: str):
        self.url = url
        self.token = token
        self.ws = None
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.message_handlers: Dict[str, Callable] = {}
        self.runs: Dict[str, Dict] = {}
        self.last_seq = 0

    async def connect(self):
        self.ws = await websockets.connect(self.url)

        # 注册消息处理器
        self.on('connect.challenge', self.handle_challenge)
        self.on('hello-ok', self.handle_hello_ok)
        self.on('chat', self.handle_chat_event)
        self.on('agent', self.handle_agent_event)

        # 启动消息接收循环
        asyncio.create_task(self.receive_messages())

    async def receive_messages(self):
        async for message in self.ws:
            frame = json.loads(message)
            await self.handle_message(frame)

    async def handle_message(self, frame: dict):
        if frame['type'] == 'event':
            handler = self.message_handlers.get(frame['event'])
            if handler:
                await handler(
                    frame.get('payload'),
                    frame.get('seq'),
                    frame.get('stateVersion')
                )
        elif frame['type'] == 'res':
            request_id = frame['id']
            future = self.pending_requests.get(request_id)
            if future:
                self.pending_requests.pop(request_id)
                if frame['ok']:
                    future.set_result(frame.get('payload'))
                else:
                    error = frame.get('error', {})
                    future.set_exception(Exception(error.get('message', '请求失败')))

    def on(self, event_name: str, handler: Callable):
        self.message_handlers[event_name] = handler

    async def handle_challenge(self, payload: dict, seq: int = None, state_version: dict = None):
        self.connect_nonce = payload['nonce']
        print('收到连接挑战，发送认证请求...')
        await self.authenticate()

    async def handle_hello_ok(self, payload: dict, seq: int = None, state_version: dict = None):
        print('认证成功!', payload)

    async def authenticate(self):
        response = await self.request('connect', {
            'minProtocol': 3,
            'maxProtocol': 3,
            'client': {
                'id': 'my-client',
                'displayName': 'My Client',
                'version': '1.0.0',
                'platform': 'web',
                'mode': 'webchat'
            },
            'caps': ['tool-events'],
            'role': 'operator',
            'scopes': ['operator.read', 'operator.write'],
            'auth': {
                'token': self.token
            },
            'locale': 'zh-CN'
        })
        print('认证响应:', response)

    async def request(self, method: str, params: dict) -> Any:
        request_id = str(uuid.uuid4())
        frame = {
            'type': 'req',
            'id': request_id,
            'method': method,
            'params': params
        }

        future = asyncio.Future()
        self.pending_requests[request_id] = future

        await self.ws.send(json.dumps(frame))

        try:
            return await asyncio.wait_for(future, timeout=30.0)
        except asyncio.TimeoutError:
            self.pending_requests.pop(request_id, None)
            raise Exception('请求超时')

    async def send_message(self, session_key: str, message: str, **options) -> str:
        idempotency_key = str(uuid.uuid4())
        response = await self.request('chat.send', {
            'sessionKey': session_key,
            'message': message,
            'thinking': options.get('thinking'),
            'idempotencyKey': idempotency_key,
            'attachments': options.get('attachments', [])
        })
        print('消息已发送:', response)
        return response['runId']

    async def handle_chat_event(self, payload: dict, seq: int = None, state_version: dict = None):
        # 检查序列号
        if seq and self.last_seq > 0 and seq > self.last_seq + 1:
            print(f'警告: 消息丢失, 预期 {self.last_seq + 1}, 收到 {seq}')
        if seq:
            self.last_seq = seq

        run_id = payload['runId']
        state = payload['state']
        message = payload.get('message')

        # 初始化运行状态
        if run_id not in self.runs:
            self.runs[run_id] = {
                'state': 'running',
                'text': '',
                'error_message': None,
                'tool_calls': []
            }

        run = self.runs[run_id]

        if state == 'delta':
            # 增量更新
            text = self.extract_text(message)
            run['text'] = self.append_text(run['text'], text)
            await self.on_message_delta(run_id, text)
        elif state == 'final':
            # 最终消息
            run['state'] = 'completed'
            run['text'] = self.extract_text(message)
            await self.on_message_complete(run_id, run['text'])
        elif state == 'error':
            # 错误
            run['state'] = 'error'
            run['error_message'] = payload.get('errorMessage')
            await self.on_message_error(run_id, payload.get('errorMessage'))
        elif state == 'aborted':
            # 中止
            run['state'] = 'aborted'
            await self.on_message_aborted(run_id)

    async def handle_agent_event(self, payload: dict, seq: int = None, state_version: dict = None):
        run_id = payload['runId']
        stream = payload['stream']
        data = payload['data']

        if stream == 'tool':
            phase = data.get('phase')
            tool = data.get('tool')
            title = data.get('toolTitle')
            kind = data.get('kind')

            if phase == 'start':
                await self.on_tool_start(run_id, tool, title, kind)
            elif phase == 'update':
                await self.on_tool_update(run_id, tool, data.get('partialResult'))
            elif phase == 'result':
                is_error = data.get('isError') is True
                if is_error:
                    await self.on_tool_error(run_id, tool, data.get('error'))
                else:
                    await self.on_tool_done(run_id, tool, data.get('result'))
        elif stream == 'lifecycle':
            await self.on_lifecycle_event(run_id, data.get('phase'), data)

    def extract_text(self, message: dict) -> str:
        if not message:
            return ''
        content = message.get('content')
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            texts = [block.get('text', '') for block in content if block.get('type') == 'text']
            return ''.join(texts)
        return ''

    def append_text(self, previous: str, next_text: str) -> str:
        if not previous:
            return next_text
        if not next_text:
            return previous
        if next_text.startswith(previous):
            return next_text
        return previous + next_text

    # 事件回调（由子类实现）
    async def on_message_delta(self, run_id: str, text: str):
        print(f'[{run_id}] 增量: {text}')

    async def on_message_complete(self, run_id: str, text: str):
        print(f'[{run_id}] 完成: {text}')

    async def on_message_error(self, run_id: str, error: str):
        print(f'[{run_id}] 错误: {error}')

    async def on_message_aborted(self, run_id: str):
        print(f'[{run_id}] 已中止')

    async def on_tool_start(self, run_id: str, tool: str, title: str, kind: str):
        print(f'[{run_id}] 工具开始: {title}')

    async def on_tool_update(self, run_id: str, tool: str, progress: Any):
        print(f'[{run_id}] 工具更新: {progress}')

    async def on_tool_done(self, run_id: str, tool: str, result: Any):
        print(f'[{run_id}] 工具完成: {tool}')

    async def on_tool_error(self, run_id: str, tool: str, error: Any):
        print(f'[{run_id}] 工具错误: {error}')

    async def on_lifecycle_event(self, run_id: str, phase: str, data: dict):
        print(f'[{run_id}] 生命周期: {phase}')

# 使用示例
async def main():
    client = OpenClawClient('ws://localhost:18789/gateway', 'your-token')
    await client.connect()

    # 等待认证完成
    await asyncio.sleep(1)

    # 发送消息
    run_id = await client.send_message('main', '你好，请介绍一下自己')

    # 等待完成
    await asyncio.sleep(5)

if __name__ == '__main__':
    asyncio.run(main())
```

---

## 附录

### 常见问题

**Q: 如何判断一条消息是否结束？**

A: 检查 `chat` 事件的 `state` 字段：
- `state === "final"`: 正常结束
- `state === "error"`: 错误结束
- `state === "aborted"`: 被中止

**Q: 如何区分普通文本和工具调用？**

A:
- 普通文本：通过 `chat` 事件推送，`state === "delta"` 或 `"final"`
- 工具调用：通过 `agent` 事件推送，`stream === "tool"`

**Q: 如果客户端断线重连，如何恢复状态？**

A:
1. 重新连接并认证
2. 调用 `chat.history` 获取历史消息
3. 如果有正在进行的运行，需要重新订阅

**Q: `seq` 字段的作用是什么？**

A: `seq` 是单调递增的序列号，用于检测消息丢失。客户端应检查 `seq` 是否连续。

**Q: 如何处理大量工具调用？**

A:
1. 在连接时声明 `caps: ["tool-events"]`
2. 监听 `agent` 事件，`stream === "tool"`
3. 根据 `phase` 字段更新工具状态

**Q: 消息内容中的 `content` 字段格式是什么？**

A: `content` 是一个数组，包含多个内容块：
```json
{
  "content": [
    { "type": "text", "text": "普通文本" },
    { "type": "thinking", "thinking": "思考内容" }
  ]
}
```

### 协议版本

当前协议版本为 `3`。客户端应在连接时声明：

```json
{
  "minProtocol": 3,
  "maxProtocol": 3
}
```

### 认证方式

1. **Token 认证**（推荐生产环境）
```json
{
  "auth": {
    "token": "your-gateway-token"
  }
}
```

2. **密码认证**（本地开发）
```json
{
  "auth": {
    "password": "your-password"
  }
}
```

3. **设备认证**（移动端）
```json
{
  "device": {
    "id": "device-id",
    "publicKey": "public-key",
    "signature": "signature",
    "signedAt": 1713456789000,
    "nonce": "nonce-from-challenge"
  }
}
```

### 参考资料

- OpenClaw 源码：`src/gateway/protocol/`
- 协议定义：`src/gateway/protocol/schema.ts`
- 事件处理：`src/gateway/server-chat.ts`
- 客户端实现：`ui/src/ui/gateway.ts`

---

**文档版本：** 1.1.0  
**最后更新：** 2026-04-08  
**协议版本：** 3
