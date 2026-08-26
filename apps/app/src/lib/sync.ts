import { db } from './db'
import { syncOperations, type SyncResult } from './api'

export type SyncSummary = { synced: number; alreadySynced: number; conflicts: number; failed: number; validationErrors: number }

let running = false

export async function flushPendingOperations(): Promise<SyncSummary> {
  if (running) return { synced: 0, alreadySynced: 0, conflicts: 0, failed: 0, validationErrors: 0 }
  running = true
  const summary: SyncSummary = { synced: 0, alreadySynced: 0, conflicts: 0, failed: 0, validationErrors: 0 }

  try {
    const [pendingTx, pendingReg] = await Promise.all([
      db.pendingTransactions.orderBy('createdAt').toArray(),
      db.pendingRegistrations.orderBy('createdAt').toArray(),
    ])

    const operations = [
      ...pendingTx.map((r) => ({ clientOperationId: r.id, entity: 'Transaction' as const, payload: r.payload })),
      ...pendingReg.map((r) => ({ clientOperationId: r.id, entity: 'Registration' as const, payload: r.payload })),
    ]

    if (operations.length === 0) return summary

    // Send in batches of 50 (server limit)
    for (let i = 0; i < operations.length; i += 50) {
      const batch = operations.slice(i, i + 50)
      const result = await syncOperations(batch)
      const results: SyncResult[] = result.data.results

      for (const r of results) {
        switch (r.status) {
          case 'SYNCED':
            summary.synced++
            await db.pendingTransactions.delete(r.clientOperationId)
            await db.pendingRegistrations.delete(r.clientOperationId)
            break
          case 'ALREADY_SYNCED':
            summary.alreadySynced++
            await db.pendingTransactions.delete(r.clientOperationId)
            await db.pendingRegistrations.delete(r.clientOperationId)
            break
          case 'CONFLICT':
            summary.conflicts++
            // Keep in local queue so agent can see it; mark in syncMetadata
            await db.syncMetadata.put({ key: `conflict:${r.clientOperationId}`, value: r.conflictReason ?? 'Conflict', updatedAt: Date.now() })
            break
          case 'VALIDATION_ERROR':
            summary.validationErrors++
            // Keep locally — agent needs to fix the data
            await db.syncMetadata.put({ key: `error:${r.clientOperationId}`, value: r.conflictReason ?? 'Validation error', updatedAt: Date.now() })
            break
          default:
            summary.failed++
            break
        }
      }
    }
  } finally {
    running = false
  }

  return summary
}

/** Call once on app mount — syncs when online, re-syncs on reconnect */
export function startSyncWorker(onResult?: (summary: SyncSummary) => void) {
  const attempt = () => {
    if (navigator.onLine) {
      flushPendingOperations()
        .then((summary) => { if (onResult && (summary.synced + summary.conflicts + summary.failed + summary.validationErrors) > 0) onResult(summary) })
        .catch(() => undefined)
    }
  }

  // Sync immediately on mount
  attempt()

  // Re-sync when connectivity returns
  window.addEventListener('online', attempt)

  return () => window.removeEventListener('online', attempt)
}
