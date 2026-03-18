# OpenClaw Electron - Vue 3 前端

这是 OpenClaw Electron 桌面客户端的 Vue 3 前端项目，采用工程化架构设计。

## 项目结构

```
frontend/
├── src/
│   ├── api/                  # API 调用封装
│   │   ├── electron.d.ts     # Electron API 类型声明
│   │   ├── gateway.ts        # Gateway 相关 API
│   │   ├── chat.ts           # 聊天相关 API
│   │   ├── config.ts         # 配置管理 API
│   │   └── logs.ts           # 日志相关 API
│   │
│   ├── assets/               # 静态资源
│   │   └── styles/           # 样式文件
│   │       ├── main.css      # 主样式（从原项目迁移）
│   │       └── tailwind.css  # Tailwind CSS 入口
│   │
│   ├── components/           # Vue 组件
│   │   ├── common/           # 通用组件
│   │   │   ├── TitleBar.vue        # 标题栏
│   │   │   ├── Toast.vue           # Toast 通知
│   │   │   ├── Loading.vue         # 加载动画
│   │   │   └── ConfirmDialog.vue   # 确认对话框
│   │   ├── chat/             # 聊天相关组件
│   │   │   ├── ChatView.vue        # 聊天视图（待完善）
│   │   │   ├── MessageList.vue     # 消息列表
│   │   │   ├── MessageItem.vue     # 单条消息
│   │   │   └── WelcomeScreen.vue   # 欢迎屏幕
│   │   ├── session/          # 会话相关组件
│   │   │   └── SessionItem.vue     # 会话项
│   │   └── settings/        # 设置相关组件
│   │       ├── SettingsDialog.vue   # 设置对话框
│   │       ├── SessionsPanel.vue    # 会话设置面板
│   │       ├── CronPanel.vue        # 定时任务面板
│   │       ├── ConfigPanel.vue      # 配置面板
│   │       └── LogsPanel.vue        # 日志面板
│   │
│   ├── composables/          # Composition API 钩子
│   │   ├── useChat.ts        # 聊天功能
│   │   └── useGateway.ts     # Gateway 连接
│   │
│   ├── stores/               # Pinia 状态管理
│   │   ├── chat.ts           # 聊天状态
│   │   ├── config.ts         # 配置状态
│   │   ├── gateway.ts        # Gateway 状态
│   │   ├── logs.ts           # 日志状态
│   │   └── ui.ts             # UI 状态
│   │
│   ├── types/                # TypeScript 类型定义
│   │   ├── chat.ts           # 聊天相关类型
│   │   ├── gateway.ts        # Gateway 相关类型
│   │   ├── config.ts         # 配置相关类型
│   │   ├── logs.ts           # 日志相关类型
│   │   └── ui.ts             # UI 相关类型
│   │
│   ├── utils/                # 工具函数
│   │   ├── format.ts         # 格式化函数
│   │   ├── markdown.ts       # Markdown 处理
│   │   └── helpers.ts        # 辅助函数
│   │
│   ├── router/               # 路由配置（预留）
│   │   └── index.ts
│   │
│   ├── App.vue               # 根组件
│   └── main.ts               # 应用入口
│
├── index.html                # HTML 入口
├── vite.config.ts            # Vite 配置
├── tsconfig.json             # TypeScript 配置
├── tailwind.config.js        # Tailwind CSS 配置
├── postcss.config.js         # PostCSS 配置
├── package.json              # 项目依赖
└── README.md                 # 本文档
```

## 技术栈

### 核心框架
- **Vue 3.4+** - 渐进式 JavaScript 框架，使用 Composition API
- **TypeScript 5.7+** - JavaScript 的超集，提供类型安全
- **Vite 5.4+** - 新一代前端构建工具

### 状态管理
- **Pinia 2.2+** - Vue 3 官方推荐的状态管理库

### 样式
- **Tailwind CSS 4.2+** - 实用优先的 CSS 框架
- **现有样式** - 完全保留原项目的样式系统

### 工具库
- **Marked.js** - Markdown 解析器

## 特性

### ✅ 已实现
- 完整的项目架构和目录结构
- TypeScript 类型定义
- Pinia 状态管理
- API 层封装
- 通用 UI 组件（Toast、Loading、ConfirmDialog）
- 基础聊天界面（SessionItem、MessageList、WelcomeScreen）
- 设置对话框框架
- 工具函数库（格式化、Markdown处理、辅助函数）
- 样式系统（保留原项目样式）

