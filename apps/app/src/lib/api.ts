const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

type ApiEnvelope<T> = { data: T }

let refreshPromise: Promise<void> | null = null

async function silentRefresh(): Promise<void> {
  const result = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
  if (!result.ok) { localStorage.removeItem('abatco_token'); throw new Error('Session expired') }
  const json = await result.json() as ApiEnvelope<{ token: string }>
  localStorage.setItem('abatco_token', json.data.token)
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = localStorage.getItem('abatco_token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  if (response.status === 401 && retry) {
    if (!refreshPromise) refreshPromise = silentRefresh().finally(() => { refreshPromise = null })
    await refreshPromise
    return apiRequest<T>(path, options, false)
  }
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message ?? (await response.json().catch(() => null))?.error ?? 'Request failed')
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const result = await apiRequest<ApiEnvelope<{ token: string; user: { id: string; name: string; role: 'ADMIN' | 'AGENT' } }>>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  localStorage.setItem('abatco_token', result.data.token)
  return result.data
}

export async function refreshAccessToken() {
  await silentRefresh()
}

export async function logout() {
  await apiRequest<void>('/auth/logout', { method: 'POST' })
  localStorage.removeItem('abatco_token')
}

// ── People ────────────────────────────────────────────────────────────────────

export type Person = { id: string; name: string; nationalId: string; phone?: string; cell?: string; address?: string; sector?: string; village?: string }

export async function listPeople(q?: string, page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '5', ...(q ? { q } : {}) })
  return apiRequest<ApiEnvelope<Person[]>>(`/people?${params}`)
}

export async function getPerson(id: string) {
  return apiRequest<ApiEnvelope<Person & { currentBicycles: { id: string; frameNumber: string; brand?: string; model?: string; status: string }[]; registrations: { id: string; bicycleId: string; createdAt: string }[] }>>(`/people/${id}`)
}

export async function createPerson(data: Omit<Person, 'id'>) {
  return apiRequest<ApiEnvelope<Person>>('/people', { method: 'POST', body: JSON.stringify(data) })
}

