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
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Coins,
  Gauge,
  Hash,
  KeyRound,
  Layers,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserQuotaDates } from '@/features/dashboard/api'
import {
  buildQueryParams,
  calculateDashboardStats,
  getDefaultDays,
  safeDivide,
} from '@/features/dashboard/lib'
import type {
  DashboardFilters,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { getApiKeys } from '@/features/keys/api'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { computeTimeRange } from '@/lib/time'
import { useAuthStore } from '@/stores/auth-store'

interface LogStatCardsProps {
  filters?: DashboardFilters
  onDataUpdate?: (data: QuotaDataItem[], loading: boolean) => void
}

interface DashboardStatCard {
  key: string
  title: string
  description: string
  value: number
  format: 'number' | 'quota'
  icon: LucideIcon
  tone: IconBadgeTone
  loading?: boolean
}

const MAX_INLINE_STAT_CHARS = 9

function formatStatNumber(value: number, locale: Intl.LocalesArgument) {
  const fullValue = formatNumber(value, locale)
  const displayValue =
    fullValue.length > MAX_INLINE_STAT_CHARS
      ? formatCompactNumber(value, locale)
      : fullValue

  return { displayValue, fullValue }
}

export function LogStatCards(props: LogStatCardsProps) {
  const { i18n, t } = useTranslation()
  const { filters, onDataUpdate } = props
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= 10)
  const [stats, setStats] = useState<{
    totalQuota: number
    totalCount: number
    totalTokens: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [timeRangeMinutes, setTimeRangeMinutes] = useState(0)

  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'analytics', 'api-keys'],
    queryFn: async () => {
      const result = requireServerSuccess(await getApiKeys({ p: 1, size: 100 }))
      return result.data?.items ?? []
    },
    staleTime: 60 * 1000,
  })

  useEffect(() => {
    const abortController = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(false)
    onDataUpdate?.([], true)

    const timeRange = computeTimeRange(
      getDefaultDays(filters?.time_granularity),
      filters?.start_timestamp,
      filters?.end_timestamp
    )
    setTimeRangeMinutes(
      (timeRange.end_timestamp - timeRange.start_timestamp) / 60
    )

    void getUserQuotaDates(buildQueryParams(timeRange, filters), isAdmin)
      .then((response) => {
        if (abortController.signal.aborted) return
        const data = response.data ?? []
        setStats(calculateDashboardStats(data))
        onDataUpdate?.(data, false)
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setStats(null)
        setError(true)
        onDataUpdate?.([], false)
      })
      .finally(() => {
        if (!abortController.signal.aborted) setLoading(false)
      })

    return () => abortController.abort()
  }, [filters, isAdmin, onDataUpdate])

  const enabledApiKeys = (apiKeysQuery.data ?? []).filter(
    (item) => item.status === 1
  ).length
  const totalCount = stats?.totalCount ?? 0
  const totalTokens = stats?.totalTokens ?? 0
  const cards: DashboardStatCard[] = [
    {
      key: 'balance',
      title: t('Balance'),
      description: t('Available'),
      value: Number(user?.quota ?? 0),
      format: 'quota',
      icon: Wallet,
      tone: 'success',
    },
    {
      key: 'api-keys',
      title: t('API Keys'),
      description: t('Enabled'),
      value: enabledApiKeys,
      format: 'number',
      icon: KeyRound,
      tone: 'info',
      loading: apiKeysQuery.isLoading,
    },
    {
      key: 'requests',
      title: t('Requests'),
      description: t('Statistical count'),
      value: totalCount,
      format: 'number',
      icon: Hash,
      tone: 'chart-1',
    },
    {
      key: 'usage',
      title: t('Usage'),
      description: t('Statistical quota'),
      value: stats?.totalQuota ?? 0,
      format: 'quota',
      icon: Coins,
      tone: 'chart-4',
    },
    {
      key: 'tokens',
      title: t('Tokens'),
      description: t('Statistical tokens'),
      value: totalTokens,
      format: 'number',
      icon: Layers,
      tone: 'warning',
    },
    {
      key: 'all-time-requests',
      title: t('Request Count'),
      description: t('Total requests made'),
      value: Number(user?.request_count ?? 0),
      format: 'number',
      icon: Activity,
      tone: 'chart-3',
    },
    {
      key: 'average-rpm',
      title: t('Average RPM'),
      description: t('Requests per minute'),
      value: safeDivide(totalCount, timeRangeMinutes || 1),
      format: 'number',
      icon: Gauge,
      tone: 'chart-2',
    },
    {
      key: 'average-tpm',
      title: t('Average TPM'),
      description: t('Tokens per minute'),
      value: safeDivide(totalTokens, timeRangeMinutes || 1),
      format: 'number',
      icon: Zap,
      tone: 'warning',
    },
  ]
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return (
    <div className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      {cards.map((card) => {
        const formatted =
          card.format === 'quota'
            ? {
                displayValue: formatQuota(card.value),
                fullValue: formatQuota(card.value),
              }
            : formatStatNumber(card.value, locale)
        const isLoading = loading || card.loading

        return (
          <Card key={card.key} size='sm' className='min-h-28 shadow-xs'>
            <CardContent className='flex items-center gap-3'>
              <IconBadge tone={card.tone} size='lg'>
                <card.icon />
              </IconBadge>
              <div className='min-w-0 flex-1'>
                <div className='text-muted-foreground truncate text-xs font-medium'>
                  {card.title}
                </div>
                {isLoading ? (
                  <Skeleton className='mt-2 h-7 w-24' />
                ) : (
                  <div
                    className='mt-1 truncate font-mono text-2xl font-semibold tracking-tight tabular-nums'
                    title={formatted.fullValue}
                  >
                    {error && card.key !== 'balance' && card.key !== 'api-keys'
                      ? '--'
                      : formatted.displayValue}
                  </div>
                )}
                <div className='text-muted-foreground mt-1 truncate text-xs'>
                  {card.description}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
