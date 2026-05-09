// stores/useMarketStore.ts
import { defineStore } from 'pinia'

export interface MarketTick {
  id: string
  symbol: string
  price: number
  volume: number
  trend: 'UP' | 'DOWN'
  timestamp: number
}

export const useMarketStore = defineStore('market', {
  state: () => ({
    ticks: [] as MarketTick[],
    isConnected: false,
  }),
  actions: {
    connect() {
      const socket = new WebSocket('ws://localhost:8080/ws')

      socket.onopen = () => {
        console.log('✅ WebSocket connected')
        this.isConnected = true
      }

      socket.onclose = () => {
        console.log('❌ WebSocket disconnected')
        this.isConnected = false
      }

      socket.onmessage = (event) => {
        try {
          const tick: MarketTick = JSON.parse(event.data)
          // Add to the top of the array
          this.ticks.unshift(tick)
          // Keep only latest 100 ticks
          if (this.ticks.length > 100) this.ticks.pop()
        } catch (err) {
          console.error('Failed to parse tick', err)
        }
      }
    },
  },
})