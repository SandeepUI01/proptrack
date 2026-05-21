<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
    <!-- Live Throughput Pulse -->
    <div
      class="col-span-1 md:col-span-1 lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-40 relative overflow-hidden min-h-[160px]"
    >
      <div class="absolute top-3 left-4 z-10 flex items-center gap-2">
        <span class="relative flex h-2 w-2">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
          ></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest"
          >Live Throughput Pulse</span
        >
      </div>
      <!-- Added explicit layout constraints for the rendering engine -->
      <div class="w-full h-full min-h-[140px] relative">
        <div ref="chartDom" class="absolute inset-0 w-full h-full"></div>
      </div>
    </div>

    <!-- Risk Distribution -->
    <div
      class="col-span-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-40 flex flex-col justify-between overflow-hidden relative min-h-[160px]"
    >
      <span
        class="absolute top-3 left-4 text-[10px] font-black text-slate-500 uppercase tracking-widest"
      >
        Risk Distribution
      </span>
      <!-- Added explicit layout constraints for the rendering engine -->
      <div class="w-full h-full min-h-[130px] mt-2 relative">
        <div ref="donutDom" class="absolute inset-0 w-full h-full"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  GraphicComponent,
  DatasetComponent,
  LegendComponent
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers' // Changed from CanvasRenderer to SVGRenderer
import { useIncidentStore } from '../stores/useIncidentStore'

echarts.use([
  LineChart,
  PieChart,
  GridComponent,
  GraphicComponent,
  DatasetComponent,
  LegendComponent,
  SVGRenderer // Register the cross-browser safe SVG engine
])

const store = useIncidentStore()
const chartDom = ref<HTMLElement | null>(null)
const donutDom = ref<HTMLElement | null>(null)

let myChart: echarts.ECharts | null = null
let donutChart: echarts.ECharts | null = null
let updateInterval: number | null = null

const localVisibleDist = ref({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 })

const handleResize = () => {
  myChart?.resize()
  donutChart?.resize()
}

onMounted(async () => {
  // Ensure Vue finishes mounting structural HTML elements into DOM space
  await nextTick()

  // Throughput Line Plot Initialization
  if (chartDom.value) {
    // Switched to 'svg' options config parameter to clean up Firefox paint engines
    myChart = echarts.init(chartDom.value, undefined, { renderer: 'svg' })
    myChart.setOption({
      grid: { top: 40, right: 50, bottom: 30, left: 45 },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 60 }, (_, i) => i + 1),
        axisLabel: { color: '#94a3b8', fontSize: 8, interval: 14 },
        axisLine: { lineStyle: { color: '#f1f5f9' } }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { color: '#94a3b8', fontSize: 6 }
      },
      graphic: [
        {
          type: 'text',
          right: 5,
          top: 'center',
          style: { text: 'NOW', fill: '#10b981', fontSize: 10 }
        }
      ],
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#10b981' },
          areaStyle: {
            color: 'rgba(16, 185, 129, 0.15)' // Safe vector color assignment for cross-browser engine
          },
          data: store.pulseHistory
        }
      ]
    })
  }

  // Risk Donut Chart Initialization
  if (donutDom.value) {
    // Switched to 'svg' options config parameter to clean up Firefox paint engines
    donutChart = echarts.init(donutDom.value, undefined, { renderer: 'svg' })
    donutChart.setOption({
      legend: {
        orient: 'vertical',
        right: '2%',
        top: 'middle',
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 4,
        textStyle: {
          color: '#475569',
          fontSize: 10,
          fontWeight: '600',
          fontFamily: 'monospace'
        },
        formatter: (name: string) => {
          const val = localVisibleDist.value[name as keyof typeof localVisibleDist.value] || 0
          return `${name.padEnd(9)} ${val}`
        }
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: { disabled: true },
          data: [
            { name: 'CRITICAL', value: 0, itemStyle: { color: '#ef4444' } },
            { name: 'HIGH', value: 0, itemStyle: { color: '#f97316' } },
            { name: 'MEDIUM', value: 0, itemStyle: { color: '#eab308' } },
            { name: 'LOW', value: 0, itemStyle: { color: '#22c55e' } }
          ]
        }
      ]
    })
  }

  // Explicit short delay loop to force accurate layout calculations
  setTimeout(() => {
    handleResize()
  }, 60)

  // Visual Synchronizer Tick Loop
  updateInterval = window.setInterval(() => {
    myChart?.setOption({
      series: [{ data: store.pulseHistory }]
    })

    const currentOnScreen = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    store.incidents.forEach((incident) => {
      const sev = incident.severity?.toUpperCase()
      if (sev in currentOnScreen) {
        currentOnScreen[sev as keyof typeof currentOnScreen]++
      }
    })

    localVisibleDist.value = currentOnScreen

    donutChart?.setOption(
      {
        legend: {
          orient: 'vertical',
          right: '2%',
          top: 'middle',
          itemWidth: 8,
          itemHeight: 8,
          itemGap: 4,
          textStyle: {
            color: '#475569',
            fontSize: 10,
            fontWeight: '600',
            fontFamily: 'monospace'
          },
          formatter: (name: string) => {
            const val = localVisibleDist.value[name as keyof typeof localVisibleDist.value] || 0
            return `${name.padEnd(9)} ${val}`
          }
        },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['35%', '50%'],
            avoidLabelOverlap: false,
            label: { show: false },
            emphasis: { disabled: true },
            data: [
              {
                name: 'CRITICAL',
                value: localVisibleDist.value.CRITICAL,
                itemStyle: { color: '#ef4444' }
              },
              {
                name: 'HIGH',
                value: localVisibleDist.value.HIGH,
                itemStyle: { color: '#f97316' }
              },
              {
                name: 'MEDIUM',
                value: localVisibleDist.value.MEDIUM,
                itemStyle: { color: '#eab308' }
              },
              {
                name: 'LOW',
                value: localVisibleDist.value.LOW,
                itemStyle: { color: '#22c55e' }
              }
            ]
          }
        ]
      },
      true
    )
  }, 1000)

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (updateInterval) clearInterval(updateInterval)
  myChart?.dispose()
  donutChart?.dispose()
})
</script>
