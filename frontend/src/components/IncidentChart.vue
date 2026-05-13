<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
    <div
      class="md:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-32 relative overflow-hidden"
    >
      <div class="absolute top-3 left-4 z-10">
        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest"
          >Live Throughput Pulse</span
        >
      </div>
      <div ref="chartDom" class="w-full h-full"></div>
    </div>

    <div
      class="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg h-32 flex flex-col justify-between"
    >
      <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest"
        >Risk Distribution</span
      >
      <div class="flex items-end justify-between gap-1 h-12">
        <div
          v-for="(val, sev) in store.severityDistribution"
          :key="sev"
          class="flex-1 flex flex-col items-center gap-1"
        >
          <div
            class="w-full rounded-t-sm transition-all duration-500"
            :class="{
              'bg-red-500': sev === 'CRITICAL',
              'bg-orange-500': sev === 'HIGH',
              'bg-yellow-500': sev === 'MEDIUM',
              'bg-green-500': sev === 'LOW'
            }"
            :style="{ height: `${Math.min((val / (store.eventRate || 1)) * 100, 100)}%` }"
          ></div>
          <span class="text-[8px] font-bold text-slate-500">{{ sev[0] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import { useIncidentStore } from '../stores/useIncidentStore'

const store = useIncidentStore()
const chartDom = ref<HTMLElement | null>(null)
let myChart: echarts.ECharts | null = null
let updateInterval: number | null = null

// Debounced resize handler
let resizeTimeout: number
const handleResize = () => {
  clearTimeout(resizeTimeout)
  resizeTimeout = window.setTimeout(() => myChart?.resize(), 150)
}

onMounted(() => {
  if (!chartDom.value) return
  myChart = echarts.init(chartDom.value)

  const option = {
    backgroundColor: 'transparent',
    grid: { top: 10, right: 10, bottom: 10, left: 10 },
    xAxis: { type: 'category', show: false, boundaryGap: false },
    yAxis: { type: 'value', show: false, min: 0 },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'lttb',
        animation: false,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
          ])
        },
        lineStyle: { color: '#3b82f6', width: 2 },
        data: [...store.pulseHistory]
      }
    ]
  }

  myChart.setOption(option)
  window.addEventListener('resize', handleResize)

  // Decoupled update loop: prevents freezing by not relying on Vue Watchers
  updateInterval = window.setInterval(() => {
    myChart?.setOption(
      {
        series: [{ data: [...store.pulseHistory] }]
      },
      false
    )
  }, 1000)
})

onUnmounted(() => {
  if (updateInterval) clearInterval(updateInterval)
  window.removeEventListener('resize', handleResize)
  myChart?.dispose()
})
</script>
