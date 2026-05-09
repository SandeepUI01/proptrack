export function createFPSMonitor(
  onUpdate: (fps: number, stutters: number) => void
) {
  let lastFrameTime = performance.now()
  let lastReportTime = performance.now()

  let frames = 0
  let stutters = 0

  function loop(now: number) {
    const frameTime = now - lastFrameTime
    lastFrameTime = now
    frames++

    // ✅ proper stutter detection (frame-level)
    if (frameTime > 16.7 * 2) {
      stutters++
    }

    // 📊 report every 1 second
    if (now - lastReportTime >= 1000) {
      const fps = Math.round((frames * 1000) / (now - lastReportTime))

      onUpdate(
        Number.isFinite(fps) ? fps : 0,
        stutters
      )

      frames = 0
      stutters = 0
      lastReportTime = now
    }

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)
}
/* ----------------------------------
   LONG TASK MONITOR (FIXED EXPORT)
-----------------------------------*/
export function monitorLongTasks(onLongTask: (ms: number) => void) {
  if (!('PerformanceObserver' in window)) return

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // @ts-ignore (Chrome-only API)
        if (entry.duration > 50) {
          // @ts-ignore
          onLongTask(entry.duration)
        }
      }
    })

    observer.observe({ entryTypes: ['longtask'] })
  } catch (err) {
    // fails silently if browser doesn't support longtask
    console.warn('LongTask API not supported', err)
  }
}