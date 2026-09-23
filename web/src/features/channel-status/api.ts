import { api } from '@/lib/api'

import type {
  ChannelStatusFilterParams,
  GetChannelStatusResponse,
  UpdateChannelStatusVisibilityParams,
} from './types'

export async function getChannelStatus(
  params?: ChannelStatusFilterParams
): Promise<GetChannelStatusResponse> {
  const res = await api.get<GetChannelStatusResponse>('/api/channels/status', {
    params,
  })
  return res.data
}

export async function updateChannelStatusVisibility(
  params: UpdateChannelStatusVisibilityParams
): Promise<{ success: boolean; message: string }> {
  const res = await api.post<{ success: boolean; message: string }>(
    '/api/channels/status/visibility',
    params
  )
  return res.data
}
