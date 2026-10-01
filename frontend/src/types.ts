export type User = {
  id: number
  name: string
  email: string
  phone: string
  role: 'client' | 'manicure'
}

export type Service = {
  id: number
  name: string
  description: string
  duration_minutes: number
  price_cents: number | null
}

export type Appointment = {
  id: number
  client_id: number
  client_name?: string
  client_phone?: string
  service_id: number
  service_name: string
  requested_at: string
  confirmed_at: string | null
  proposed_at: string | null
  description: string
  status: 'pending' | 'approved' | 'alternative_proposed' | 'rejected' | 'completed' | 'cancelled'
  review?: { rating: number; comment: string } | null
}

export type PortfolioPost = {
  id: number
  title: string
  caption: string
  media_url: string
  media_type: 'image' | 'video'
  like_count: number
  liked_by_me: boolean
}
