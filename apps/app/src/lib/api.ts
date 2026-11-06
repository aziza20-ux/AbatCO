const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

type ApiEnvelope<T> = { data: T }

export function generateSerialNumber(): string {
  const randomValues = new Uint32Array(1)
  crypto.getRandomValues(randomValues)
  const digits = String(randomValues[0] % 100000).padStart(5, '0')
  const letter = String.fromCharCode(65 + (randomValues[0] % 26))
  return `SMN-${digits}-${letter}`
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly retryAfterSeconds?: number, public readonly code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export function formatRetryDuration(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  if (total < 60) return `${total} second${total === 1 ? '' : 's'}`
  const minutes = Math.floor(total / 60)
  const remaining = total % 60
  if (!remaining) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  return `${minutes} minute${minutes === 1 ? '' : 's'} and ${remaining} second${remaining === 1 ? '' : 's'}`
}

function retryAfterSeconds(response: Response, body: unknown): number | undefined {
  const header = response.headers.get('Retry-After')
  const bodyRecord = body && typeof body === 'object' ? body as Record<string, unknown> : null
  const errorRecord = bodyRecord?.error && typeof bodyRecord.error === 'object' ? bodyRecord.error as Record<string, unknown> : null
  const bodyValue = bodyRecord?.retryAfter ?? bodyRecord?.retryAfterSeconds ?? errorRecord?.retryAfter ?? errorRecord?.retryAfterSeconds
  const value = header ?? (typeof bodyValue === 'number' || typeof bodyValue === 'string' ? bodyValue : undefined)
  if (value === undefined) return undefined
  const seconds = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000)
  return Number.isFinite(seconds) ? Math.max(0, seconds) : undefined
}

export function userFacingError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      const seconds = error.retryAfterSeconds ?? Number(error.message.match(/(\d+)\s*seconds?/i)?.[1])
      return Number.isFinite(seconds) ? `Too many requests. Please try again in ${formatRetryDuration(seconds!)}.` : 'Too many requests. Please try again later.'
    }
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You are not authorized to perform this action.'
    if (error.status === 404) return 'The requested record was not found.'
    if (error.status === 409) return error.message || 'This operation conflicts with a newer change.'
    if (error.status >= 500) return 'The server is temporarily unavailable. Please try again later.'
    return error.message || fallback
  }
  if (error instanceof TypeError || (error && typeof error === 'object' && 'isNetworkError' in error)) return 'Network unavailable. Your changes remain local and will sync when connection returns.'
  return fallback
}

let refreshPromise: Promise<void> | null = null

async function silentRefresh(): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let result: Response
  try {
    result = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include', signal: controller.signal })
  } catch {
    // Network failure or timeout — do NOT clear the token
    throw Object.assign(new Error('Network error during refresh'), { isNetworkError: true })
  } finally {
    clearTimeout(timeout)
  }
  if (result.status === 401) { localStorage.removeItem('abatco_token'); throw new Error('Session expired') }
  if (!result.ok) throw Object.assign(new Error('Refresh server error'), { isNetworkError: true })
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
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } | string } | null
  if (!response.ok) {
    const errorValue = body?.error
    const message = typeof errorValue === 'string' ? errorValue : errorValue?.message
    throw new ApiError(response.status, message ?? 'Request failed', retryAfterSeconds(response, body), typeof errorValue === 'object' ? errorValue?.code : undefined)
  }
  return body as T
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

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<void>('/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) })
}

export async function forgotPassword(email: string) {
  return apiRequest<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  return apiRequest<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) })
}

export async function logout() {
  await apiRequest<void>('/auth/logout', { method: 'POST' })
  localStorage.removeItem('abatco_token')
}

// ── People ────────────────────────────────────────────────────────────────────

export type Person = { id: string; name: string; nationalId: string; phone?: string; cell?: string; address?: string; sector?: string; village?: string; nationalIdPhotoUrl?: string }

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

