<script setup lang="ts">
import { useIncidentStore } from '../stores/useIncidentStore'

const props = defineProps<{
  sortKey: string
  sortDir: string
  getSeverityBorder: (s: string) => string
  getSeverityBg: (s: string) => string
  getSeverityStyle: (s: string) => string
  formatTimestamp: (ts: number) => string
}>()

const emit = defineEmits(['sort', 'scroll'])
const store = useIncidentStore()
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col relative z-0">
    <!-- Header -->
    <div
      class="flex items-center h-10 px-4 font-mono text-[10px] font-bold bg-slate-100 text-slate-500 uppercase border rounded-t-xl"
    >
      <span class="w-32 cursor-pointer hover:text-slate-900" @click="$emit('sort', 'timestamp')">
        TIME {{ sortKey === 'timestamp' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}
      </span>
      <span
        class="flex-1 px-4 cursor-pointer hover:text-slate-900"
        @click="$emit('sort', 'service')"
      >
        SERVICE / TRACE ID {{ sortKey === 'service' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}
      </span>
      <span
        class="w-24 text-center cursor-pointer hover:text-slate-900"
        @click="$emit('sort', 'severity')"
      >
        SEVERITY {{ sortKey === 'severity' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}
      </span>
      <span
        class="w-20 text-right cursor-pointer hover:text-slate-900"
        @click="$emit('sort', 'value')"
      >
        VALUE {{ sortKey === 'value' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}
      </span>
    </div>

    <!-- Scroller -->
    <div class="flex-1 bg-white border border-t-0 shadow-lg overflow-hidden rounded-b-xl relative">
      <RecycleScroller
        class="h-full"
        :items="store.incidents"
        :item-size="44"
        key-field="id"
        v-slot="{ item }"
        @scroll="$emit('scroll')"
      >
        <div
          @click="store.selectIncident(item)"
          :class="[
            'flex items-center h-[44px] px-4 font-mono text-[12px] border-b cursor-pointer hover:bg-slate-50 border-l-4 transition-all',
            getSeverityBorder(item.severity),
            store.selectedIncident?.id === item.id ? getSeverityBg(item.severity) : 'bg-white'
          ]"
        >
          <span class="w-32 text-slate-400 tabular-nums font-bold">{{
            formatTimestamp(item.timestamp)
          }}</span>
          <div class="flex-1 px-4 truncate flex flex-col">
            <span class="font-bold text-slate-800 text-xs truncate">{{ item.service }}</span>
            <span class="text-[8px] text-slate-400 font-bold uppercase">{{ item.id }}</span>
          </div>
          <div class="w-24 flex justify-center">
            <span
              class="w-20 text-center text-[10px] font-black uppercase tracking-tighter"
              :class="getSeverityStyle(item.severity)"
            >
              {{ item.severity }}
            </span>
          </div>
          <span class="w-20 text-right font-bold text-slate-600 tabular-nums">
            {{ item.value !== undefined ? item.value.toFixed(2) : '0.00' }}
          </span>
        </div>
      </RecycleScroller>
    </div>
  </div>
</template>
