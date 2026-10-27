<script setup lang="ts">
// 屏幕虚拟键盘：跟随当前单词的下一个字符高亮键位，敲错时闪红。
// 自驱动设计——只依赖 word prop 与物理键盘事件流（eventBus），不侵入练习核心状态。
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { emitter, EventKey } from '@/core/hooks/event.ts'
import type { Word } from '@/core/types/types.ts'

const props = defineProps<{ word: Word }>()

const ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

const idx = ref(0)
const wrongKey = ref('')
let wrongTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.word,
  () => {
    idx.value = 0
    wrongKey.value = ''
  },
)

function nextChar(): string {
  const w = props.word?.word ?? ''
  return w[idx.value]?.toLowerCase() ?? ''
}

function flashWrong(k: string) {
  wrongKey.value = k
  if (wrongTimer) clearTimeout(wrongTimer)
  wrongTimer = setTimeout(() => (wrongKey.value = ''), 220)
}

function onTyping(e: KeyboardEvent) {
  const k = e.key
  if (k.length !== 1) return
  const expect = nextChar()
  if (!expect) return
  if (k === expect || k.toLowerCase() === expect) {
    idx.value++
  } else {
    flashWrong(k.toLowerCase())
  }
}

// 打字键统一走 eventBus 的 onTyping 通道（与 WordTypingCore 同源），物理 keydown 不含打字键
onMounted(() => emitter.on(EventKey.onTyping, onTyping))
onUnmounted(() => emitter.off(EventKey.onTyping, onTyping))
</script>

<template>
  <div class="select-none pointer-events-none flex flex-col items-center gap-1.5" aria-hidden="true">
    <div v-for="(row, r) in ROWS" :key="r" class="flex gap-1.5" :class="{ 'px-6': r === 1 }">
      <div
        v-for="key in row"
        :key="key"
        class="w-9 h-9 rounded-md border border-item-solid bg-item flex items-center justify-center text-xs uppercase color-main transition-colors duration-75"
        :class="{
          '!bg-[var(--color-select-bg)] !color-[var(--color-reverse-white)] !border-transparent':
            key === nextChar(),
          '!bg-[#e0565c] !color-white !border-transparent':
            key === wrongKey,
        }"
      >
        {{ key }}
      </div>
      <div
        v-if="r === 2"
        class="w-56 h-9 rounded-md border border-item-solid bg-item flex items-center justify-center text-xs color-main"
        :class="{ '!bg-[var(--color-select-bg)] !color-[var(--color-reverse-white)] !border-transparent': nextChar() === ' ' }"
      >
        {{ $t('space_key') }}
      </div>
    </div>
  </div>
</template>
