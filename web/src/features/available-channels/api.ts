import { api } from '@/lib/api'

import type { GetAvailableChannelsResponse } from './types'

export async function getAvailableChannels(): Promise<GetAvailableChannelsResponse> {
  const res = await api.get<GetAvailableChannelsResponse>(
    '/api/channels/available'
  )
  return res.data
}
