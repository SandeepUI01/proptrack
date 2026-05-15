<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useIncidentStore } from '../stores/useIncidentStore'

const props = defineProps<{
  searchQuery: string
  isSearching: boolean
  searchResults: any[]
  getSeverityBorder: (s: string) => string
}>()

const emit = defineEmits(['update:searchQuery', 'clear', 'aiSearch', 'select'])
const store = useIncidentStore()
const inputRef = ref<HTMLInputElement | null>(null)

// Focus management
watch(
  () => props.searchQuery.length >= 3,
  async (isVisible) => {
    if (isVisible) {
      await nextTick()
      inputRef.value?.focus()
    }
  }
)

const handleInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  emit('update:searchQuery', val)
  emit('aiSearch')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="searchQuery.length >= 3"
        class="fixed inset-0 z-[10000] flex items-start justify-center pt-[10vh] px-4"
      >
        <div
          class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          @click="$emit('clear')"
        ></div>

        <div
          class="search-modal-content relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        >
          <!-- Search Input -->
          <div class="flex items-center px-6 h-20 border-b-2 border-slate-100 bg-white">
            <div
              v-if="isSearching"
              class="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-4"
            ></div>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              stroke-width="3"
              class="mr-4"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref="inputRef"
              :value="searchQuery"
              @input="handleInput"
              @keydown.esc.stop="$emit('clear')"
              placeholder="DESCRIBE THE INCIDENT PATTERN..."
              class="flex-1 bg-transparent text-xl font-black outline-none uppercase text-slate-800"
            />
            <button
              @click="$emit('clear')"
              class="ml-4 text-[10px] font-black bg-slate-100 px-3 py-1.5 rounded uppercase"
            >
              Esc
            </button>
          </div>

          <!-- Results Section with Recycle Scroller -->
          <div class="min-h-[25vh] max-h-[60vh] bg-slate-50/30 overflow-hidden">
            <div
              v-if="isSearching && searchResults.length === 0"
              class="p-20 text-center animate-pulse text-slate-400 font-black text-xs uppercase"
            >
              Querying Neural Engine...
            </div>

            <div
              v-else-if="!isSearching && searchResults.length === 0"
              class="p-20 text-center text-slate-400 font-black text-xs uppercase"
            >
              No matching patterns found
            </div>

            <!-- THE RECYCLE SCROLLER -->
            <RecycleScroller
              v-else
              class="max-h-[60vh] custom-scrollbar"
              :items="searchResults"
              :item-size="96"
              key-field="id"
              v-slot="{ item }"
            >
              <div
                @click="$emit('select', $event, item)"
                :class="[
                  'h-full px-6 border-b border-slate-100 hover:bg-white cursor-pointer flex justify-between items-center transition-all border-l-4',
                  store.selectedIncident?.id === item.id ? 'bg-blue-50/80' : 'bg-transparent',
                  getSeverityBorder(item.severity)
                ]"
              >
                <div class="flex flex-col gap-1 pr-8 truncate">
                  <span class="text-[10px] font-black text-blue-600 uppercase">{{
                    item.service
                  }}</span>
                  <span class="text-base font-bold italic text-slate-800 leading-tight truncate"
                    >"{{ item.message }}"</span
                  >
                </div>

                <div class="flex items-center gap-4 shrink-0">
                  <div class="text-right">
                    <div class="text-2xl font-black text-blue-600">
                      {{ ((item.similarity ?? 0) * 100).toFixed(0) }}%
                    </div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {{ item.severity }}
                    </div>
                  </div>
                  <div class="w-6">
                    <svg
                      v-if="store.selectedIncident?.id === item.id"
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#3b82f6"
                      stroke-width="4"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            </RecycleScroller>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  display: none;
}
.custom-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
