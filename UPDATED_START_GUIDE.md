# ✅ 启动步骤已优化！

## 🎯 现在只需要一个命令

### 推荐方式（自动构建 + 启动）

```bash
npm run dev
```

**现在会自动执行：**
1. ✅ 构建 frontend（Vue 3）
2. ✅ 编译主进程（TypeScript）
3. ✅ 启动 Electron 应用

**一行命令搞定！** 🎉

---

## 📋 所有可用命令

### 日常使用

| 命令 | 作用 | 推荐度 |
|------|------|--------|
| `npm run dev` | **一键构建并启动** | ⭐⭐⭐⭐⭐ |
| `npm run dev:electron` | 只启动 Electron（开发模式） | ⭐⭐⭐⭐ |
| `npm run dev:hot` | 热重载模式（需要 Vite 服务器） | ⭐⭐⭐ |
| `npm start` | 启动 Electron（生产模式） | ⭐⭐⭐ |

### 构建命令

| 命令 | 作用 |
|------|------|
| `npm run build` | 构建主进程 |
| `npm run build:frontend` | 单独构建前端 |

---

## 🔥 详细的启动方式

### 1️⃣ 一键启动（推荐）⭐

```bash
npm run dev
```

**优点：**
- ✅ 自动构建前端
- ✅ 自动编译主进程
- ✅ 自动启动应用
- ✅ **最简单，最推荐**

**适用场景：**
- 日常开发
- 快速测试
- 第一次运行

---

### 2️⃣ 热重载开发（进阶）

```bash
# 终端 1：启动 Vite 开发服务器
cd frontend
npm run dev

# 终端 2：启动 Electron（连接 Vite）
cd ..
npm run dev:hot
```

**优点：**
- ✅ 修改 Vue 组件后自动重载
- ✅ 无需重新构建

**适用场景：**
- 大量修改前端 UI
- 需要快速迭代

---

### 3️⃣ 只启动 Electron（已构建）

```bash
npm start
```

**优点：**
- ✅ 快速启动（不编译）
- ✅ 适合快速测试

**适用场景：**
- 前端已经构建好了
- 只测试 Electron 功能

---

## ✅ 验证新配置

让我测试一下新的 `npm run dev` 命令：

```bash
npm run dev
```

**应该会看到：**
1. 📦 构建前端...
2. 🔨 编译主进程...
3. 🚀 启动 Electron...
4. ✅ 应用运行

---

## 🎊 总结

### 现在的启动流程（超简单）

**最简单：**
```bash
npm run dev
```

**如果需要热重载：**
```bash
# 终端 1
cd frontend && npm run dev

# 终端 2
cd .. && npm run dev:hot
```

---

## 💡 常见问题

### Q: 我应该用哪个命令？

**A:**
- **日常使用**：`npm run dev`（一个命令搞定）
- **前端开发**：`npm run dev:hot`（需要两个终端）
- **快速测试**：`npm start`（最快）

### Q: 修改了 Vue 组件怎么办？

**A:**
- **方式 1**：重新运行 `npm run dev`
- **方式 2**：使用热重载模式 `npm run dev:hot`

### Q: 修改了 src/ 下的代码怎么办？

**A:** 重新运行 `npm run dev`（会自动重新编译）

---

**现在启动超级简单，只需要一个命令：`npm run dev`！** 🚀