export async function updatePerson(id: string, data: Partial<Omit<Person, 'id'>>) {
  return apiRequest<ApiEnvelope<Person>>(`/people/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

// ── Bicycles ──────────────────────────────────────────────────────────────────

export type Bicycle = { id: string; frameNumber: string; brand?: string; model?: string; color?: string; distinguishingFeatures?: string; photos: string[]; currentOwnerId?: string; currentOwner?: Person; status: string }

export async function listBicycles(q?: string, page = 1, from?: string, to?: string) {
  const params = new URLSearchParams({ page: String(page), limit: '5', ...(q ? { q } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) })
  return apiRequest<ApiEnvelope<Bicycle[]>>(`/bicycles?${params}`)
}

export async function getBicycle(id: string) {
  return apiRequest<ApiEnvelope<Bicycle & { registrations: unknown[]; transactions: unknown[] }>>(`/bicycles/${id}`)
}

export async function createBicycle(data: { frameNumber: string; brand?: string; model?: string; color?: string; distinguishingFeatures?: string; photos?: string[]; currentOwnerId?: string }) {
  return apiRequest<ApiEnvelope<Bicycle>>('/bicycles', { method: 'POST', body: JSON.stringify(data) })
}

export async function upsertPersonByNationalId(data: Omit<Person, 'id'>): Promise<Person> {
  const result = await listPeople(data.nationalId)
  const existing = result.data.find((p) => p.nationalId.toLowerCase() === data.nationalId.toLowerCase())
  if (existing) return existing
  return (await createPerson(data)).data
}

export async function upsertBicycleByFrameNumber(data: { frameNumber: string; brand?: string; model?: string; color?: string; distinguishingFeatures?: string }): Promise<Bicycle> {
  const result = await listBicycles(data.frameNumber)
  const existing = result.data.find((b) => b.frameNumber.toLowerCase() === data.frameNumber.toLowerCase())
  if (existing) return existing
  return (await createBicycle(data)).data
}

export async function updateBicycle(id: string, data: { brand?: string; model?: string; color?: string; distinguishingFeatures?: string; status?: string; currentOwnerId?: string }) {
  return apiRequest<ApiEnvelope<Bicycle>>(`/bicycles/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type PersonSummary = { id: string; name: string; nationalId?: string; phone?: string; cell?: string; sector?: string; village?: string }
export type Transaction = { id: string; transactionId: string; type: 'SALE' | 'TRANSFER'; price?: number; serviceFee?: number; reason?: string; location?: string; transactionDate: string; flagStatus: string; flagReason?: string; agentNote?: string; adminReviewNotes?: string; bicycle: { id: string; frameNumber: string; brand?: string; model?: string }; seller?: PersonSummary; buyer?: PersonSummary; recordingAgent: { id: string; name: string } }

export async function listTransactions(params?: { q?: string; flagStatus?: string; agentId?: string; personId?: string; page?: number }) {
  const search = new URLSearchParams({ page: String(params?.page ?? 1), limit: '5', ...(params?.q ? { q: params.q } : {}), ...(params?.flagStatus ? { flagStatus: params.flagStatus } : {}), ...(params?.agentId ? { agentId: params.agentId } : {}), ...(params?.personId ? { personId: params.personId } : {}) })
  return apiRequest<ApiEnvelope<Transaction[]>>(`/transactions?${search}`)
}

export async function getTransaction(id: string) {
  return apiRequest<ApiEnvelope<Transaction>>(`/transactions/${id}`)
}

export async function createTransaction(data: object, clientOperationId: string) {
  return apiRequest<ApiEnvelope<Transaction>>('/transactions', { method: 'POST', body: JSON.stringify(data), headers: { 'x-client-operation-id': clientOperationId } })
}

export async function editTransaction(id: string, data: object) {
  return apiRequest<ApiEnvelope<Transaction>>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

// ── Registrations ─────────────────────────────────────────────────────────────

export type Registration = { id: string; bicycleId: string; ownerId: string; createdAt: string; bicycle: { id: string; frameNumber: string; brand?: string; model?: string }; owner: PersonSummary & { nationalId: string }; recordingAgent: { id: string; name: string } }

export async function listRegistrations(params?: { bicycleId?: string; ownerId?: string; page?: number }) {
  const search = new URLSearchParams({ page: String(params?.page ?? 1), limit: '5', ...(params?.bicycleId ? { bicycleId: params.bicycleId } : {}), ...(params?.ownerId ? { ownerId: params.ownerId } : {}) })
  return apiRequest<ApiEnvelope<Registration[]>>(`/registrations?${search}`)
}

export async function createRegistration(data: { bicycleId: string; ownerId: string; clientOperationId: string }) {
  return apiRequest<ApiEnvelope<{ id: string }>>('/registrations', { method: 'POST', body: JSON.stringify(data) })
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export type AgentPermissions = { canRegister?: boolean; canTransfer?: boolean; canFlag?: boolean; canOverride?: boolean }
export type Agent = { id: string; name: string; email: string; phone?: string; isActive: boolean; createdAt: string; permissions: AgentPermissions; _count: { transactions: number } }

export async function getDashboard() {
  return apiRequest<ApiEnvelope<{ bicycles: number; activeAgents: number; transactions: number; flags: number }>>('/admin/dashboard')
}

export async function listAgents(page = 1) {
  return apiRequest<ApiEnvelope<Agent[]>>(`/admin/agents?page=${page}&limit=50`)
}

export async function createAgent(data: { name: string; email: string; phone?: string; password: string }) {
  return apiRequest<ApiEnvelope<Agent>>('/admin/agents', { method: 'POST', body: JSON.stringify(data) })
}

export async function revokeAgent(id: string) {
  return apiRequest<ApiEnvelope<{ id: string; isActive: boolean }>>(`/admin/agents/${id}/revoke`, { method: 'PATCH' })
}

export async function updateAgentPermissions(id: string, permissions: AgentPermissions) {
  return apiRequest<ApiEnvelope<{ id: string; permissions: AgentPermissions }>>(`/admin/agents/${id}/permissions`, { method: 'PATCH', body: JSON.stringify(permissions) })
}

export async function reinstateAgent(id: string) {
  return apiRequest<ApiEnvelope<{ id: string; isActive: boolean }>>(`/admin/agents/${id}/reinstate`, { method: 'PATCH' })
}

export async function listConflicts() {
  return apiRequest<ApiEnvelope<{ id: string; clientOperationId: string; entity: string; payload: unknown; conflictReason?: string; createdAt: string; user: { id: string; name: string; email: string } }[]>>('/admin/conflicts')
}

export async function resolveConflict(id: string, resolution: 'ACCEPT' | 'REJECT', adminNote?: string) {
  return apiRequest<ApiEnvelope<unknown>>(`/admin/conflicts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution, adminNote }) })
}

export async function reviewTransaction(id: string, status: 'REVIEWED' | 'FLAGGED', notes?: string) {
  return apiRequest<ApiEnvelope<unknown>>(`/admin/transactions/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status, notes }) })
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export type AuditLog = { id: string; action: string; entity: string; entityId: string; timestamp: string; metadata?: unknown; user: { id: string; name: string; email: string } }

export async function listAuditLogs(params?: { entity?: string; entityId?: string; userId?: string; action?: string; page?: number }) {
  const search = new URLSearchParams({ page: String(params?.page ?? 1), limit: '20', ...(params?.entity ? { entity: params.entity } : {}), ...(params?.entityId ? { entityId: params.entityId } : {}), ...(params?.userId ? { userId: params.userId } : {}), ...(params?.action ? { action: params.action } : {}) })
  return apiRequest<ApiEnvelope<AuditLog[]>>(`/audit?${search}`)
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export type SyncResult = { clientOperationId: string; status: string; entityId?: string; conflictReason?: string; preserved?: boolean }

export async function syncOperations(operations: unknown[]) {
  return apiRequest<ApiEnvelope<{ results: SyncResult[] }>>('/sync', { method: 'POST', body: JSON.stringify({ operations }) })
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function downloadTransactionDocx(id: string) {
  const token = localStorage.getItem('abatco_token')
  const response = await fetch(`${API_URL}/exports/transactions/${id}/docx`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Export failed')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transaction-${id}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadTransactionsXlsx(params?: { from?: string; to?: string; agentId?: string; type?: string; flagStatus?: string }) {
  const token = localStorage.getItem('abatco_token')
  const search = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][])
  const response = await fetch(`${API_URL}/exports/transactions/xlsx?${search}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Export failed')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadPhoto(file: File): Promise<{ url: string; publicId: string }> {
  const token = localStorage.getItem('abatco_token')
  const form = new FormData()
  form.append('photo', file)
  const response = await fetch(`${API_URL}/uploads/photo`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message ?? 'Upload failed')
  const result = await response.json() as ApiEnvelope<{ url: string; publicId: string }>
  return result.data
}
