/**
 * Markdown 处理工具函数
 */

import { marked } from 'marked'

/**
 * 将 Markdown 转换为 HTML
 */
export async function renderMarkdown(markdown: string | any[]): Promise<string> {
  // Handle array content (convert to string)
  if (Array.isArray(markdown)) {
    markdown = markdown.map((part: any) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') {
        if (part.type === 'text' && part.text) return part.text
        if (part.content) return part.content
      }
      return String(part)
    }).join('')
  }
  if (!markdown || typeof markdown !== 'string') return ''
  try {
    return await marked(markdown)
  } catch (error) {
    console.error('Failed to render markdown:', error)
    return escapeHtml(String(markdown))
  }
}

/**
 * 将 Markdown 转换为 HTML（同步版本）
 */
export function renderMarkdownSync(markdown: string | any[]): string {
  // Handle array content (convert to string)
  if (Array.isArray(markdown)) {
    markdown = markdown.map((part: any) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') {
        if (part.type === 'text' && part.text) return part.text
        if (part.content) return part.content
      }
      return String(part)
    }).join('')
  }
  if (!markdown || typeof markdown !== 'string') return ''
  try {
    const result = marked.parse(markdown)
    // 如果返回的是 Promise，我们暂时返回转义后的 HTML
    return typeof result === 'string' ? result : escapeHtml(markdown)
  } catch (error) {
    console.error('Failed to render markdown:', error)
    return escapeHtml(String(markdown))
  }
}

/**
 * 转义 HTML 特殊字符
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 提取 Markdown 纯文本（移除格式）
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return ''

  return markdown
    // 移除标题
    .replace(/^#{1,6}\s+/gm, '')
    // 移除加粗
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/___/g, '')
    .replace(/__/g, '')
    // 移除斜体
    .replace(/\*/g, '')
    .replace(/_/g, '')
    // 移除删除线
    .replace(/~~/g, '')
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`/g, '')
    // 移除链接
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 移除图片
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 移除引用
    .replace(/^>\s+/gm, '')
    // 移除水平线
    .replace(/^---$/gm, '')
    .replace(/^\*\*\*$/gm, '')
    // 清理多余空行
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
