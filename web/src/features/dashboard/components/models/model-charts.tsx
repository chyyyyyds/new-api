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
import { Link } from '@tanstack/react-router'
import { VChart } from '@visactor/react-vchart'
import {
  ArrowRight,
  Coins,
  FileText,
  KeyRound,
  PieChart,
  Wallet,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { IconBadge } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from '@/context/theme-provider'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import type {
  DashboardUsageDetails,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import {
  formatCompactNumber,
  formatNumber,
  formatQuota,
  formatTimestampToDate,
} from '@/lib/format'
import { formatChartTime, type TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

const MODEL_COLORS = [
  '#3b82f6',
  '#14b8a6',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
]

interface ModelChartsProps {
  data: QuotaDataItem[]
  details?: DashboardUsageDetails
  loading?: boolean
  detailsLoading?: boolean
  timeGranularity?: TimeGranularity
}

interface QuickActionItem {
  title: string
  description: string
  to: '/keys' | '/usage-logs' | '/wallet'
  icon: typeof KeyRound
  tone: 'info' | 'success' | 'warning'
}

export function ModelCharts(props: ModelChartsProps) {
  const { i18n, t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const timeGranularity = props.timeGranularity ?? DEFAULT_TIME_GRANULARITY
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const details = props.details ?? { models: [], timeline: [] }
  const chartLoading = Boolean(props.loading || props.detailsLoading)

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (module) => module.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    void updateTheme()
  }, [resolvedTheme])

  const totalRequests = useMemo(
    () => details.models.reduce((total, item) => total + item.requests, 0),
    [details.models]
  )
  const totalTokens = useMemo(
    () => details.models.reduce((total, item) => total + item.total_tokens, 0),
    [details.models]
  )

  const modelDistributionSpec = useMemo(
    () => ({
      type: 'pie',
      data: [
        {
          id: 'modelDistribution',
          values: details.models.map((item) => ({
            Model: item.model_name,
            Requests: item.requests,
          })),
        },
      ],
      categoryField: 'Model',
      valueField: 'Requests',
      color: MODEL_COLORS,
      padding: 0,
      outerRadius: 0.95,
      innerRadius: 0.6,
      padAngle: 1.5,
      label: { visible: false },
      legends: { visible: false },
      pie: {
        style: {
          cornerRadius: 5,
          stroke: resolvedTheme === 'dark' ? '#172033' : '#ffffff',
          lineWidth: 2,
        },
      },
      tooltip: {
        mark: {
          content: [
            { key: (datum: Record<string, unknown>) => String(datum.Model) },
            {
              key: t('Requests'),
              value: (datum: Record<string, unknown>) =>
                formatNumber(Number(datum.Requests) || 0, locale),
            },
          ],
        },
      },
      background: 'transparent',
      animation: true,
    }),
    [details.models, locale, resolvedTheme, t]
  )

  const tokenTrendSpec = useMemo(() => {
    const tokenSeries = [
      { key: 'input_tokens', label: t('Input'), color: '#3b82f6' },
      { key: 'output_tokens', label: t('Output'), color: '#10b981' },
      {
        key: 'cache_creation_tokens',
        label: t('Cache Creation'),
        color: '#f59e0b',
      },
      { key: 'cache_read_tokens', label: t('Cache Read'), color: '#06b6d4' },
    ] as const
    const tokenValues = details.timeline.flatMap((item) => {
      const time = formatChartTime(item.timestamp, timeGranularity)
      return tokenSeries.map((series) => ({
        Time: time,
        Series: series.label,
        Tokens: item[series.key],
      }))
    })
    const hitRateLabel = t('Cache Hit Rate')
    const hitRateValues = details.timeline.map((item) => ({
      Time: formatChartTime(item.timestamp, timeGranularity),
      Series: hitRateLabel,
      Rate: item.cache_hit_rate,
    }))

    return {
      type: 'common',
      data: [
        { id: 'tokenSeries', values: tokenValues },
        { id: 'hitRateSeries', values: hitRateValues },
      ],
      series: [
        {
          id: 'tokens',
          type: 'line',
          dataId: 'tokenSeries',
          xField: 'Time',
          yField: 'Tokens',
          seriesField: 'Series',
          color: {
            type: 'ordinal',
            domain: tokenSeries.map((series) => series.label),
            range: tokenSeries.map((series) => series.color),
          },
          line: { style: { lineWidth: 2.5, curveType: 'monotone' } },
          point: { visible: details.timeline.length < 12 },
        },
        {
          id: 'hit-rate',
          type: 'line',
          dataId: 'hitRateSeries',
          xField: 'Time',
          yField: 'Rate',
          seriesField: 'Series',
          color: '#8b5cf6',
          line: {
            style: {
              lineWidth: 2.5,
              lineDash: [7, 5],
              curveType: 'monotone',
            },
          },
          point: { visible: true },
        },
      ],
      axes: [
        { orient: 'bottom', type: 'band' },
        {
          orient: 'left',
          type: 'linear',
          seriesId: ['tokens'],
          label: {
            formatMethod: (value: number) => formatCompactNumber(value, locale),
          },
        },
        {
          orient: 'right',
          type: 'linear',
          seriesId: ['hit-rate'],
          min: 0,
          max: 100,
          label: { formatMethod: (value: number) => `${value}%` },
          grid: { visible: false },
        },
      ],
      legends: { visible: true, orient: 'top', position: 'start' },
      tooltip: {
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) => String(datum.Series),
              value: (datum: Record<string, unknown>) =>
                datum.Series === hitRateLabel
                  ? `${Number(datum.Rate || 0).toFixed(1)}%`
                  : formatNumber(Number(datum.Tokens) || 0, locale),
            },
          ],
        },
      },
      background: 'transparent',
      animation: true,
    }
  }, [details.timeline, locale, t, timeGranularity])

  const recentUsage = useMemo(
    () =>
      [...props.data]
        .filter((item) => item.model_name)
        .sort((left, right) => right.created_at - left.created_at)
        .slice(0, 5),
    [props.data]
  )
  const quickActions = useMemo<QuickActionItem[]>(
    () => [
      {
        title: t('Create API Key'),
        description: t('Create a key for your app or service'),
        to: '/keys',
        icon: KeyRound,
        tone: 'success',
      },
      {
        title: t('Usage Logs'),
        description: t('Inspect requests, errors, and billing details'),
        to: '/usage-logs',
        icon: FileText,
        tone: 'info',
      },
      {
        title: t('Add credits'),
        description: t('Keep enough balance before production traffic'),
        to: '/wallet',
        icon: Wallet,
        tone: 'warning',
      },
    ],
    [t]
  )

  const chartTheme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const hasModelData = !chartLoading && details.models.length > 0
  const hasTimelineData = !chartLoading && details.timeline.length > 0
  let modelChart: ReactNode = (
    <ChartEmptyState title={t('No data available')} icon={PieChart} />
  )
  let trendChart: ReactNode = (
    <ChartEmptyState title={t('No data available')} icon={Coins} />
  )
  let recentUsageContent: ReactNode = (
    <ChartEmptyState title={t('No recent usage')} icon={FileText} />
  )

  if (chartLoading) {
    modelChart = <Skeleton className='h-full w-full rounded-lg' />
    trendChart = <Skeleton className='h-full w-full rounded-lg' />
  } else if (themeReady) {
    if (hasModelData) {
      modelChart = (
        <VChart
          key={`model-distribution-${details.models.length}-${chartTheme}`}
          spec={{ ...modelDistributionSpec, theme: chartTheme }}
          option={VCHART_OPTION}
        />
      )
    }
    if (hasTimelineData) {
      trendChart = (
        <VChart
          key={`token-trend-${details.timeline.length}-${chartTheme}`}
          spec={{ ...tokenTrendSpec, theme: chartTheme }}
          option={VCHART_OPTION}
        />
      )
    }
  }

  if (props.loading) {
    recentUsageContent = (
      <div className='grid gap-2'>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className='h-16 w-full rounded-lg' />
        ))}
      </div>
    )
  } else if (recentUsage.length > 0) {
    recentUsageContent = (
      <div className='grid gap-2'>
        {recentUsage.map((item) => (
          <div
            key={`${item.created_at}-${item.model_name}`}
            className='bg-muted/35 flex min-w-0 items-center gap-3 rounded-lg p-3'
          >
            <IconBadge tone='chart-2' size='md'>
              <Coins />
            </IconBadge>
            <div className='min-w-0 flex-1'>
              <div className='truncate text-sm font-medium'>
                {item.model_name}
              </div>
              <div className='text-muted-foreground truncate text-xs'>
                {formatTimestampToDate(item.created_at)}
              </div>
            </div>
            <div className='shrink-0 text-right'>
              <div className='text-success font-mono text-sm font-semibold tabular-nums'>
                {formatQuota(Number(item.quota) || 0)}
              </div>
              <div className='text-muted-foreground text-xs tabular-nums'>
                {formatNumber(Number(item.token_used) || 0, locale)}{' '}
                {t('Tokens')}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className='grid gap-4'>
      <div className='grid min-w-0 gap-4 xl:grid-cols-2'>
        <Card className='min-w-0 shadow-xs'>
          <CardHeader className='border-b'>
            <CardTitle>{t('Call Count Distribution')}</CardTitle>
            <CardDescription>
              {t('Total:')} {formatNumber(totalRequests, locale)}
            </CardDescription>
          </CardHeader>
          <CardContent className='flex min-h-72 min-w-0 flex-col items-center justify-start gap-4 p-4 sm:flex-row sm:gap-6 sm:p-5'>
            <div className='size-36 shrink-0 sm:size-40'>{modelChart}</div>
            <div className='min-w-0 flex-1 overflow-x-auto'>
              {chartLoading ? (
                <Skeleton className='h-40 w-72 rounded-lg' />
              ) : (
                <table className='w-full max-w-lg text-xs sm:text-sm'>
                  <thead>
                    <tr className='text-muted-foreground border-border/40 border-b text-left text-xs'>
                      <th className='pr-2 pb-2 pl-0 font-medium whitespace-nowrap'>
                        {t('Model')}
                      </th>
                      <th className='px-2 pb-2 text-right font-medium whitespace-nowrap'>
                        {t('Requests')}
                      </th>
                      <th className='px-2 pb-2 text-right font-medium whitespace-nowrap'>
                        Token
                      </th>
                      <th className='px-2 pb-2 text-right font-medium whitespace-nowrap'>
                        {t('Actual')}
                      </th>
                      <th className='pr-0 pb-2 pl-2 text-right font-medium whitespace-nowrap'>
                        {t('Standard')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.models.map((item, index) => (
                      <tr
                        key={item.model_name}
                        className='border-border/30 border-b last:border-0'
                      >
                        <td className='py-2 pr-2 pl-0'>
                          <div className='flex min-w-0 items-center gap-1.5'>
                            <span
                              className='size-2 shrink-0 rounded-full'
                              style={{
                                backgroundColor:
                                  MODEL_COLORS[index % MODEL_COLORS.length],
                              }}
                            />
                            <span className='max-w-[100px] truncate font-medium sm:max-w-[130px] lg:max-w-[160px]'>
                              {item.model_name}
                            </span>
                          </div>
                        </td>
                        <td className='px-2 py-2 text-right font-mono whitespace-nowrap tabular-nums'>
                          {formatNumber(item.requests, locale)}
                        </td>
                        <td className='text-foreground px-2 py-2 text-right font-mono whitespace-nowrap tabular-nums'>
                          {formatCompactNumber(item.total_tokens, locale)}
                        </td>
                        <td className='px-2 py-2 text-right font-mono font-medium whitespace-nowrap text-emerald-600 tabular-nums dark:text-emerald-400'>
                          {formatQuota(item.actual_quota)}
                        </td>
                        <td className='text-muted-foreground py-2 pr-0 pl-2 text-right font-mono whitespace-nowrap tabular-nums'>
                          {formatQuota(item.standard_quota)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className='min-w-0 shadow-xs'>
          <CardHeader className='border-b'>
            <CardTitle>{t('Token Usage Trend')}</CardTitle>
            <CardDescription>
              {t('Total Tokens')}: {formatNumber(totalTokens, locale)}
            </CardDescription>
          </CardHeader>
          <CardContent className='h-80 min-w-0'>{trendChart}</CardContent>
        </Card>
      </div>

      <div className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]'>
        <Card className='min-w-0 shadow-xs'>
          <CardHeader className='border-b'>
            <CardTitle>{t('Usage Logs')}</CardTitle>
            <CardAction>
              <Link
                to='/usage-logs'
                className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors'
              >
                {t('Usage Logs')}
                <ArrowRight className='size-3.5' aria-hidden='true' />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>{recentUsageContent}</CardContent>
        </Card>

        <Card className='shadow-xs'>
          <CardHeader className='border-b'>
            <CardTitle>{t('Quick actions')}</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-2'>
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className='bg-muted/35 hover:bg-muted/70 focus-visible:ring-ring flex items-center gap-3 rounded-lg p-3 transition-colors outline-none focus-visible:ring-2'
              >
                <IconBadge tone={action.tone} size='md'>
                  <action.icon />
                </IconBadge>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>
                    {action.title}
                  </div>
                  <div className='text-muted-foreground truncate text-xs'>
                    {action.description}
                  </div>
                </div>
                <ArrowRight
                  className='text-muted-foreground size-4 shrink-0'
                  aria-hidden='true'
                />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ChartEmptyState({
  title,
  icon: Icon,
}: {
  title: string
  icon: typeof PieChart
}) {
  return (
    <Empty className='h-full border-0'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{title}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
