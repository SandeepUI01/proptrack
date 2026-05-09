import Dexie, { type Table } from 'dexie'

export interface Incident {
  id: string
  timestamp: number
  service: string
  severity: string
  value: number
  message?: string
}

class IncidentDB extends Dexie {
  incidents!: Table<Incident, string>

  constructor() {
    super('aegis_qms')

    this.version(1).stores({
      incidents: 'id, timestamp, severity, service'
    })
  }
}

export const db = new IncidentDB()