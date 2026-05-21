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
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-black italic text-slate-800 tracking-tighter">PropTrack</h1>
    <div class="flex gap-3 items-center font-mono text-[10px]">
      <button
        @click="store.hasActiveSort ? emit('setSort', 'timestamp', 'desc') : store.togglePause()"
        class="px-4 py-1.5 rounded-lg font-black transition-all shadow-sm"
        :class="
          store.hasActiveSort ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-800 text-white'
        "
      >
        {{
          store.hasActiveSort ? '⬅ BACK TO LIVE STREAM' : store.isPaused ? 'RESUME STREAM' : 'PAUSE'
        }}
      </button>
      <button
        @click="emit('export')"
        :disabled="isExporting"
        class="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded font-bold text-slate-300 hover:text-white transition-all uppercase"
      >
        {{ isExporting ? 'PROCESSING...' : 'EXPORT (.CSV)' }}
      </button>
      <span class="bg-white border px-3 py-1 rounded-full shadow-sm flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full animate-pulse shadow-md"
          :class="{
            'bg-green-500 shadow-green-300': scoreLabel === 'Excellent',
            'bg-yellow-400 shadow-yellow-300': scoreLabel === 'Degrading',
            'bg-red-500 shadow-red-300': scoreLabel === 'Critical'
          }"
        ></span>
        <span class="font-bold uppercase tracking-wide"
          >SCORE: {{ performanceScore }} — {{ scoreLabel }}</span
        >
      </span>
      <span class="bg-white border px-3 py-1 rounded-full shadow-sm flex items-center gap-4">
        <!-- METRIC A: VISIBLE COUNT 
             - Captures the exact number of rows rendered inside your virtualized scroll tree.
             - This array is capped at ~200 items to guarantee smooth 60fps scrolling.
             - Your Donut Chart now calculates its slices from THIS metric to avoid visual clutter!
        -->
        <div>
          <span class="opacity-50 uppercase font-bold">Visible:</span>
          <span class="font-bold tabular-nums">{{ store.incidents.length }}</span>
        </div>
        <!-- METRIC B: TOTAL COUNT 
             - An ever-growing, infinite counter generated directly within the Go backend/Web Worker.
             - Tracks every single log message received via the WebSocket since the page was opened.
             - This is the number that climbs past 5,000+, serving as your total pipeline throughput anchor.
        -->
        <div class="border-l pl-3">
          <span class="opacity-50 uppercase font-bold">Total:</span>
          <span class="font-bold tabular-nums text-blue-600">{{
            store.totalCount.toLocaleString()
          }}</span>
        </div>
      </span>
    </div>
  </div>
</template>
