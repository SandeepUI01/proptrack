<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
    <div
      class="md:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-32 relative overflow-hidden"
    >
      <span
        class="absolute top-3 left-4 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest"
        >Live Throughput Pulse</span
      >
      <div ref="chartDom" class="w-full h-full"></div>
    </div>

    <div
      class="bg-white border border-slate-200 rounded-xl p-4 shadow-lg h-32 flex flex-col justify-between overflow-hidden"
    >
      <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest"
        >Risk Distribution</span
      >
      <div ref="donutDom" class="w-full h-full -mt-2"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useIncidentStore } from '../stores/useIncidentStore'

// Register ONLY what we need to keep the bundle and memory footprint tiny
echarts.use([LineChart, PieChart, GridComponent, CanvasRenderer])

const store = useIncidentStore()
const chartDom = ref<HTMLElement | null>(null)
const donutDom = ref<HTMLElement | null>(null)

let myChart: echarts.ECharts | null = null
let donutChart: echarts.ECharts | null = null
let updateInterval: number | null = null

onMounted(() => {
  if (chartDom.value) {
    myChart = echarts.init(chartDom.value, undefined, { renderer: 'canvas' })
    myChart.setOption({
      grid: { top: 20, right: 0, bottom: 0, left: 0 },
      xAxis: { type: 'category', show: false },
      yAxis: { type: 'value', show: false },
      series: [
        {
          type: 'line',
          sampling: 'lttb',
          animation: false,
          lineStyle: { width: 1 },
          emphasis: { disabled: true } // Memory saver
        }
      ]
    })
  }

  if (donutDom.value) {
    donutChart = echarts.init(donutDom.value, undefined, { renderer: 'canvas' })
    donutChart.setOption({
      series: [
        {
          type: 'pie',
          radius: ['50%', '80%'],
          label: { show: false },
          emphasis: { disabled: true } // Memory saver
        }
      ]
    })
  }

  updateInterval = window.setInterval(() => {
    // Direct data injection (no spread, no extra objects)
    myChart?.setOption({ series: [{ data: store.pulseHistory }] }, false)
    donutChart?.setOption(
      {
        series: [
          {
            data: [
              { value: store.severityDistribution.CRITICAL, itemStyle: { color: '#ef4444' } },
              { value: store.severityDistribution.HIGH, itemStyle: { color: '#f97316' } },
              { value: store.severityDistribution.MEDIUM, itemStyle: { color: '#eab308' } },
              { value: store.severityDistribution.LOW, itemStyle: { color: '#22c55e' } }
            ]
          }
        ]
      },
      false
    )
  }, 1000)
})

onUnmounted(() => {
  clearInterval(updateInterval!)
  myChart?.dispose()
  donutChart?.dispose()
})
</script>
