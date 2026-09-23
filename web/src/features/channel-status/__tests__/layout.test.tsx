/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { getChannelStatus } from '../api'
import { ChannelStatus } from '../index'

vi.mock('../api', () => ({
  getChannelStatus: vi.fn(),
  updateChannelStatusVisibility: vi.fn(),
}))

describe('channel status layout', () => {
  it('保留渠道可用性矩阵但不渲染模型明细表', async () => {
    vi.mocked(getChannelStatus).mockResolvedValue({
      success: true,
      data: {
        updated_at: 1_789_920_000,
        success_rate: 98.5,
        error_rate: 1.5,
        ttft_p50: 1.2,
        ttft_avg: 2.4,
        ttft_p90: 5.1,
        cache_rate: 20,
        channels: [
          {
            dimension_key: 'test / default 1x',
            platform: 'Test',
            group_name: 'default',
            group_ratio: 1,
            success_rate: 98.5,
            first_token: 1.2,
            cache_rate: 20,
            buckets: [],
          },
        ],
        models: [
          {
            platform: 'test',
            model_name: 'hidden-model',
            success_rate: 100,
            error_rate: 0,
            ttft_p50: 0.8,
            ttft_avg: 1.2,
            ttft_p90: 2.5,
            cache_rate: 0,
          },
        ],
      },
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <ChannelStatus />
      </QueryClientProvider>
    )

    expect(await screen.findByText('test / default 1x')).toBeVisible()
    expect(screen.queryByText('Platform / Model')).not.toBeInTheDocument()
    expect(screen.queryByText('hidden-model')).not.toBeInTheDocument()
  })
})
