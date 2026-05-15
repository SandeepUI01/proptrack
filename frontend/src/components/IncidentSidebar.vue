<script setup lang="ts">
import { useIncidentStore } from '../stores/useIncidentStore'

const store = useIncidentStore()

const props = defineProps<{
  getSeverityStyle: (s: string) => string
}>()

const copyPayload = (incident: any) => {
  const payload = JSON.stringify(incident, null, 2)
  navigator.clipboard.writeText(payload)
}
</script>

<template>
  <Transition name="slide">
    <div
      v-if="store.selectedIncident"
      class="fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-[10001] flex flex-col border-l"
    >
      <div class="p-5 border-b bg-slate-900 text-white flex justify-between items-center">
        <h2 class="font-black italic text-sm uppercase tracking-tighter">Incident Explorer</h2>
        <button
          @click.stop="store.closeDetails()"
          class="bg-red-500 text-white px-4 py-1 rounded text-[10px] font-black uppercase hover:bg-red-600"
        >
          Close [X]
        </button>
      </div>
      <div class="p-8 space-y-8 overflow-y-auto font-mono text-xs text-slate-900">
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Service</label>
          <div class="text-2xl font-black text-slate-800 leading-tight">
            {{ store.selectedIncident.service }}
          </div>
        </div>
        <div class="grid grid-cols-2 gap-6">
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1"
              >Severity</label
            >
            <div
              :class="getSeverityStyle(store.selectedIncident.severity)"
              class="p-3 rounded-lg font-black text-center border uppercase"
            >
              {{ store.selectedIncident.severity }}
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1"
              >Metric Value</label
            >
            <div class="bg-slate-50 p-3 border rounded-lg font-black text-center tabular-nums">
              {{ store.selectedIncident.value?.toFixed(4) ?? 'N/A' }}
            </div>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Trace ID</label>
          <div class="bg-slate-100 p-3 border rounded break-all text-blue-700 font-bold uppercase">
            {{ store.selectedIncident.id }}
          </div>
        </div>
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase block mb-1">Message</label>
          <div class="bg-slate-50 p-5 border rounded-xl leading-relaxed italic shadow-inner">
            "{{ store.selectedIncident.message }}"
          </div>
        </div>
        <button
          @click="copyPayload(store.selectedIncident)"
          class="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-[11px] uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          Copy JSON Payload
        </button>
      </div>
    </div>
  </Transition>
</template>
