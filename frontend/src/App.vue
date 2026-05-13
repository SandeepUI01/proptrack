<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useIncidentStore } from './stores/useIncidentStore'
import { createFPSMonitor, monitorLongTasks } from './utils/performance'
import { db } from './services/idb'
import IncidentChart from './components/IncidentChart.vue'

const store = useIncidentStore()
const sidebarRef = ref<HTMLElement | null>(null)
const searchContainerRef = ref<HTMLElement | null>(null)

/* ---------------- PERF METRICS ---------------- */
const fps = ref(0)
const stutters = ref(0)
const longTasks = ref(0)

/* ---------------- SEARCH STATE ---------------- */
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
let debounceTimeout: number | null = null

const copyPayload = (incident: any) => {
  const payload = JSON.stringify(incident, null, 2)
  navigator.clipboard.writeText(payload)
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
  store.setSearchMode(false)
}

/* ---------------- GLOBAL CLICK & NAVIGATION ---------------- */
const handleGlobalClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement

  const isClickInsideSearchInput = searchContainerRef.value?.contains(target)
  const isClickInsideSidebar = sidebarRef.value?.contains(target)
  const isClickInsideModal = !!target.closest('.search-modal-content')
  const isClickOnTableRow = !!target.closest('.vue-recycle-scroller__item-wrapper')

  // PROTECT: If clicking inside the Modal or Sidebar, abort the "close" logic
  if (isClickInsideModal || isClickInsideSidebar) return

  // Close Search only if clicking outside the modal AND the original search input
  if (!isClickInsideSearchInput && searchQuery.value.length >= 3) {
    clearSearch()
  }

  // Close Sidebar only if clicking outside sidebar, table rows, search input, and search results
  if (
    store.selectedIncident &&
    !isClickInsideSidebar &&
    !isClickOnTableRow &&
    !isClickInsideSearchInput &&
    !isClickInsideModal
  ) {
    store.closeDetails()
  }
}

// Updated to accept the event and stop propagation
const handleSearchSelect = (e: MouseEvent, res: any) => {
  e.stopPropagation() // Stops the event from reaching handleGlobalClick

  if (!res?.id) return
  const incident = store.incidents.find((i: any) => i.id === res.id)
  store.selectIncident(incident || res)
  // Logic remains: we do NOT call clearSearch() here so user can browse
}

const handleScroll = (() => {
  let timeout: number | null = null
  return () => {
    if (!store.isScrolling) store.setScrolling(true)
    if (timeout) clearTimeout(timeout)
    timeout = window.setTimeout(() => store.setScrolling(false), 200)
  }
})()

/* ---------------- HELPERS ---------------- */
const getSeverityStyle = (s: string) => {
  if (s === 'CRITICAL') return 'bg-red-100 text-red-600 border-red-200'
  if (s === 'HIGH') return 'bg-orange-100 text-orange-600 border-orange-200'
  if (s === 'MEDIUM') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-green-100 text-green-700 border-green-200'
}
const getSeverityBorder = (s: string) => {
  if (s === 'CRITICAL') return 'border-l-red-500'
  if (s === 'HIGH') return 'border-l-orange-500'
  if (s === 'MEDIUM') return 'border-l-yellow-500'
  return 'border-l-green-500'
}
const getSeverityBg = (s: string) => {
  if (s === 'CRITICAL') return 'bg-red-50'
  if (s === 'HIGH') return 'bg-orange-50'
  if (s === 'MEDIUM') return 'bg-yellow-50'
  return 'bg-green-50'
}

