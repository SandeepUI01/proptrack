<template>
  <div
    class="h-[calc(100vh-220px)] w-full overflow-hidden border border-slate-200 rounded-lg bg-white shadow-sm"
  >
    <RecycleScroller
      class="h-full"
      :items="store.incidents"
      :item-size="56"
      key-field="id"
      v-slot="{ item }"
    >
      <div
        class="flex items-center px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
      >
        <div class="w-24 text-[11px] font-mono text-slate-400">
          {{ formatTimestamp(item.timestamp) }}
        </div>
        <div class="flex-1 font-medium text-slate-800 text-sm">{{ item.message }}</div>
        <div class="w-24 text-right">
          <span
            class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
            :class="getSeverityColor(item.severity)"
          >
            {{ item.severity }}
          </span>
        </div>
      </div>
    </RecycleScroller>
  </div>
</template>

<script setup lang="ts">
import { useIncidentStore } from '../stores/useIncidentStore'
import { RecycleScroller } from 'vue-virtual-scroller'

const store = useIncidentStore()

const formatTimestamp = (ts: any) => new Date(ts).toLocaleTimeString()

const getSeverityColor = (sev: string) => {
  switch (sev) {
    case 'CRITICAL':
      return 'bg-red-50 text-red-600 border border-red-200'
    case 'HIGH':
      return 'bg-orange-50 text-orange-600 border border-orange-200'
    case 'MEDIUM':
      return 'bg-yellow-50 text-yellow-600 border border-yellow-200'
    default:
      return 'bg-green-50 text-green-600 border border-green-200'
  }
}
</script>
