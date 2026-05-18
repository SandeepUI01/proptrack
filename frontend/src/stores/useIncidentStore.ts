import { defineStore } from 'pinia'
import { ref, shallowRef, markRaw } from 'vue'

export const useIncidentStore = defineStore('incident', () => {
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
  const globalSearchQuery = ref('')
  const isSearchMode = ref(false)

  const pulseHistory = ref<number[]>(new Array(60).fill(0))
  const severityDistribution = ref({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 })
  const chartVisualData = ref({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 })

  let worker: Worker | null = null
  let latestBatch: any[] = [] // Buffer to hold data until the next flush
  let eventCountBuffer = 0
  let perfInterval: any = null
  let flushInterval: any = null

  // 1. HDD STABILITY: Update UI every 1000ms instead of 16ms
  const UI_UPDATE_INTERVAL = 500 //Updates every 500ms / 1000 for local

  const setScrollerRef = (el: any) => { scrollerInstance.value = el || null }

  const selectIncident = (incident: any) => {
    isPaused.value = true
    selectedIncident.value = incident
  }

  const closeDetails = () => { selectedIncident.value = null }

  const togglePause = () => {
    isPaused.value = !isPaused.value
    worker?.postMessage({ cmd: 'pause', value: isPaused.value })
  }

  const setGlobalSearchQuery = (q: string) => {
    globalSearchQuery.value = q
  }

  const setSearchMode = (searching: boolean, query: string = '') => {
    isSearching.value = searching
    if (searching) isPaused.value = true
    worker?.postMessage({ cmd: 'search', value: query })
  }

  const connect = () => {
    if (worker) return
    connectionState.value = 'connecting'

    worker = new Worker(
      new URL('../workers/incident.worker.ts', import.meta.url),
      { type: 'module' }
    )

    worker.onmessage = (e) => {
      const { type, data, dist, count } = e.data
  
      if (type === 'sort-complete') {
        isSorting.value = false // Stop spinner only when worker is actually done
      }
      if (type === 'status') {
        connectionState.value = data
      } else if (type === 'batch') {
        // 2. MEMORY GUARD: markRaw prevents Vue from making these thousands of objects reactive
        latestBatch = markRaw(Object.freeze(data))
        totalCount.value = count
        severityDistribution.value = dist
        eventCountBuffer += data.length
      }
    }

    // Update Pulse Chart and Metrics every second
    perfInterval = setInterval(() => {
      eventRate.value = eventCountBuffer
      chartVisualData.value = { ...severityDistribution.value }
      pulseHistory.value.push(eventCountBuffer)
      if (pulseHistory.value.length > 60) pulseHistory.value.shift()
      eventCountBuffer = 0
    }, 1000)

    // 🚀 PRODUCTION FALLBACK GUARD:
    // If VITE_WS_URL is missing or fails to resolve, this safely maps to your fallback domain
    let targetWsUrl = import.meta.env.VITE_WS_URL

    if (!targetWsUrl || targetWsUrl === '') {
      console.warn("VITE_WS_URL not detected. Using client domain context string derivation.")
      // Dynamically switches protocols based on encryption layer context
      const isSecure = window.location.protocol === 'https:'
      const wsProtocol = isSecure ? 'wss:' : 'ws:'
      
      if (window.location.hostname === 'localhost') {
        targetWsUrl = 'ws://localhost:8080/ws'
      } else {
        // Production fallback logic safely maps to your explicit Railway backend production deployment URL string
        targetWsUrl = `${wsProtocol}//your-backend-production.up.railway.app/ws`
      }
    }

    worker.postMessage({ 
      cmd: 'connect', 
      url: targetWsUrl
    })
    
    // 3. STABLE LOOP: Replace requestAnimationFrame with a fixed interval
    if (flushInterval) clearInterval(flushInterval)
    flushInterval = setInterval(flushUI, UI_UPDATE_INTERVAL)
  }

  const flushUI = () => {
    const canUpdate = 
      !isPaused.value && 
      !isScrolling.value && 
      !isSorting.value && 
      !isSearching.value &&
      latestBatch.length > 0

    if (canUpdate) {
      incidents.value = latestBatch
      
      if (isAtBottom.value && scrollerInstance.value) {
        // Use a timeout to give the HDD time to finish rendering the DOM
        setTimeout(() => {
          scrollerInstance.value?.scrollToItem?.(0)
        }, 60)
      }
    }
  }

  const disconnect = () => {
    if (worker) {
      worker.terminate()
      worker = null
    }
    if (perfInterval) clearInterval(perfInterval)
    if (flushInterval) clearInterval(flushInterval)
    connectionState.value = 'closed'
  }

  const setSort = (key: string, dir: 'asc' | 'desc') => {
    isSorting.value = true
    hasActiveSort.value = !(key === 'timestamp' && dir === 'desc')
    worker?.postMessage({ cmd: 'sort', key, dir })
  }

  return {
    incidents, connectionState, currentFilter, isPaused, isScrolling,
    isSorting, globalSearchQuery,
    isSearchMode,
    setGlobalSearchQuery, isSearching, hasActiveSort, eventRate, totalCount,
    selectedIncident, pulseHistory, severityDistribution, chartVisualData,
    scrollerInstance, isAtBottom, selectIncident, closeDetails,
    connect, disconnect, setSort, 
    setFilter: (v: string) => { currentFilter.value = v; worker?.postMessage({ cmd: 'filter', value: v }) },
    setSearchMode, togglePause, setScrollerRef,
    setScrolling: (v: boolean) => { isScrolling.value = v }
  }
})