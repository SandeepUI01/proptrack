import { db } from '../services/idb'

// --- STATE ---
let mainBuffer: any[] = []
let uiBuffer: any[] = []
let persistenceBuffer: any[] = []
let socket: WebSocket | null = null
let intervalId: any = null

let isPaused = false
let currentSort: { key: string, dir: 'asc' | 'desc' } | null = null
let activeFilter = 'ALL'
let searchQuery = '' // Always defaults to string

// Cache system
let cacheDirty = true
let cachedResult: any[] = []

const _severityRank: Record<string, number> = {
  CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1
}

const severityDistribution = {
  CRITICAL: 0,
  HIGH: 0,
  MEDIUM: 0,
  LOW: 0
}

let started = false

/* ---------------- PERSISTENCE ENGINE ---------------- */
setInterval(async () => {
  if (persistenceBuffer.length === 0) return

  const toWrite = persistenceBuffer.slice()
  persistenceBuffer = []

  try {
    await db.transaction('rw', db.incidents, async () => {
      await db.incidents.bulkPut(toWrite)
    })

    const fiveMinsAgo = Date.now() - (5 * 60 * 1000)
    await db.incidents.where('timestamp').below(fiveMinsAgo).delete()
  } catch (err) {
    persistenceBuffer = []
  }
}, 3000)

/* ---------------- DATA HELPERS ---------------- */
function processIncoming(raw: any) {
  const sev = (raw.severity || 'LOW').toUpperCase()
  const ts = raw.timestamp || Date.now()
  
  return Object.freeze({
    id: raw.id || `${ts}-${Math.random()}`,
    timestamp: ts,
    // PRE-FORMAT THE TIME HERE (Worker Thread)
    displayTime: new Date(ts).toLocaleTimeString('en-GB', { hour12: false }), 
    service: raw.service || 'unknown',
    message: raw.message || '',
    severity: sev,
    serviceLower: (raw.service || 'unknown').toLowerCase(),
    messageLower: (raw.message || '').toLowerCase()
  })
}

/* ---------------- FILTER + SORT (FIXED) ---------------- */
function getFilteredAndSortedData(sourceArray: any[]) {
  let data = sourceArray.slice()

  // 1. Severity Filter
  if (activeFilter !== 'ALL') {
    data = data.filter(i => i.severity === activeFilter)
  }

  // 2. Search Filter (FIXED: searchQuery.toLowerCase crash)
  // Ensure we have a valid string and it's not just whitespace
  const safeSearch = String(searchQuery || '').trim().toLowerCase()
  
  if (safeSearch) {
    data = data.filter(i =>
      i.serviceLower.includes(safeSearch) ||
      i.messageLower.includes(safeSearch)
    )
  }

  // 3. Sorting
  if (currentSort) {
    const { key, dir } = currentSort

    data.sort((a, b) => {
      let A = a[key]
      let B = b[key]

      if (key === 'severity') {
        A = _severityRank[A] || 0
        B = _severityRank[B] || 0
      }

      if (A === B) return 0
      const res = A > B ? 1 : -1
      return dir === 'asc' ? res : -res
    })
  }

  return data
}

/* ---------------- SOCKET ---------------- */
function connectSocket() {
  if (socket) return

  socket = new WebSocket('ws://localhost:8080/ws')

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data)
    const items = Array.isArray(data) ? data : [data]

    for (let i = 0; i < items.length; i++) {
      const processed = processIncoming(items[i])

      mainBuffer.push(processed)
      uiBuffer.push(processed)

      persistenceBuffer.push(processed)
      if (persistenceBuffer.length > 5000) {
        persistenceBuffer.splice(0, persistenceBuffer.length - 5000)
      }

      cacheDirty = true
    }

    if (mainBuffer.length > 10000) {
      mainBuffer.splice(0, mainBuffer.length - 10000)
    }

    if (uiBuffer.length > 400) {
      uiBuffer.splice(0, uiBuffer.length - 200)
    }
  }

  socket.onopen = () =>
    self.postMessage({ type: 'status', data: 'open' })

  socket.onclose = () => {
    self.postMessage({ type: 'status', data: 'closed' })
    socket = null
    setTimeout(connectSocket, 3000)
  }
}

/* ---------------- LOOP ---------------- */
function startLoop() {
  if (intervalId) clearInterval(intervalId)

  intervalId = setInterval(() => {
    if (isPaused) return

    let finalData: any[]
    // Added safety check for searchQuery here as well
    const hasSearch = String(searchQuery || '').trim().length > 0
    const hasHeavyOps = hasSearch || activeFilter !== 'ALL' || currentSort

    if (!cacheDirty && cachedResult.length) {
      finalData = cachedResult
    } else {
      let processed = hasHeavyOps
        ? getFilteredAndSortedData(mainBuffer)
        : uiBuffer.slice() 

      cachedResult =
        processed.length > 300
          ? processed.slice(-300).reverse()
          : processed.slice().reverse()

      cacheDirty = false
      finalData = cachedResult
    }

    self.postMessage({
      type: 'batch',
      data: finalData,
      dist: { ...severityDistribution },
      count: mainBuffer.length
    })
  }, 200)
}

/* ---------------- COMMAND HANDLING ---------------- */
self.onmessage = (e) => {
  const { cmd, value, key, dir } = e.data

  switch (cmd) {
    case 'connect':
      if (started) return
      started = true
      connectSocket()
      startLoop()
      break

    case 'pause':
      isPaused = value
      break

    case 'sort':
      currentSort = value ? { key, dir } : null
      cacheDirty = true
      break

    case 'filter':
      activeFilter = value
      cacheDirty = true
      break

    case 'search':
      // Ensure we store value as string to prevent downstream object crashes
      searchQuery = value || ''
      cacheDirty = true
      break
  }
}