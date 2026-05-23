<script setup lang="ts">
import { useIncidentStore } from '../stores/useIncidentStore'

const props = defineProps<{
  performanceScore: number
  scoreLabel: string
  isExporting: boolean
}>()

const emit = defineEmits(['export', 'setSort'])
const store = useIncidentStore()
</script>

<template>
  <div
    class="flex flex-row justify-between items-center mb-4 flex-nowrap w-full border-b border-slate-100/50"
  >
    <h1
      class="text-xl md:text-2xl font-black italic text-slate-800 tracking-tighter truncate pr-2 select-none"
    >
      PropTrack
    </h1>

    <div class="flex flex-row flex-nowrap gap-1.5 md:gap-3 items-center font-mono text-[10px]">
      <!-- BUTTON 1: LIVE STREAM CONTROL -->
      <button
        @click="store.hasActiveSort ? emit('setSort', 'timestamp', 'desc') : store.togglePause()"
        class="px-2.5 py-1.5 md:px-4 rounded-lg font-black transition-all shadow-sm whitespace-nowrap text-[9px] md:text-[10px]"
        :class="
          store.hasActiveSort ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-800 text-white'
        "
      >
        {{ store.hasActiveSort ? '⬅ LIVE' : store.isPaused ? 'RESUME' : 'PAUSE' }}
      </button>

      <!-- BUTTON 2: EXPORT TO CSV -->
      <button
        @click="emit('export')"
        :disabled="isExporting"
        class="bg-slate-800 border border-slate-700 px-2.5 py-1.5 md:px-3 rounded-lg font-bold text-slate-300 hover:text-white transition-all uppercase whitespace-nowrap text-[9px] md:text-[10px]"
      >
        {{ isExporting ? 'EXPORT...' : 'EXPORT' }}
      </button>

      <span
        class="hidden md:flex bg-white border px-3 py-1 rounded-full shadow-sm items-center gap-2 whitespace-nowrap"
      >
        <span
          class="w-2 h-2 rounded-full animate-pulse shadow-md"
          :class="{
            'bg-green-500 shadow-green-300': scoreLabel === 'Excellent',
            'bg-yellow-400 shadow-yellow-300': scoreLabel === 'Degrading',
            'bg-red-500 shadow-red-300': scoreLabel === 'Critical'
          }"
        ></span>
        <span class="font-bold uppercase tracking-wide">
          SCORE: {{ performanceScore }} — {{ scoreLabel }}
        </span>
      </span>

      <span
        class="hidden md:flex bg-white border px-3 py-1 rounded-full shadow-sm items-center gap-4 whitespace-nowrap"
      >
        <div>
          <span class="opacity-50 uppercase font-bold">Visible:</span>
          <span class="font-bold tabular-nums">{{ store.incidents.length }}</span>
        </div>
        <div class="border-l pl-3">
          <span class="opacity-50 uppercase font-bold">Total:</span>
          <span class="font-bold tabular-nums text-blue-600">
            {{ store.totalCount.toLocaleString() }}
          </span>
        </div>
      </span>
    </div>
  </div>
</template>
