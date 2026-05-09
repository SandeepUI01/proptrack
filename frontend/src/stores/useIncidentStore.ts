import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

export const useIncidentStore = defineStore('incident', () => {
  // --- CORE STATE ---
  const incidents = shallowRef<any[]>([])
  const scrollerInstance = ref<any | null>(null)
  const isAtBottom = ref(true)

  const connectionState = ref<'closed' | 'connecting' | 'open' | 'error'>('closed')
  const currentFilter = ref('ALL')
  const isPaused = ref(false)
  const isScrolling = ref(false)
  const isSorting = ref(false)
  const hasActiveSort = ref(false)
  const eventRate = ref(0)
  const totalCount = ref(0)
  const selectedIncident = ref<any | null>(null)
  const isSearching = ref(false)

  const pulseHistory = ref<number[]>(new Array(60).fill(0))

  const severityDistribution = ref({
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  })

  const chartVisualData = ref({
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  })

  let worker: Worker | null = null
  let pendingData: any[] = []
  let lastFlush = 0
  let eventCountBuffer = 0
  let perfInterval: any = null

  const UI_UPDATE_INTERVAL = 500

  /* ---------------- SCROLLER ---------------- */
  const setScrollerRef = (el: any) => {
    scrollerInstance.value = el || null
  }

  /* ---------------- INCIDENT ACTIONS ---------------- */
  const selectIncident = (incident: any) => {
    isPaused.value = true
    selectedIncident.value = incident
  }

  const closeDetails = () => {
    selectedIncident.value = null
  }

  const togglePause = () => {
    isPaused.value = !isPaused.value

    worker?.postMessage({
      cmd: 'pause',
      value: isPaused.value
    })

    if (!isPaused.value && isAtBottom.value) {
      scrollerInstance.value?.scrollToItem?.(0)
    }
  }

  /* 🟢 FIX: Passing the actual query string to the worker */
  const setSearchMode = (searching: boolean, query: string = '') => {
    isSearching.value = searching

    if (searching) {
      isPaused.value = true
    }

    worker?.postMessage({
      cmd: 'search',
      value: query
    })
  }

  /* ---------------- CONNECT ---------------- */
  const connect = () => {
    if (worker) return

    connectionState.value = 'connecting'

    worker = new Worker(
      new URL('../workers/incident.worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e) => {
      const { type, data, dist, count } = e.data

      if (type === 'status') {
        connectionState.value = data
        return
      }

      if (type === 'batch') {
        pendingData = data
        totalCount.value = count
        severityDistribution.value = dist
        eventCountBuffer += data.length
      }
    }

    /* 🟢 FIX: Added interval cleanup for stability */
    if (perfInterval) clearInterval(perfInterval)

    perfInterval = setInterval(() => {
      eventRate.value = eventCountBuffer

      // Direct assignment for performance
      chartVisualData.value.CRITICAL = severityDistribution.value.CRITICAL
      chartVisualData.value.HIGH = severityDistribution.value.HIGH
      chartVisualData.value.MEDIUM = severityDistribution.value.MEDIUM
      chartVisualData.value.LOW = severityDistribution.value.LOW

      pulseHistory.value.push(eventCountBuffer)

      if (pulseHistory.value.length > 60) {
        pulseHistory.value.shift()
      }

      eventCountBuffer = 0
    }, 1000)

    worker.postMessage({ cmd: 'connect' })

    requestAnimationFrame(flush)
  }

  /* ---------------- UI FLUSH LOOP ---------------- */
  const flush = (time: number) => {
    const shouldUpdate = time - lastFlush > UI_UPDATE_INTERVAL

    const canUpdate =
      !isPaused.value &&
      !isScrolling.value &&
      !isSorting.value &&
      !hasActiveSort.value &&
      !isSearching.value

    if (shouldUpdate && pendingData.length && canUpdate) {
      incidents.value = pendingData

      if (isAtBottom.value) {
        scrollerInstance.value?.scrollToItem?.(0)
      }

      lastFlush = time
    }

    requestAnimationFrame(flush)
  }

  /* ---------------- SORT ---------------- */
  const setSort = (key: string, dir: 'asc' | 'desc') => {
    isSorting.value = true
    hasActiveSort.value = !(key === 'timestamp' && dir === 'desc')

    worker?.postMessage({
      cmd: 'sort',
      key,
      dir
    })

    setTimeout(() => {
      isSorting.value = false
    }, 800)
  }

  /* ---------------- FILTER ---------------- */
  const setFilter = (value: string) => {
    currentFilter.value = value

    worker?.postMessage({
      cmd: 'filter',
      value
    })
  }

  /* ---------------- PUBLIC API ---------------- */
  return {
    // state
    incidents,
    connectionState,
    currentFilter,
    isPaused,
    isScrolling,
    isSorting,
    isSearching,
    hasActiveSort,
    eventRate,
    totalCount,
    selectedIncident,
    pulseHistory,
    severityDistribution,
    chartVisualData,
    scrollerInstance,
    isAtBottom,

    // actions
    selectIncident,
    closeDetails,
    connect,
    setSort,
    setFilter,
    setSearchMode,
    togglePause,
    setScrollerRef,

    setScrolling: (v: boolean) => {
      isScrolling.value = v
    }
  }
})