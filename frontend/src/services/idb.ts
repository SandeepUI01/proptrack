import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface IncidentRecord {
  id: string
  timestamp: number
  service: string
  message: string
  severity: string
  value: number
}

class AegisDB extends Dexie {
  incidents!: Table<IncidentRecord, string>

  constructor() {
    super('AEGIS_QMS_DB')

    this.version(1).stores({
      incidents: 'id, timestamp, severity, service'
    })
  }
}

export const db = new AegisDB()