const formatTimestamp = (ts: number) => {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

/* ---------------- PERFORMANCE ---------------- */
const performanceScore = computed(() => {
  const normalizedFPS = (fps.value / 60) * 100
  const penalty = stutters.value * 2 + longTasks.value * 5
  return Math.max(0, Math.min(100, Math.round(normalizedFPS - penalty)))
})

const scoreLabel = computed(() => {
  if (performanceScore.value >= 80) return 'Excellent'
  if (performanceScore.value >= 50) return 'Degrading'
  return 'Critical'
})

/* ---------------- SORT & FILTER ---------------- */
const sortKey = ref<'timestamp' | 'value' | 'severity' | 'service'>('timestamp')
const sortDir = ref<'asc' | 'desc'>('desc')

const setSort = (key: any, forceDir?: 'asc' | 'desc') => {
  if (forceDir) {
    sortDir.value = forceDir
    sortKey.value = key
  } else if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
  store.setSort(sortKey.value, sortDir.value)
}

/* ---------------- AI SEARCH ENGINE ---------------- */
const handleAISearch = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = window.setTimeout(async () => {
    if (searchQuery.value.length < 3) {
      searchResults.value = []
      store.setSearchMode(false)
      return
    }
    try {
      isSearching.value = true
      store.setSearchMode(true)
      const res = await fetch(
        `http://localhost:8080/api/search?q=${encodeURIComponent(searchQuery.value)}`
      )
      const data = await res.json()
      searchResults.value = Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }, 300)
}

/* ---------------- EXPORT ---------------- */
const isExporting = ref(false)
const exportToCSV = async () => {
  try {
    isExporting.value = true
    const all = await db.incidents.orderBy('timestamp').reverse().toArray()
    const rows = all.map((i) => [
      new Date(i.timestamp).toISOString(),
      i.service,
      i.severity,
      i.value,
      i.id,
      `"${i.message.replace(/"/g, '""')}"`
    ])
    const csv = [['Time', 'Service', 'Severity', 'Value', 'ID', 'Message'], ...rows]
      .map((r) => r.join(','))
      .join('\n')

    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv]))
    link.download = `incident_export_${Date.now()}.csv`
    link.click()
  } finally {
    isExporting.value = false
  }
}
/* ---------------- KEYBOARD SHORTCUTS ---------------- */
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (searchQuery.value.length >= 3) {
      clearSearch()
      return
    }
    if (store.selectedIncident) {
      store.closeDetails()
    }
  }
}
onMounted(() => {
  store.connect()
  createFPSMonitor((f, s) => {
    fps.value = f
    stutters.value = s
  })
  monitorLongTasks(() => longTasks.value++)
  window.addEventListener('mousedown', handleGlobalClick)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  store.disconnect()
  window.removeEventListener('mousedown', handleGlobalClick)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    class="p-6 h-screen flex flex-col bg-slate-50 font-sans relative overflow-hidden text-slate-900"
  >
    <!-- ✅ MODAL SEARCH OVERLAY (Layer 10000) -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="searchQuery.length >= 3"
          class="fixed inset-0 z-[10000] flex items-start justify-center pt-[10vh] px-4"
        >
          <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="clearSearch"></div>
          <div
            class="search-modal-content relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            <div class="flex items-center px-6 h-20 border-b-2 border-slate-100 bg-white">
              <div
                v-if="isSearching"
                class="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-4"
              ></div>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                stroke-width="3"
                class="mr-4"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                v-model="searchQuery"
                @input="handleAISearch"
                placeholder="DESCRIBE THE INCIDENT PATTERN..."
                class="flex-1 bg-transparent text-xl font-black outline-none uppercase text-slate-800 placeholder:text-slate-300"
                autofocus
                @keydown.esc="clearSearch"
              />
              <button
                @click="clearSearch"
                class="ml-4 text-[10px] font-black bg-slate-100 px-3 py-1.5 rounded hover:bg-red-500 hover:text-white transition-all uppercase"
              >
                Esc
              </button>
            </div>
            <div class="max-h-[60vh] overflow-y-auto bg-slate-50/30">
              <div
                v-if="isSearching"
                class="p-20 text-center text-slate-400 font-black text-xs uppercase animate-pulse tracking-widest"
              >
                Querying Neural Engine...
              </div>
              <div
                v-else-if="searchResults.length === 0"
                class="p-20 text-center text-slate-400 font-black text-xs uppercase tracking-widest"
              >
                No matching patterns found
              </div>
              <div
                v-for="res in searchResults"
                :key="res.id"
                @click="handleSearchSelect($event, res)"
                :class="[
                  'relative p-6 border-b border-slate-100 hover:bg-white cursor-pointer group flex justify-between items-center transition-all border-l-4',
                  store.selectedIncident?.id === res.id ? 'bg-blue-50/80' : 'bg-transparent',
                  getSeverityBorder(res.severity)
                ]"
              >
                <div
                  v-if="store.selectedIncident?.id === res.id"
                  class="absolute right-0 top-0 bottom-0 w-1 bg-blue-500"
                ></div>
                <div class="flex flex-col gap-1 pr-8 truncate">
                  <span class="text-[10px] font-black text-blue-600 uppercase tracking-tighter">
                    {{ res?.service ?? 'Unknown Service' }}
                  </span>
                  <span class="text-base font-bold italic text-slate-800 leading-tight truncate">
                    "{{ res?.message ?? 'No message available' }}"
                  </span>
                </div>
                <div class="flex items-center gap-4 shrink-0">
                  <div class="text-right">
                    <div class="text-2xl font-black text-blue-600">
                      {{ ((res?.similarity ?? 0) * 100).toFixed(0) }}%
                    </div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {{ res?.severity ?? 'N/A' }}
                    </div>
                  </div>
                  <!-- ✅ Subtle arrow icon that appears on the active item -->
                  <svg
                    v-if="store.selectedIncident?.id === res.id"
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3b82f6"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- MAIN DASHBOARD VIEW -->
    <div class="relative z-1 flex flex-col h-full">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-black italic text-slate-800 tracking-tighter">🚀 AEGIS-QMS</h1>
        <div class="flex gap-3 items-center font-mono text-[10px]">
          <button
            @click="store.hasActiveSort ? setSort('timestamp', 'desc') : store.togglePause()"
            class="px-4 py-1.5 rounded-lg font-black transition-all shadow-sm"
            :class="
              store.hasActiveSort
                ? 'bg-blue-600 text-white animate-pulse'
                : 'bg-slate-800 text-white'
            "
          >
            {{
              store.hasActiveSort
                ? '⬅ BACK TO LIVE STREAM'
                : store.isPaused
                  ? 'RESUME STREAM'
                  : 'PAUSE'
            }}
          </button>
          <button
            @click="exportToCSV"
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
            <div>
              <span class="opacity-50 uppercase font-bold">Visible:</span>
              <span class="font-bold tabular-nums">{{ store.incidents.length }}</span>
            </div>
            <div class="border-l pl-3">
              <span class="opacity-50 uppercase font-bold">Total:</span>
              <span class="font-bold tabular-nums text-blue-600">{{
                store.totalCount.toLocaleString()
              }}</span>
            </div>
          </span>
        </div>
      </div>

      <!-- SEARCH TRIGGER & STATS -->
      <div class="flex gap-3 mb-4 font-mono text-xs items-center relative z-10">
        <div
          class="px-4 py-3 rounded-xl border flex flex-col shadow-sm bg-white"
          :class="
            fps >= 50
              ? 'text-green-700 border-green-200 bg-green-50'
              : 'text-red-700 border-red-200 bg-red-50'
          "
        >
          <span class="text-[10px] font-semibold opacity-70 uppercase">FPS</span>
          <span class="text-lg font-bold">{{ fps }}</span>
        </div>
        <div
          class="px-4 py-3 rounded-xl border flex flex-col shadow-sm bg-blue-50 text-blue-700 border-blue-200"
        >
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-semibold opacity-70 uppercase">Evt/s</span
            ><span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          </div>
          <span class="text-lg font-bold tabular-nums">{{ store.eventRate }}</span>
        </div>
        <div
          class="px-4 py-3 rounded-xl border flex flex-col shadow-sm bg-white"
          :class="
            stutters === 0 ? 'text-green-700 border-green-200' : 'text-red-700 border-red-200'
          "
        >
          <span class="text-[10px] font-semibold opacity-70 uppercase">Stutters</span>
          <span class="text-lg font-bold">{{ stutters }}</span>
        </div>
        <div
          class="px-4 py-3 rounded-xl border flex flex-col shadow-sm bg-white"
          :class="
            longTasks === 0 ? 'text-green-700 border-green-200' : 'text-red-700 border-red-200'
          "
        >
          <span class="text-[10px] font-semibold opacity-70 uppercase">Long Tasks</span>
          <span class="text-lg font-bold">{{ longTasks }}</span>
        </div>
        <div ref="searchContainerRef" class="flex-1 relative mx-2">
          <div
            class="bg-white rounded-xl shadow-sm border border-slate-200 flex items-center h-[68px] px-4 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400"
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
              v-model="searchQuery"
              type="text"
              placeholder="Start typing to open Neural Search..."
              @input="handleAISearch"
              class="flex-1 bg-transparent px-3 text-[11px] font-bold outline-none uppercase"
            />
          </div>
        </div>

        <div class="flex-col gap-4 items-center bg-white p-3 rounded-xl border ml-auto shadow-sm">
          <span class="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest"
            >Quick Filters</span
          >
          <div class="flex gap-2 mt-2">
            <button
              v-for="type in ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']"
              :key="type"
              @click="store.setFilter(type)"
              :class="
                store.currentFilter === type
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              "
              class="px-3 py-1 rounded-md text-[10px] font-black transition-all border border-transparent hover:border-slate-300"
            >
              {{ type }}
            </button>
          </div>
        </div>
      </div>
      <!-- <IncidentChart /> -->
      <!-- MAIN VIRTUAL TABLE -->
      <div class="flex-1 min-h-0 flex flex-col relative z-0">
        <div
          class="flex items-center h-10 px-4 font-mono text-[10px] font-bold bg-slate-100 text-slate-500 uppercase border rounded-t-xl"
        >
          <span class="w-32 cursor-pointer hover:text-slate-900" @click="setSort('timestamp')"
            >TIME {{ sortKey === 'timestamp' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span
          >
          <span class="flex-1 px-4 cursor-pointer hover:text-slate-900" @click="setSort('service')"
            >SERVICE / TRACE ID
            {{ sortKey === 'service' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span
          >
          <span
            class="w-24 text-center cursor-pointer hover:text-slate-900"
            @click="setSort('severity')"
            >SEVERITY {{ sortKey === 'severity' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span
          >
          <span
            class="w-20 text-right cursor-pointer hover:text-slate-900"
            @click="setSort('value')"
            >VALUE {{ sortKey === 'value' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span
          >
        </div>

        <div
          class="flex-1 bg-white border border-t-0 shadow-lg overflow-hidden rounded-b-xl relative"
        >
          <RecycleScroller
            ref="scrollerRef"
            class="h-full"
            :items="store.incidents"
            :item-size="44"
            key-field="id"
            v-slot="{ item }"
            @scroll="handleScroll"
          >
            <div
              @click="store.selectIncident(item)"
              :class="[
                'flex items-center h-[44px] px-4 font-mono text-[12px] border-b cursor-pointer hover:bg-slate-50',
                store.selectedIncident?.id === item.id
                  ? [getSeverityBg(item.severity), 'border-l-4', getSeverityBorder(item.severity)]
                  : 'border-l-4 border-l-transparent'
              ]"
            >
              <span class="w-32 text-slate-400 tabular-nums font-bold">{{
                formatTimestamp(item.timestamp)
              }}</span>
              <div class="flex-1 px-4 truncate flex flex-col">
                <span class="font-bold text-slate-800 text-xs truncate">{{ item.service }}</span>
                <span class="text-[8px] text-slate-400 font-bold uppercase">{{ item.id }}</span>
              </div>
              <div class="w-24 flex justify-center">
                <span
                  class="w-20 text-center text-[10px] font-bold rounded py-0.5 uppercase border"
                  :class="getSeverityStyle(item.severity)"
                  >{{ item.severity }}</span
                >
              </div>
              <span class="w-20 text-right font-bold text-slate-600 tabular-nums">
                {{ item.value?.toFixed(2) ?? '0.00' }}
              </span>
            </div>
          </RecycleScroller>
        </div>
      </div>
    </div>

    <!-- ✅ SIDEBAR -->
    <Transition name="slide">
      <div
        v-if="store.selectedIncident"
        ref="sidebarRef"
        class="fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-[10001] flex flex-col border-l"
      >
        <div class="p-5 border-b bg-slate-900 text-white flex justify-between items-center">
          <h2 class="font-black italic text-sm uppercase tracking-tighter">Incident Explorer</h2>
          <button
            @click.stop="store.closeDetails()"
            class="bg-red-500 text-white px-4 py-1 rounded text-[10px] font-black uppercase hover:bg-red-600"
          >
            Close [X]
          </button>
        </div>
        <div class="p-8 space-y-8 overflow-y-auto font-mono text-xs text-slate-900">
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Service</label>
            <div class="text-2xl font-black text-slate-800 leading-tight">
              {{ store.selectedIncident.service }}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1"
                >Severity</label
              >
              <div
                :class="getSeverityStyle(store.selectedIncident.severity)"
                class="p-3 rounded-lg font-black text-center border uppercase"
              >
                {{ store.selectedIncident.severity }}
              </div>
            </div>
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1"
                >Metric Value</label
              >
              <div class="bg-slate-50 p-3 border rounded-lg font-black text-center tabular-nums">
                {{ store.selectedIncident.value?.toFixed(4) ?? 'N/A' }}
              </div>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1"
              >Trace ID</label
            >
            <div
              class="bg-slate-100 p-3 border rounded break-all text-blue-700 font-bold uppercase"
            >
              {{ store.selectedIncident.id }}
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Message</label>
            <div class="bg-slate-50 p-5 border rounded-xl leading-relaxed italic shadow-inner">
              "{{ store.selectedIncident.message }}"
            </div>
          </div>
          <button
            @click="copyPayload(store.selectedIncident)"
            class="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-[11px] uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            Copy JSON Payload
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.vue-recycle-scroller__item-wrapper > div:nth-child(even) {
  background-color: #f8fafc;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
