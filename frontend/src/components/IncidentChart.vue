<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
    <!-- Live Throughput Pulse -->
    <div
      class="md:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-40 relative overflow-hidden"
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
      <div ref="chartDom" class="w-full h-full"></div>
    </div>

    <!-- Risk Distribution -->
    <div
      class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm h-40 flex flex-col justify-between overflow-hidden relative"
    >
      <span
        class="absolute top-3 left-4 text-[10px] font-black text-slate-500 uppercase tracking-widest"
      >
        Risk Distribution
      </span>
      <div ref="donutDom" class="w-full h-full mt-2"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  GraphicComponent,
  DatasetComponent,
  LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useIncidentStore } from '../stores/useIncidentStore'

// Registering essentials
echarts.use([
  LineChart,
  PieChart,
  GridComponent,
  GraphicComponent,
  DatasetComponent,
  LegendComponent,
  CanvasRenderer
])

const store = useIncidentStore()
const chartDom = ref<HTMLElement | null>(null)
const donutDom = ref<HTMLElement | null>(null)

let myChart: echarts.ECharts | null = null
let donutChart: echarts.ECharts | null = null
let updateInterval: number | null = null

onMounted(() => {
  // 1. THROUGHPUT PULSE CHART
  if (chartDom.value) {
    myChart = echarts.init(chartDom.value, undefined, { renderer: 'canvas' })
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
          style: {
            text: 'NOW',
            fill: '#10b981',

            fontSize: 10
          }
        }
      ],
      series: [
        {
          type: 'line',
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#10b981' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0)' }
            ])
          },
          data: store.pulseHistory
        }
      ]
    })
  }

  // 2. RISK DONUT CHART
  if (donutDom.value) {
    donutChart = echarts.init(donutDom.value, undefined, { renderer: 'canvas' })
    donutChart.setOption({
      legend: {
        orient: 'vertical',
        right: '5%',
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
          const val =
            store.severityDistribution[name as keyof typeof store.severityDistribution] || 0
          return `${name.padEnd(9)} ${val}`
        }
      },
      series: [
        {
          type: 'pie',
          radius: ['55%', '85%'],
          center: ['30%', '50%'],
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

  // 3. EFFICIENT UPDATE LOOP
  updateInterval = window.setInterval(() => {
    myChart?.setOption({
      series: [{ data: store.pulseHistory }]
    })

    donutChart?.setOption(
      {
        legend: {
          formatter: (name: string) => {
            const val =
              store.severityDistribution[name as keyof typeof store.severityDistribution] || 0
            return `${name.padEnd(9)} ${val}`
          }
        },
        series: [
          {
            data: [
              {
                name: 'CRITICAL',
                value: store.severityDistribution.CRITICAL,
                itemStyle: { color: '#ef4444' }
              },
              {
                name: 'HIGH',
                value: store.severityDistribution.HIGH,
                itemStyle: { color: '#f97316' }
              },
              {
                name: 'MEDIUM',
                value: store.severityDistribution.MEDIUM,
                itemStyle: { color: '#eab308' }
              },
              {
                name: 'LOW',
                value: store.severityDistribution.LOW,
                itemStyle: { color: '#22c55e' }
              }
            ]
          }
        ]
      },
      false
    )
  }, 1000)

  window.addEventListener('resize', handleResize)
})

const handleResize = () => {
  myChart?.resize()
  donutChart?.resize()
}

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (updateInterval) clearInterval(updateInterval)
  myChart?.dispose()
  donutChart?.dispose()
})
</script>
