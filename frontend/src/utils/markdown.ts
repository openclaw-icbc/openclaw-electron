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
 * 同步渲染 Markdown（用于 Vue computed）
 * 优先使用 marked.parse，遇到 Promise 或错误时使用轻量同步回退
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
    if (typeof result === 'string') return result
    // marked.parse 返回 Promise（极少情况）：用轻量回退渲染
    console.warn('[renderMarkdownSync] marked.parse returned Promise, using fallback')
    return syncMarkdownFallback(markdown)
  } catch (error) {
    console.error('[renderMarkdownSync] marked.parse error:', error)
    return syncMarkdownFallback(markdown)
  }
}

/**
 * 轻量同步 Markdown 回退（处理最常见语法）
 * 用于 marked.parse 失败或返回 Promise 时，避免直接显示原始语法
 */
function syncMarkdownFallback(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inCode = false
  let codeLang = ''
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCode) {
        // 代码块结束
        result.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
        codeLines = []
        codeLang = ''
        inCode = false
      } else {
        // 代码块开始
        codeLang = line.slice(3).trim()
        inCode = true
      }
      continue
    }

    if (inCode) {
      codeLines.push(escapeHtml(line))
      continue
    }

    // 行内代码
    let processed = line.replace(/`([^`]+)`/g, '<code>$1</code>')
    // 加粗
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>')
    // 斜体
    processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>')
    processed = processed.replace(/_(.+?)_/g, '<em>$1</em>')
    // 删除线
    processed = processed.replace(/~~(.+?)~~/g, '<del>$1</del>')
    // 链接
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // 图片
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // 标题
    const headingMatch = processed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      processed = `<h${level}>${headingMatch[2]}</h${level}>`
    } else if (processed.startsWith('> ')) {
      processed = `<blockquote>${processed.slice(2)}</blockquote>`
    } else if (processed.startsWith('- ') || processed.startsWith('* ')) {
      processed = `<li>${processed.slice(2)}</li>`
    } else if (processed === '') {
      processed = '<br>'
    } else {
      processed = `<p>${processed}</p>`
    }

    result.push(processed)
  }

  // 如果代码块没有闭合（流式传输中常见），仍然渲染已收集的内容
  if (inCode) {
    result.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
  }

  return result.join('\n')
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
