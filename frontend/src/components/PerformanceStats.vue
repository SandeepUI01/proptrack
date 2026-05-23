<script setup lang="ts">
import { useIncidentStore } from '../stores/useIncidentStore'

const props = defineProps<{
  /**
   * 1. FPS (Frames Per Second)
   * Tracks the main UI thread's rendering smoothness.
   * - Target: >= 50 FPS for steady virtual scroll rendering.
   * - Dropping below 50 signs heavy UI DOM construction or layout shifts.
   */
  fps: number

  /**
   * 3. STUTTERS
   * Tracks frame drop anomalies where a single frame layout operation misses its budget.
   * - Increments when delta render times spike unexpectedly between animation ticks.
   * - Target: 0. Indicates micro-stalls caused by garbage collection or reactive re-renders.
   */
  stutters: number

  /**
   * 4. LONG TASKS
   * Tracks blocking JavaScript executions running on the main UI thread.
   * - Captures any continuous main thread execution exceeding the standard 50ms boundary.
   * - Target: 0. High values mean complex computations are starving layout/paint cycles.
   */
  longTasks: number

  /**
   * SEARCH QUERY
   * The active text string string bound to the input element field to control filtration filters.
   */
  searchQuery: string
}>()

const emit = defineEmits(['update:searchQuery', 'aiSearch'])

const store = useIncidentStore()
</script>

<template>
  <div
    class="flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap gap-4 mb-4 font-mono text-xs items-center relative z-10 w-full"
  >
    <div class="grid grid-cols-4 gap-2 w-full md:w-auto flex-initial">
      <!-- METRIC 1: RENDER FPS -->
      <div
        class="px-2 py-3 rounded-xl border flex flex-col shadow-sm bg-white min-w-[80px]"
        :class="
          fps >= 50
            ? 'text-green-700 border-green-200 bg-green-50'
            : 'text-red-700 border-red-200 bg-red-50'
        "
      >
        <span class="text-[9px] font-semibold opacity-70 uppercase">FPS</span>
        <span class="text-base font-bold">{{ fps }}</span>
      </div>

      <!-- METRIC 2: EVENTS PER SECOND (Evt/s) -->
      <div
        class="px-2 py-3 rounded-xl border flex flex-col shadow-sm bg-blue-50 text-blue-700 border-blue-200 min-w-[80px]"
      >
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-semibold opacity-70 uppercase">Evt/s</span>
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
        </div>
        <span class="text-base font-bold tabular-nums">{{ store.eventRate }}</span>
      </div>

      <!-- METRIC 3: INTERACTIVE STUTTERS -->
      <div
        class="px-2 py-3 rounded-xl border flex flex-col shadow-sm bg-white min-w-[80px]"
        :class="stutters === 0 ? 'text-green-700 border-green-200' : 'text-red-700 border-red-200'"
      >
        <span class="text-[9px] font-semibold opacity-70 uppercase">Stutters</span>
        <span class="text-base font-bold">{{ stutters }}</span>
      </div>

      <!-- METRIC 4: MAIN THREAD LONG TASKS -->
      <div
        class="px-2 py-3 rounded-xl border flex flex-col shadow-sm bg-white min-w-[80px]"
        :class="longTasks === 0 ? 'text-green-700 border-green-200' : 'text-red-700 border-red-200'"
      >
        <span class="text-[9px] font-semibold opacity-70 uppercase">Long Tasks</span>
        <span class="text-base font-bold">{{ longTasks }}</span>
      </div>
    </div>

    <div
      class="flex flex-col justify-center bg-white p-3 rounded-xl border shadow-sm h-[65px] w-full md:w-auto md:ml-auto lg:ml-0 lg:order-last"
    >
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
        >Quick Filters</span
      >
      <div
        class="flex gap-1.5 mt-1.5 justify-between overflow-x-auto whitespace-nowrap scrollbar-none"
      >
        <button
          v-for="type in ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']"
          :key="type"
          @click="store.setFilter(type)"
          :class="
            store.currentFilter === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
          "
          class="px-2.5 py-1 rounded-md text-[9px] font-black transition-all border border-transparent hover:border-slate-300"
        >
          {{ type }}
        </button>
      </div>
    </div>

    <div class="w-full md:w-full lg:flex-1 relative">
      <div
        class="bg-white rounded-xl shadow-sm border border-slate-200 flex items-center h-[65px] px-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          class="text-slate-400"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          :value="searchQuery"
          @input="
            (e) => {
              $emit('update:searchQuery', (e.target as HTMLInputElement).value)
              $emit('aiSearch')
            }
          "
          type="text"
          placeholder="Start typing to open Neural Search..."
          class="flex-1 bg-transparent px-3 text-[11px] font-bold outline-none uppercase"
        />
      </div>
    </div>
  </div>
</template>
