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
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ModelCharts } from '../model-charts'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@visactor/react-vchart', () => ({
  VChart: ({ spec }: { spec: { type: string; data?: unknown } }) => (
    <div data-testid={`chart-${spec.type}`}>{JSON.stringify(spec.data)}</div>
  ),
}))

vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}))

vi.mock('@/context/theme-customization-provider', () => ({
  useThemeCustomization: () => ({
    customization: { preset: 'default', radius: 'default' },
  }),
}))

vi.mock('@/lib/theme-radius', () => ({
  useThemeRadiusPx: () => 8,
}))

describe('model analytics dashboard layout', () => {
  it('shows model and token charts with recent usage and quick actions', async () => {
    render(
      <ModelCharts
        data={[
          {
            created_at: 1_789_531_200,
            model_name: 'gpt-5.6-sol',
            count: 12,
            token_used: 24_000,
            quota: 8_000,
          },
          {
            created_at: 1_789_617_600,
            model_name: 'claude-sonnet',
            count: 5,
            token_used: 9_000,
            quota: 3_000,
          },
        ]}
        details={{
          models: [
            {
              model_name: 'gpt-5.6-sol',
              requests: 12,
              input_tokens: 10_000,
              output_tokens: 2_000,
              cache_creation_tokens: 1_000,
              cache_read_tokens: 11_000,
              total_tokens: 24_000,
              actual_quota: 8_000,
              standard_quota: 100_000,
            },
            {
              model_name: 'claude-sonnet',
              requests: 5,
              input_tokens: 5_000,
              output_tokens: 1_000,
              cache_creation_tokens: 500,
              cache_read_tokens: 2_500,
              total_tokens: 9_000,
              actual_quota: 3_000,
              standard_quota: 10_000,
            },
          ],
          timeline: [
            {
              timestamp: 1_789_531_200,
              input_tokens: 15_000,
              output_tokens: 3_000,
              cache_creation_tokens: 1_500,
              cache_read_tokens: 13_500,
              cache_hit_rate: 47.37,
            },
          ],
        }}
        timeGranularity='day'
      />
    )

    expect(screen.getByText('Call Count Distribution')).toBeInTheDocument()
    expect(screen.getByText('Token Usage Trend')).toBeInTheDocument()
    expect(screen.getByText('Quick actions')).toBeInTheDocument()
    expect(screen.getAllByText('gpt-5.6-sol')).not.toHaveLength(0)
    expect(screen.getAllByText('claude-sonnet')).not.toHaveLength(0)
    expect(
      screen.getByRole('link', { name: /Create API Key/ })
    ).toHaveAttribute('href', '/keys')
    expect(screen.getByRole('link', { name: /Add credits/ })).toHaveAttribute(
      'href',
      '/wallet'
    )
    expect(screen.queryByText(/Platform Breakdown/i)).not.toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
    expect(screen.getByText('Requests')).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(await screen.findByTestId('chart-pie')).toBeInTheDocument()
    const trendChart = await screen.findByTestId('chart-common')
    expect(trendChart).toHaveTextContent('Input')
    expect(trendChart).toHaveTextContent('Output')
    expect(trendChart).toHaveTextContent('Cache Creation')
    expect(trendChart).toHaveTextContent('Cache Read')
    expect(trendChart).toHaveTextContent('Cache Hit Rate')
  })
})
