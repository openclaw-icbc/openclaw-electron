/**
 * Vue 3 应用入口
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/styles/tailwind.css'

// High DPI Fix
(function() {
  const dpr = window.devicePixelRatio || 1;
  if (dpr >= 1.5) {
    document.documentElement.setAttribute('data-dpr', dpr.toString());
    if (document.body) {
      (document.body.style as any).webkitFontSmoothing = 'antialiased';
      (document.body.style as any).mozOsxFontSmoothing = 'grayscale';
    }
  }
})();

// 创建应用实例
const app = createApp(App)

// 创建 Pinia 状态管理
const pinia = createPinia()
app.use(pinia)

// 挂载应用
app.mount('#app')

// 开发环境下调试信息
if (import.meta.env?.DEV) {
  console.log('=== VUE APP LOADED ===')
  console.log('Vue version:', app.version)
  console.log('Electron API available:', !!window.electronAPI)
  if (window.electronAPI) {
    console.log('Electron API methods:', Object.keys(window.electronAPI))
  }
}
