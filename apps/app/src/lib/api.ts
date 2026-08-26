const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('abatco_token')
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Request failed')
  return response.json() as Promise<T>
}

export async function login(email: string, password: string) {
  const result = await apiRequest<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  localStorage.setItem('abatco_token', result.token)
  return result
}