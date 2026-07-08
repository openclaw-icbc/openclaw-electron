/**
 * Markdown 处理工具函数
 */

import { marked } from 'marked'

// 允许渲染的 HTML 标签（覆盖 Markdown 输出及 MessageItem 里的工具徽章）
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'del', 's', 'u', 'a', 'img',
  'ul', 'ol', 'li', 'blockquote',
  'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'svg', 'g', 'path', 'circle', 'rect', 'polyline', 'line'
])

const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_TAGS = new Set(['svg', 'g', 'path', 'circle', 'rect', 'polyline', 'line', 'polygon'])

// 允许保留的属性（style/script/事件处理器等会被过滤掉）
const ALLOWED_ATTRS = new Set([
  'class', 'href', 'src', 'alt', 'title', 'target', 'rel',
  'width', 'height', 'viewbox', 'fill', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'd', 'points', 'cx', 'cy', 'r', 'x', 'y'
])

// 直接丢弃的标签（包括其内容），防止注入全局样式/脚本或破坏页面结构
const DROP_TAGS = new Set([
  'style', 'script', 'iframe', 'object', 'embed',
  'meta', 'link', 'head', 'body', 'html', 'form', 'input', 'button'
])

/**
 * 白名单 HTML 消毒：移除/转义可能破坏页面布局的原始 HTML（
 * <style>、<script>、未闭合标签、事件处理器等）
 */
function sanitizeHtml(html: string): string {
  if (!html) return ''
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const cleanNode = (node: Node): Node | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || '')
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return null

      const el = node as Element
      const tag = el.tagName.toLowerCase()

      // 直接丢弃危险标签及其内容
      if (DROP_TAGS.has(tag)) return null

      // 不允许的标签直接“拆包”其文本和子节点
      if (!ALLOWED_TAGS.has(tag)) {
        const fragment = document.createDocumentFragment()
        el.childNodes.forEach(child => {
          const cleaned = cleanNode(child)
          if (cleaned) fragment.appendChild(cleaned)
        })
        return fragment
      }

      const out = SVG_TAGS.has(tag)
        ? document.createElementNS(SVG_NS, tag)
        : document.createElement(tag)
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase()
        if (ALLOWED_ATTRS.has(name)) {
          out.setAttribute(attr.name, attr.value)
        }
      })

      el.childNodes.forEach(child => {
        const cleaned = cleanNode(child)
        if (cleaned) out.appendChild(cleaned)
      })
      return out
    }

    const fragment = document.createDocumentFragment()
    Array.from(doc.body.childNodes).forEach(child => {
      const cleaned = cleanNode(child)
      if (cleaned) fragment.appendChild(cleaned)
    })

    const wrapper = document.createElement('div')
    wrapper.appendChild(fragment)
    return wrapper.innerHTML
  } catch (error) {
    console.error('[sanitizeHtml] Failed to sanitize HTML:', error)
    return escapeHtml(html.replace(/</g, ' <'))
  }
}

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
    const html = await marked(markdown)
    return sanitizeHtml(html)
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
    if (typeof result === 'string') return sanitizeHtml(result)
    // marked.parse 返回 Promise（极少情况）：用轻量回退渲染
    console.warn('[renderMarkdownSync] marked.parse returned Promise, using fallback')
    return sanitizeHtml(syncMarkdownFallback(markdown))
  } catch (error) {
    console.error('[renderMarkdownSync] marked.parse error:', error)
    return sanitizeHtml(syncMarkdownFallback(markdown))
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
