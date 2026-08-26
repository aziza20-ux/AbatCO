const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

type ApiEnvelope<T> = { data: T }

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('abatco_token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Request failed')
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function login(email: string, password: string) {
  const result = await apiRequest<ApiEnvelope<{ token: string; user: { id: string; name: string; role: 'ADMIN' | 'AGENT' } }>>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  localStorage.setItem('abatco_token', result.data.token)
  return result.data
}

export async function refreshAccessToken() {
  const result = await apiRequest<ApiEnvelope<{ token: string }>>('/auth/refresh', { method: 'POST' })
  localStorage.setItem('abatco_token', result.data.token)
  return result.data
}

export async function logout() {
  await apiRequest<void>('/auth/logout', { method: 'POST' })
  localStorage.removeItem('abatco_token')
}

export async function syncOperations(operations: unknown[]) {
  return apiRequest<ApiEnvelope<{ results: unknown[] }>>('/sync', { method: 'POST', body: JSON.stringify({ operations }) })
}