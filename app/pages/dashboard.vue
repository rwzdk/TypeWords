<script setup lang="ts">
// 学习仪表盘：连续打卡、热力图与累计统计。
// 数据源：各词库持久化的 statistics（每次练习结束由 flushStatToStore 落库）
// + 进行中练习的今日缓存片段（getPracticeWordCacheLocal）。
import dayjs from 'dayjs'
import { useBaseStore } from '@/core/stores/base.ts'
import { getPracticeWordCacheLocal } from '@/core/utils/cache.ts'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { BasePage } from '@/base'

const { t: $t } = useI18n()
const store = useBaseStore()

type SessionRow = {
  dictName: string
  spend: number
  total: number
  wrong: number
  new: number
  review: number
  startDate: string | number
}

const sessions = computed<SessionRow[]>(() => {
  const rows = store.word.bookList.flatMap(b =>
    (b.statistics ?? [])
      .filter(s => s?.startDate)
      .map(s => ({ ...s, dictName: b.name })),
  )
  return rows.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
})

// 今日进行中的片段并入统计（未落库的当前练习）
const todayExtraMs = ref(0)
onMounted(async () => {
  const cache = await getPracticeWordCacheLocal()
  const segments = (cache as { statStoreData?: { segments?: [number, number][] } })?.statStoreData?.segments
  if (Array.isArray(segments)) {
    const today = dayjs().format('YYYY-MM-DD')
    todayExtraMs.value = segments
      .filter(([s, e]) => dayjs(s).format('YYYY-MM-DD') === today && e > s)
      .reduce((acc, [, e]) => acc + (e - s), 0)
  }
})

const dayMap = computed<Map<string, { spend: number; total: number; wrong: number }>>(() => {
  const map = new Map<string, { spend: number; total: number; wrong: number }>()
  for (const s of sessions.value) {
    const key = dayjs(s.startDate).format('YYYY-MM-DD')
    const prev = map.get(key) ?? { spend: 0, total: 0, wrong: 0 }
    map.set(key, {
      spend: prev.spend + (s.spend ?? 0),
      total: prev.total + (s.total ?? 0),
      wrong: prev.wrong + (s.wrong ?? 0),
    })
  }
  const today = dayjs().format('YYYY-MM-DD')
  if (todayExtraMs.value > 0) {
    const prev = map.get(today) ?? { spend: 0, total: 0, wrong: 0 }
    map.set(today, { ...prev, spend: prev.spend + todayExtraMs.value })
  }
  return map
})

function fmtDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return $t('dash_minutes', { n: minutes })
  return $t('dash_hours', { n: (minutes / 60).toFixed(1) })
}

const totalSpend = computed(() => [...dayMap.value.values()].reduce((a, b) => a + b.spend, 0))
const totalWords = computed(() => sessions.value.reduce((a, b) => a + (b.total ?? 0), 0))
const totalSessions = computed(() => sessions.value.length)

const streak = computed(() => {
  let count = 0
  let cursor = dayjs()
  // 今天还没练不打断连续纪录——从昨天起算
  if (!dayMap.value.has(cursor.format('YYYY-MM-DD'))) cursor = cursor.subtract(1, 'day')
  while (dayMap.value.has(cursor.format('YYYY-MM-DD'))) {
    count++
    cursor = cursor.subtract(1, 'day')
  }
  return count
})

// 近 90 天热力图（按周列排布，周一为第一行）
const heatCells = computed(() => {
  const cells: { dateKey: string; spend: number; level: number; isFuture: boolean }[] = []
  const today = dayjs()
  const end = today.endOf('week') // 本周日补齐最后一列
  let cursor = today.subtract(89, 'day').startOf('week')
  const pad = cursor.diff(today.subtract(89, 'day'), 'day')
  for (let i = 0; i < pad; i++) cells.push({ dateKey: '', spend: 0, level: -1, isFuture: false })
  while (!cursor.isAfter(end, 'day')) {
    const key = cursor.format('YYYY-MM-DD')
    const spend = dayMap.value.get(key)?.spend ?? 0
    const minutes = Math.floor(spend / 60000)
    const level = minutes <= 0 ? 0 : minutes < 10 ? 1 : minutes < 30 ? 2 : minutes < 60 ? 3 : 4
    cells.push({ dateKey: key, spend, level, isFuture: cursor.isAfter(today, 'day') })
    cursor = cursor.add(1, 'day')
  }
  return cells
})

function heatColor(level: number): string {
  const alphas = [0, 0.22, 0.45, 0.7, 1]
  return level < 0 ? 'transparent' : `rgba(13, 148, 136, ${alphas[level]})`
}

const recent = computed(() => sessions.value.slice(0, 10))
</script>

<template>
  <BasePage>
    <div class="max-w-250 mx-auto px-4 py-6">
      <h1 class="text-lg font-bold color-main mb-4">{{ $t('dash_title') }}</h1>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="card in [
          { label: $t('dash_streak'), value: $t('dash_days', { n: streak }) },
          { label: $t('dash_total_time'), value: fmtDuration(totalSpend) },
          { label: $t('dash_total_words'), value: totalWords },
          { label: $t('dash_sessions'), value: totalSessions },
        ]" :key="card.label" class="rounded-xl border-item-solid bg-item p-4">
          <p class="text-xs color-translate-second">{{ card.label }}</p>
          <p class="mt-1 text-2xl font-semibold color-link">{{ card.value }}</p>
        </div>
      </div>

      <section class="mt-8">
        <h2 class="text-sm font-semibold color-main mb-3">{{ $t('dash_heatmap') }}</h2>
        <div class="card !mb-0 p-4 overflow-x-auto">
          <div class="grid grid-rows-7 grid-flow-col gap-1 w-max">
            <div
              v-for="(c, i) in heatCells"
              :key="i"
              class="w-3 h-3 rounded-[3px] bg-item"
              :style="{ backgroundColor: heatColor(c.level) }"
              :title="c.dateKey ? `${c.dateKey} · ${fmtDuration(c.spend)}` : ''"
            />
          </div>
          <p class="mt-2 text-xs color-translate-second">{{ $t('dash_heatmap_hint') }}</p>
        </div>
      </section>

      <section class="mt-8">
        <h2 class="text-sm font-semibold color-main mb-3">{{ $t('dash_recent') }}</h2>
        <div v-if="!recent.length" class="card text-center color-translate-second py-8">{{ $t('dash_empty') }}</div>
        <ul v-else class="space-y-2">
          <li
            v-for="(s, i) in recent"
            :key="i"
            class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border-item-solid bg-item px-4 py-3 text-sm"
          >
            <span class="color-main font-medium min-w-30 truncate">{{ s.dictName }}</span>
            <span class="color-translate-second">{{ dayjs(s.startDate).format('MM-DD HH:mm') }}</span>
            <span class="color-translate-second">{{ fmtDuration(s.spend) }}</span>
            <span class="color-translate-second">{{ $t('dash_row_words', { total: s.total ?? 0, wrong: s.wrong ?? 0 }) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </BasePage>
</template>