### 🚧 待完善
- 完整的聊天功能实现
- 创建新会话功能
- 会话管理功能
- 定时任务管理
- 更完善的错误处理
- 单元测试

## 开发指南

### 环境要求
- Node.js >= 22.0.0
- npm 或 pnpm

### 安装依赖

```bash
cd frontend
npm install
```

### 开发模式

```bash
# 启动 Vite 开发服务器
npm run dev

# 在另一个终端启动 Electron
cd ..
npm run dev
```

### 构建

```bash
# 构建前端资源
npm run build

# 构建结果会输出到 ../dist/renderer 目录
```

### 类型检查

```bash
npm run type-check
```

## 与 Electron 主进程集成

### API 通信

前端通过 `window.electronAPI` 与 Electron 主进程通信：

```typescript
// 发送消息
await window.electronAPI.sendMessage(sessionKey, message, attachments)

// 获取配置
const config = await window.electronAPI.getConfig()

// 监听事件
window.electronAPI.onGatewayConnected((hello) => {
  console.log('Connected:', hello)
})
```

### 类型安全

所有 Electron API 都有完整的 TypeScript 类型定义，位于 `src/api/electron.d.ts`。

## 状态管理

### 使用 Pinia Stores

```typescript
import { useChatStore, useConfigStore } from '@/stores'

// 在组件中使用
const chatStore = useChatStore()
const configStore = useConfigStore()

// 访问状态
const { sessions, currentSessionKey } = storeToRefs(chatStore)

// 调用 actions
await chatStore.loadSessions()
```

### 可用的 Stores

- `useChatStore` - 聊天状态和操作
- `useConfigStore` - 配置管理
- `useGatewayStore` - Gateway 连接状态
- `useLogsStore` - 日志管理
- `useUiStore` - UI 状态（Toast、Loading、Dialog）

## 组件开发

### 创建新组件

1. 在对应的目录下创建 `.vue` 文件
2. 使用 `<script setup lang="ts">` 语法
3. 遵循现有的代码风格

```vue
<template>
  <div class="my-component">
    {{ message }}
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const message = ref('Hello Vue 3!')
</script>

<style scoped>
.my-component {
  /* 样式 */
}
</style>
```

### 使用 Composition API

```typescript
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores'

const chatStore = useChatStore()
const { sessions } = storeToRefs(chatStore)

const loading = ref(false)

onMounted(async () => {
  loading.value = true
  await chatStore.loadSessions()
  loading.value = false
})
```

## 样式指南

### 使用 Tailwind CSS

```vue
<template>
  <div class="flex items-center gap-2 p-4 bg-background border border-border rounded-lg">
    <!-- 内容 -->
  </div>
</template>
```

### CSS 变量

项目使用 CSS 变量定义主题：

```css
background: hsl(var(--background))
color: hsl(var(--foreground))
border-color: hsl(var(--border))
```

### 响应式设计

使用 Tailwind 的响应式前缀：

```html
<div class="text-sm md:text-base lg:text-lg">
  响应式文本
</div>
```

## 兼容性

### Node.js 版本
- 支持 Node.js 22.x 和 24.x
- 在 `package.json` 中指定了 `engines` 字段

### 离线环境
- 所有依赖在开发时下载
- 构建产物包含所有必要的资源
- 无需运行时网络连接

## 构建配置

### Vite 配置

`vite.config.ts` 包含以下配置：
- Vue 插件
- 路径别名（`@` 指向 `src`）
- 构建输出到 `../dist/renderer`
- 开发服务器配置

### TypeScript 配置

`tsconfig.json` 提供严格的类型检查：
- 扩展 `@vue/tsconfig/tsconfig.dom.json`
- 启用所有严格模式选项
- 支持路径别名

## 故障排除

### 常见问题

1. **类型错误**
   ```bash
   # 重新生成类型
   npm run type-check
   ```

2. **构建失败**
   ```bash
   # 清理缓存
   rm -rf node_modules dist
   npm install
   npm run build
   ```

3. **样式不生效**
   - 检查 Tailwind CSS 配置
   - 确保样式文件正确导入

## 下一步

1. **完善聊天功能** - 实现完整的消息收发和流式处理
2. **会话管理** - 实现创建、编辑、删除会话
3. **定时任务** - 完善定时任务管理界面
4. **测试** - 添加单元测试和端到端测试
5. **优化** - 性能优化和用户体验改进

## 贡献指南

1. 遵循现有的代码风格
2. 添加 TypeScript 类型定义
3. 编写清晰的注释
4. 确保样式一致性
5. 测试所有功能

## 许可证

MIT