export async function updateBicycle(id: string, data: { frameNumber?: string; brand?: string; model?: string; color?: string; distinguishingFeatures?: string; status?: string; currentOwnerId?: string }) {
  return apiRequest<ApiEnvelope<Bicycle>>(`/bicycles/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type PersonSummary = { id: string; name: string; nationalId?: string; phone?: string; cell?: string; sector?: string; village?: string; nationalIdPhotoUrl?: string }
export type Transaction = { id: string; transactionId: string; type: 'SALE' | 'TRANSFER'; price?: number; serviceFee?: number; reason?: string; location?: string; transactionDate: string; flagStatus: string; flagReason?: string; agentNote?: string; adminReviewNotes?: string; ownershipStatus: 'ACTIVE' | 'HISTORICAL'; bicycle: { id: string; frameNumber: string; brand?: string; model?: string; color?: string; distinguishingFeatures?: string }; seller?: PersonSummary; buyer?: PersonSummary; recordingAgent: { id: string; name: string } }

export async function listTransactions(params?: { q?: string; flagStatus?: string; type?: string; agentId?: string; personId?: string; page?: number }) {
  const search = new URLSearchParams({ page: String(params?.page ?? 1), limit: '5', ...(params?.q ? { q: params.q } : {}), ...(params?.flagStatus ? { flagStatus: params.flagStatus } : {}), ...(params?.type ? { type: params.type } : {}), ...(params?.agentId ? { agentId: params.agentId } : {}), ...(params?.personId ? { personId: params.personId } : {}) })
  return apiRequest<ApiEnvelope<Transaction[]>>(`/transactions?${search}`)
}

export async function getTransaction(id: string) {
  return apiRequest<ApiEnvelope<Transaction>>(`/transactions/${id}`)
}

export async function createTransaction(data: object, clientOperationId: string) {
  return apiRequest<ApiEnvelope<Transaction>>('/transactions', { method: 'POST', body: JSON.stringify(data), headers: { 'x-client-operation-id': clientOperationId } })
}

export async function editTransaction(id: string, data: { price?: number; serviceFee?: number; reason?: string | null; location?: string | null; bicycle: { id: string; frameNumber: string; brand?: string | null; model?: string | null; color?: string | null; distinguishingFeatures?: string | null }; seller: PersonEdit | null; buyer: PersonEdit | null }) {
  return apiRequest<ApiEnvelope<Transaction>>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteTransaction(id: string) {
  return apiRequest<void>(`/transactions/${id}`, { method: 'DELETE' })
}

type PersonEdit = { id: string; name: string; nationalId: string; phone?: string | null; cell?: string | null; sector?: string | null; village?: string | null; nationalIdPhotoUrl?: string | null }

export async function flagTransaction(id: string, flagReason?: string) {
  return apiRequest<ApiEnvelope<Transaction>>(`/transactions/${id}/flag`, { method: 'PATCH', body: JSON.stringify({ flagReason }) })
}

export async function agentReviewTransaction(id: string) {
  return apiRequest<ApiEnvelope<Transaction>>(`/transactions/${id}/review`, { method: 'PATCH', body: JSON.stringify({}) })
}

// ── Registrations ─────────────────────────────────────────────────────────────

export type Registration = { id: string; bicycleId: string; ownerId: string; createdAt: string; bicycle: { id: string; frameNumber: string; brand?: string; model?: string }; owner: PersonSummary & { nationalId: string }; recordingAgent: { id: string; name: string } }

export async function listRegistrations(params?: { bicycleId?: string; ownerId?: string; page?: number }) {
  const search = new URLSearchParams({ page: String(params?.page ?? 1), limit: '5', ...(params?.bicycleId ? { bicycleId: params.bicycleId } : {}), ...(params?.ownerId ? { ownerId: params.ownerId } : {}) })
  return apiRequest<ApiEnvelope<Registration[]>>(`/registrations?${search}`)
}

export async function getRegistration(id: string) {
  return apiRequest<ApiEnvelope<Registration>>(`/registrations/${id}`)
}

export async function createRegistration(data: { bicycleId: string; ownerId: string; clientOperationId: string }) {
  return apiRequest<ApiEnvelope<{ id: string }>>('/registrations', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateRegistration(id: string, data: { bicycleId?: string; ownerId?: string }) {
  return apiRequest<ApiEnvelope<Registration>>(`/registrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteRegistration(id: string) {
  return apiRequest<void>(`/registrations/${id}`, { method: 'DELETE' })
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export type AgentPermissions = { canRegister?: boolean; canTransfer?: boolean; canFlag?: boolean; canOverride?: boolean }
export type Agent = { id: string; name: string; email: string; phone?: string; isActive: boolean; createdAt: string; permissions: AgentPermissions; _count: { transactions: number } }

export async function getDashboard(params?: { dateFilter?: 'all' | 'today' | 'last30days' | 'specific' | 'range'; date?: string; startDate?: string; endDate?: string }) {
  const search = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v != null) as [string, string][])
  const qs = search.toString() ? `?${search}` : ''
  return apiRequest<ApiEnvelope<{ bicycles: number; activeAgents: number; transactions: number; flags: number; totalBicyclePrice: number; totalServiceFee: number }>>(`/admin/dashboard${qs}`)
}

export async function listAgents(page = 1) {
  return apiRequest<ApiEnvelope<Agent[]>>(`/admin/agents?page=${page}&limit=50`)
}

export async function createAgent(data: { name: string; email: string; phone?: string; password: string }) {
  return apiRequest<ApiEnvelope<Agent>>('/admin/agents', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateAgent(id: string, data: { name?: string; email?: string; phone?: string }) {
  return apiRequest<ApiEnvelope<Agent>>(`/admin/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
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

export async function uploadPhoto(file: File, folder?: 'national-ids'): Promise<{ url: string; publicId: string }> {
  const token = localStorage.getItem('abatco_token')
  const form = new FormData()
  form.append('photo', file)
  const qs = folder ? `?folder=${folder}` : ''
  const response = await fetch(`${API_URL}/uploads/photo${qs}`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message ?? 'Upload failed')
  const result = await response.json() as ApiEnvelope<{ url: string; publicId: string }>
  return result.data
}
