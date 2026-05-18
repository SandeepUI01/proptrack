<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { useIncidentStore } from './stores/useIncidentStore'
import { createFPSMonitor, monitorLongTasks } from './utils/performance'
import { db } from './services/idb'

// Component Imports
import TheHeader from './components/TheHeader.vue'
import PerformanceStats from './components/PerformanceStats.vue'
import IncidentChart from './components/IncidentChart.vue'
import IncidentTable from './components/IncidentTable.vue'
import IncidentSidebar from './components/IncidentSidebar.vue'
import SearchOverlay from './components/SearchOverlay.vue'

const store = useIncidentStore()

/* ---------------- STATE ---------------- */
const fps = ref(0)
const stutters = ref(0)
const longTasks = ref(0)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const isExporting = ref(false)
const sortKey = ref<'timestamp' | 'value' | 'severity' | 'service'>('timestamp')
const sortDir = ref<'asc' | 'desc'>('desc')
let debounceTimeout: any = null

/* ---------------- PRODUCTION ENVIRONMENT SETUP ---------------- */
// 🚀 FIXED: Dynamic targeting for HTTP endpoints using runtime environment variables
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'

/* ---------------- LOGIC ---------------- */
const clearSearch = () => {
  searchQuery.value = '' // Clear text to close modal
  searchResults.value = [] // Reset results
  store.setSearchMode(false) // Exit search mode

  // Re-focus the main dashboard input after the modal closes
  nextTick(() => {
    const mainInput = document.querySelector('.performance-stats-input') as HTMLInputElement
    mainInput?.focus()
  })
}

const handleAISearch = () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(async () => {
    // Check length here
    if (searchQuery.value.length < 3) {
      searchResults.value = [] // Clear previous results
      store.setSearchMode(false) // Tell store we aren't in search mode
      return // STOP HERE - don't call clearSearch() which wipes the input
    }

    try {
      isSearching.value = true
      store.setSearchMode(true)

      // 🚀 FIXED: Interpolate the clean dynamic base url into your search action query string
      const res = await fetch(`${apiBaseUrl}/api/search?q=${encodeURIComponent(searchQuery.value)}`)
      const data = await res.json()
      searchResults.value = Array.isArray(data) ? data : (data?.results ?? [])
    } catch {
      searchResults.value = []
    } finally {
      isSearching.value = false
    }
  }, 300)
}

const handleSearchSelect = (e: MouseEvent, res: any) => {
  e.stopPropagation()
  if (!res?.id) return
  const incident = store.incidents.find((i: any) => i.id === res.id)
  store.selectIncident(incident || res)
}

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

/* ---------------- HELPERS (Passed to children) ---------------- */
const getSeverityStyle = (s: string) => {
  if (s === 'CRITICAL') return 'text-red-600'
  if (s === 'HIGH') return 'text-orange-600'
  if (s === 'MEDIUM') return 'text-yellow-600'
  return 'text-green-600'
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

/* ---------------- LIFECYCLE / GLOBAL ---------------- */
const handleGlobalClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('.search-modal-content') || target.closest('.incident-sidebar')) return
  if (!target.closest('.search-input-container') && searchQuery.value.length >= 3) clearSearch()
  if (store.selectedIncident && !target.closest('.vue-recycle-scroller__item-wrapper'))
    store.closeDetails()
}
/* ---------------- KEYBOARD SHORTCUTS ---------------- */
const handleKeyDown = (e: KeyboardEvent) => {
  // Allow '/' to focus the search bar from anywhere
  if (e.key === '/' && !store.isSearchMode && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault()
    // Focus the dashboard input first, which will eventually trigger the modal
    const mainInput = document.querySelector('.performance-stats-input') as HTMLInputElement
    mainInput?.focus()
    return
  }

  if (e.key === 'Escape') {
    if (searchQuery.value.length > 0) {
      clearSearch()
      return
    }
    if (store.selectedIncident) store.closeDetails()
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
  if (debounceTimeout) clearTimeout(debounceTimeout) // 🚀 FIXED: Clear active timeouts to avoid thread memory leak cascades
  window.removeEventListener('mousedown', handleGlobalClick)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    class="p-6 h-screen flex flex-col bg-slate-50 font-sans relative overflow-hidden text-slate-900"
  >
    <SearchOverlay
      v-model:searchQuery="searchQuery"
      :isSearching="isSearching"
      :searchResults="searchResults"
      :getSeverityBorder="getSeverityBorder"
      v-if="searchQuery.length >= 3"
      @clear="clearSearch"
      @aiSearch="handleAISearch"
      @select="handleSearchSelect"
    />

    <div class="relative z-1 flex flex-col h-full">
      <TheHeader
        :performanceScore="performanceScore"
        :scoreLabel="scoreLabel"
        :isExporting="isExporting"
        @export="exportToCSV"
        @setSort="setSort"
      />

      <PerformanceStats
        v-model:searchQuery="searchQuery"
        :fps="fps"
        :stutters="stutters"
        :longTasks="longTasks"
        @aiSearch="handleAISearch"
      />

      <IncidentChart />

      <IncidentTable
        :sortKey="sortKey"
        :sortDir="sortDir"
        :getSeverityBorder="getSeverityBorder"
        :getSeverityBg="getSeverityBg"
        :getSeverityStyle="getSeverityStyle"
        :formatTimestamp="formatTimestamp"
        @sort="setSort"
      />
    </div>

    <IncidentSidebar :getSeverityStyle="getSeverityStyle" />
  </div>
</template>
