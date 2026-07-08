<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <component :is="iconPaths[name]" />
  </svg>
</template>

<script setup lang="ts">
import { h } from 'vue'

interface Props {
  name: string
  size?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  size: 16
})

// SVG icon paths - Lucide-style professional icons
const iconPaths: Record<string, any> = {
  // Settings / Gear
  'settings': () => h('g', [
    h('path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }),
    h('circle', { cx: '12', cy: '12', r: '3' })
  ]),

  // Message / Chat
  'message-circle': () => h('path', { d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' }),

  // Chat square
  'message-square': () => h('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }),

  // Clock / Timer
  'clock': () => h('g', [
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polyline', { points: '12 6 12 12 16 14' })
  ]),

  // File text / Document
  'file-text': () => h('g', [
    h('path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }),
    h('path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }),
    h('path', { d: 'M10 9H8' }),
    h('path', { d: 'M16 13H8' }),
    h('path', { d: 'M16 17H8' })
  ]),

  // Check circle (success)
  'check-circle': () => h('g', [
    h('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
    h('polyline', { points: '22 4 12 14.01 9 11.01' })
  ]),

  // Alert triangle (warning)
  'alert-triangle': () => h('g', [
    h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }),
    h('path', { d: 'M12 9v4' }),
    h('path', { d: 'M12 17h.01' })
  ]),

  // X circle (error)
  'x-circle': () => h('g', [
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('path', { d: 'm15 9-6 6' }),
    h('path', { d: 'm9 9 6 6' })
  ]),

  // Info
  'info': () => h('g', [
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('path', { d: 'M12 16v-4' }),
    h('path', { d: 'M12 8h.01' })
  ]),

  // Wrench / Tool
  'wrench': () => h('g', [
    h('path', { d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' })
  ]),

  // Brain / Thinking
  'brain': () => h('g', [
    h('path', { d: 'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 3.875c-.87 1.013-1.477 2.368-1.477 4 0 2.5 2 4 4 4h1.5' }),
    h('path', { d: 'M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 3.875c.87 1.013 1.477 2.368 1.477 4 0 2.5-2 4-4 4H16.5' }),
    h('path', { d: 'M12 5v14' }),
    h('path', { d: 'M8 12h8' })
  ]),

  // Clipboard list (sessions)
  'clipboard-list': () => h('g', [
    h('rect', { x: '8', y: '2', width: '8', height: '4', rx: '1', ry: '1' }),
    h('path', { d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' }),
    h('path', { d: 'M11 11h4' }),
    h('path', { d: 'M11 15h4' }),
    h('path', { d: 'M9 11h.01' }),
    h('path', { d: 'M9 15h.01' })
  ]),

  // X (close)
  'x': () => h('path', { d: 'M18 6 6 18M6 6l12 12' }),

  // Send
  'send': () => h('path', { d: 'm22 2-7 20-4-9-9-4Z' }),

  // Stop
  'square': () => h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }),

  // Chevron down
  'chevron-down': () => h('path', { d: 'm6 9 6 6 6-6' }),

  // Plus
  'plus': () => h('g', [
    h('path', { d: 'M5 12h14' }),
    h('path', { d: 'M12 5v14' })
  ]),

  // Search
  'search': () => h('g', [
    h('circle', { cx: '11', cy: '11', r: '8' }),
    h('path', { d: 'm21 21-4.3-4.3' })
  ]),

  // Terminal
  'terminal': () => h('g', [
    h('polyline', { points: '4 17 10 11 4 5' }),
    h('line', { x1: '12', y1: '19', x2: '20', y2: '19' })
  ]),

  // Globe
  'globe': () => h('g', [
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }),
    h('path', { d: 'M2 12h20' })
  ]),

  // Sparkles
  'sparkles': () => h('g', [
    h('path', { d: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z' }),
    h('path', { d: 'M20 3v4' }),
    h('path', { d: 'M22 5h-4' })
  ]),

  // Users / People
  'users': () => h('g', [
    h('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
    h('circle', { cx: '9', cy: '7', r: '4' }),
    h('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }),
    h('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' })
  ]),

  // Trash / Delete
  'trash': () => h('g', [
    h('path', { d: 'M3 6h18' }),
    h('path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }),
    h('path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }),
    h('line', { x1: '10', y1: '11', x2: '10', y2: '17' }),
    h('line', { x1: '14', y1: '11', x2: '14', y2: '17' })
  ])
}
</script>
