import type { Appointment, PortfolioPost, Service, User } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8080/api'
const TOKEN_KEY = 'marta-nails-token'

type AuthResponse = { token: string; user: User }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível concluir a solicitação.')
  return data as T
}

export const api = {
  async login(email: string, password: string) {
    const data = await request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    localStorage.setItem(TOKEN_KEY, data.token)
    return data.user
  },
  async register(input: { name: string; email: string; phone: string; password: string }) {
    const data = await request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
    localStorage.setItem(TOKEN_KEY, data.token)
    return data.user
  },
  me: () => request<{ user: User }>('/me'),
  services: () => request<{ services: Service[] }>('/services'),
  portfolio: () => request<{ posts: PortfolioPost[] }>('/portfolio'),
  createPortfolioPost: (input: { title: string; caption: string; media_url: string; media_type: 'image' | 'video' }) =>
    request<{ post: { id: number } }>('/portfolio', { method: 'POST', body: JSON.stringify(input) }),
  toggleLike: (id: number) => request<{ liked: boolean; like_count: number }>(`/portfolio/${id}/like`, { method: 'POST' }),
  appointments: () => request<{ appointments: Appointment[] }>('/appointments'),
  notifications: () => request<{ notifications: { id: number; message: string }[] }>('/notifications'),
  createAppointment: (input: { service_id: number; requested_at: string; description: string }) =>
    request<{ appointment: Appointment }>('/appointments', { method: 'POST', body: JSON.stringify(input) }),
  updateAppointment: (id: number, input: { status: string; proposed_at?: string }) =>
    request<{ appointment: Appointment }>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  review: (id: number, input: { rating: number; comment: string }) =>
    request<{ review: { rating: number; comment: string } }>(`/appointments/${id}/review`, { method: 'POST', body: JSON.stringify(input) }),
  logout: () => localStorage.removeItem(TOKEN_KEY),
}
