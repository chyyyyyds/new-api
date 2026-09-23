export interface ChannelStatusBucket {
  timestamp: number
  status: 'healthy' | 'warning' | 'error'
  success_rate: number
  request_count: number
  ttft_ms: number
  cache_rate: number
  error_rate?: number
  health_score?: number
  avg_duration_ms?: number
  p50_duration_ms?: number
  p90_duration_ms?: number
  p50_ttft_ms?: number
  p90_ttft_ms?: number
}

export interface ChannelDimensionStatus {
  dimension_key: string
  platform: string
  group_name: string
  group_ratio: number
  success_rate: number
  first_token: number
  cache_rate: number
  is_public?: boolean
  buckets: ChannelStatusBucket[]
}

export interface ChannelModelStatus {
  platform: string
  model_name: string
  success_rate: number
  error_rate: number
  ttft_p50: number
  ttft_avg: number
  ttft_p90: number
  cache_rate: number
}

export interface ChannelStatusOverview {
  updated_at: number
  success_rate: number
  error_rate: number
  ttft_p50: number
  ttft_avg: number
  ttft_p90: number
  cache_rate: number
  is_admin?: boolean
  channels: ChannelDimensionStatus[]
  models: ChannelModelStatus[]
}

export interface GetChannelStatusResponse {
  success: boolean
  message?: string
  data: ChannelStatusOverview
}

export interface ChannelStatusFilterParams {
  time_range?: string
  platform?: string
  group?: string
  model?: string
}

export interface UpdateChannelStatusVisibilityParams {
  public_dimensions: string[]
}
