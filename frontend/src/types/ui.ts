/**
 * UI 相关类型定义
 */

export interface UiState {
  sidebarWidth: number
  settingsDialogOpen: boolean
  settingsActiveTab: string
  loading: boolean
  loadingMessage: string
  toasts: Toast[]
}

export interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

export interface DialogState {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
}
