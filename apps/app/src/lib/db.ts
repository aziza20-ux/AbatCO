import Dexie, { type Table } from 'dexie'

export type QueueRecord = { id: string; payload: unknown; createdAt: number }
export type CachedRecord = { id: string; data: unknown; updatedAt: number }
export type SyncMetadata = { key: string; value: string; updatedAt: number }

class BicycleRecordsDatabase extends Dexie {
  pendingTransactions!: Table<QueueRecord, string>
  pendingRegistrations!: Table<QueueRecord, string>
  cachedBicycles!: Table<CachedRecord, string>
  cachedPeople!: Table<CachedRecord, string>
  syncMetadata!: Table<SyncMetadata, string>

  constructor() {
    super('BicycleRecords')
    this.version(1).stores({
      pendingTransactions: 'id, createdAt',
      pendingRegistrations: 'id, createdAt',
      cachedBicycles: 'id, updatedAt',
      cachedPeople: 'id, updatedAt',
      syncMetadata: 'key, updatedAt',
    })
  }
}

export const db = new BicycleRecordsDatabase()