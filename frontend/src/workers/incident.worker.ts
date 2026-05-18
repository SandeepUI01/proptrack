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
let searchQuery = '' 
let searchTimeout: any = null;

let cacheDirty = true
let cachedResult: any[] = []

// Dynamic runtime fallback variable to store our configuration string
let websocketUrl = 'ws://localhost:8080/ws'

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

    // Clean up old data to keep the DB small
    const tenMinsAgo = Date.now() - (10 * 60 * 1000)
    await db.incidents.where('timestamp').below(tenMinsAgo).delete()
  } catch (err) {
    console.error('IDB Write Error:', err)
  }
}, 5000)

/* ---------------- DATA HELPERS ---------------- */
function processIncoming(raw: any) {
  const sev = (raw.severity || 'LOW').toUpperCase()
  const ts = raw.timestamp || Date.now()
  
  if (severityDistribution.hasOwnProperty(sev)) {
    severityDistribution[sev as keyof typeof severityDistribution]++
  }

  return Object.freeze({
    id: raw.id || `${ts}-${Math.random()}`,
    timestamp: ts,
    displayTime: new Date(ts).toLocaleTimeString('en-GB', { hour12: false }), 
    service: raw.service || 'unknown',
    message: raw.message || '',
    severity: sev,
    value: raw.value || 0,
    serviceLower: (raw.service || 'unknown').toLowerCase(),
    messageLower: (raw.message || '').toLowerCase()
  })
}

function debouncedSearch(query: string) {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = query;
    cacheDirty = true;
  }, 150); 
}

/* ---------------- FILTER + SORT ---------------- */
function getFilteredAndSortedData(sourceArray: any[]) {
  let data = sourceArray.slice()

  if (activeFilter !== 'ALL') {
    data = data.filter(i => i.severity === activeFilter)
  }

  const safeSearch = String(searchQuery || '').trim().toLowerCase()
  if (safeSearch) {
    data = data.filter(i =>
      i.serviceLower.includes(safeSearch) ||
      i.messageLower.includes(safeSearch)
    )
  }

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

  // 🚀 FIXED: Dynamic targeting using runtime endpoint variables
  socket = new WebSocket(websocketUrl)

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      const items = Array.isArray(data) ? data : [data]

      for (let i = 0; i < items.length; i++) {
        const processed = processIncoming(items[i])

        mainBuffer.push(processed)
        uiBuffer.push(processed)
        persistenceBuffer.push(processed)
        
        cacheDirty = true
      }

      if (mainBuffer.length > 5000) {
        mainBuffer.splice(0, mainBuffer.length - 5000)
      }

      if (uiBuffer.length > 200) {
        uiBuffer.splice(0, uiBuffer.length - 100)
      }
    } catch (e) {
        console.error("Worker Parse Error", e);
    }
  }

  socket.onopen = () => self.postMessage({ type: 'status', data: 'open' })

  socket.onclose = () => {
    self.postMessage({ type: 'status', data: 'closed' })
    socket = null
    setTimeout(connectSocket, 5000)
  }
}

/* ---------------- LOOP ---------------- */
function startLoop() {
  if (intervalId) clearInterval(intervalId)

  intervalId = setInterval(() => {
    if (isPaused) return

    let finalData: any[]
    const hasSearch = String(searchQuery || '').trim().length > 0
    const hasHeavyOps = hasSearch || activeFilter !== 'ALL' || currentSort

    if (!cacheDirty && cachedResult.length) {
      finalData = cachedResult
    } else {
      let processed = hasHeavyOps
        ? getFilteredAndSortedData(mainBuffer)
        : uiBuffer.slice() 

      cachedResult = processed.slice(-200).reverse()
      cacheDirty = false
      finalData = cachedResult
    }
    
    if (currentSort && cacheDirty === false) {
      self.postMessage({ type: 'sort-complete' });
    }

    self.postMessage({
      type: 'batch',
      data: [...finalData], 
      dist: { ...severityDistribution },
      count: mainBuffer.length
    })
  }, 500) //Updates  500ms
}

/* ---------------- COMMAND HANDLING ---------------- */
self.onmessage = (e) => {
  const { cmd, value, key, dir, url } = e.data

  switch (cmd) {
    case 'connect':
      if (started) return
      started = true
      
      // 🚀 FIXED: Assign injected production socket URL string before running handshake routine
      if (url && typeof url === 'string' && url.trim() !== '') {
        websocketUrl = url
      }
      
      connectSocket()
      startLoop()
      break

    case 'pause':
      isPaused = value
      break

    case 'sort':
      currentSort = (key && dir) ? { key, dir } : null
      cacheDirty = true
      break

    case 'filter':
      activeFilter = value
      cacheDirty = true
      break

    case 'search':
      debouncedSearch(value || '');
      break
  }
}