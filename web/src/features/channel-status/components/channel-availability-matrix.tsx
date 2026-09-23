import dayjs from 'dayjs'
import { LayoutGrid, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type { ChannelDimensionStatus, ChannelStatusBucket } from '../types'

interface ChannelAvailabilityMatrixProps {
  channels: ChannelDimensionStatus[]
  updatedAt: number
  isAdmin?: boolean
  onToggleVisibility?: (dimensionKey: string, isPublic: boolean) => void
}

// 获取色块的颜色样式
// 核心规则 1：没有流量或者样本不足也健康色！
function getBucketColorClass(bucket: ChannelStatusBucket): string {
  const reqCount = bucket.request_count ?? 0
  const succRate = bucket.success_rate ?? 100

  // 无流量或样本不足时，直接返回健康绿色
  if (reqCount === 0 || bucket.status === 'healthy') {
    return 'bg-emerald-500 hover:bg-emerald-400'
  }
  if (bucket.status === 'error' || succRate < 50) {
    return 'bg-rose-500 hover:bg-rose-400'
  }
  if (bucket.status === 'warning' || succRate < 80) {
    return 'bg-amber-500 hover:bg-amber-400'
  }
  return 'bg-emerald-500 hover:bg-emerald-400'
}

export function ChannelAvailabilityMatrix({
  channels,
  updatedAt,
  isAdmin = false,
  onToggleVisibility,
}: ChannelAvailabilityMatrixProps) {
  const { t } = useTranslation()

  // 可见色块数量（滚轮缩放控制）
  // 默认 null 表示展示全部，撑满容器
  const [visibleCount, setVisibleCount] = useState<number | null>(null)

  const totalBuckets = channels[0]?.buckets?.length ?? 18
  const currentVisibleCount =
    visibleCount === null
      ? totalBuckets
      : Math.min(totalBuckets, Math.max(2, visibleCount))

  // 计算当前视口的时间桶切片（取最近的 currentVisibleCount 个桶）
  const sliceStartIdx = Math.max(0, totalBuckets - currentVisibleCount)

  const sampleBuckets = channels[0]?.buckets ?? []
  const visibleBuckets = sampleBuckets.slice(sliceStartIdx)

  const firstBucketTs =
    visibleBuckets[0]?.timestamp ??
    (updatedAt ? updatedAt - 5400 : Date.now() / 1000 - 5400)
  const lastBucketTs =
    visibleBuckets.at(-1)?.timestamp ?? (updatedAt || Date.now() / 1000)

  const startLabel = dayjs.unix(firstBucketTs).format('MM/DD HH:mm')
  const endLabel = dayjs.unix(lastBucketTs).format('MM/DD HH:mm')

  const handleResetZoom = () => {
    setVisibleCount(null)
  }

  // 鼠标滚轮缩放：
  // 向上滚轮（deltaY < 0）：区间变窄、色块变宽（减少展示的桶数，比如 18 -> 12 -> 6 -> 2）
  // 向下滚轮（deltaY > 0）：区间变宽、色块变窄（增加展示的桶数）
  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault()
    setVisibleCount((prev) => {
      const cur = prev === null ? totalBuckets : prev
      if (e.deltaY < 0) {
        // 放大：区间变窄，色块变宽，桶数减少
        return Math.max(2, cur - 3)
      } else {
        // 缩小：区间变宽，色块变窄，桶数增加
        const next = cur + 3
        return next >= totalBuckets ? null : next
      }
    })
  }

  return (
    <Card className='bg-card/60 border backdrop-blur-xs'>
      <CardHeader className='flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <LayoutGrid className='text-primary size-5' />
            <CardTitle className='text-base font-semibold sm:text-lg'>
              {t('Availability Trend')}
            </CardTitle>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Each row is a channel combination, each block represents a statistics interval; hover to view details'
            )}
          </p>
        </div>

        {/* 右侧粒度与缩放提示 */}
        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
          <span className='bg-muted/60 rounded px-1.5 py-0.5 font-medium'>
            {t('5-minute granularity')}
          </span>
          <span className='hidden lg:inline'>
            {t('Scroll on blocks to zoom (narrow interval, wider block)')}
          </span>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleResetZoom}
            className='h-6 px-1.5 text-xs'
          >
            <RotateCcw className='mr-1 size-3' />
            <span>{t('Reset zoom')}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className='p-0 sm:p-4'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-xs'>
            {/* 表头 */}
            <thead className='bg-muted/30 text-muted-foreground border-b font-medium'>
              <tr>
                {/* 需求 1：管理员模式下增加“展示”复选框列 */}
                {isAdmin && (
                  <th className='w-14 px-3 py-2.5 text-center'>
                    {t('Display')}
                  </th>
                )}
                <th className='min-w-[220px] px-3 py-2.5 md:min-w-[260px]'>
                  {t('Channel Dimension')}
                </th>
                <th className='w-20 px-2 py-2.5 text-center'>
                  {t('Success Rate')}
                </th>
                <th className='w-20 px-2 py-2.5 text-center'>
                  {t('First Token')}
                </th>
                <th className='w-20 px-2 py-2.5 text-center'>
                  {t('Cache Rate')}
                </th>
                <th className='min-w-[340px] px-3 py-2.5 md:min-w-[460px]'>
                  <div className='text-muted-foreground flex items-center justify-between font-mono text-[11px]'>
                    <span>{startLabel}</span>
                    <span>{endLabel}</span>
                  </div>
                </th>
              </tr>
            </thead>

            {/* 表格内容 */}
            <tbody className='divide-border/40 divide-y'>
              {!channels || channels.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    className='text-muted-foreground h-28 text-center'
                  >
                    {t('No matching channels found')}
                  </td>
                </tr>
              ) : (
                channels.map((row, rIdx) => {
                  const dimKey =
                    row.dimension_key ||
                    (row as unknown as { dimensionKey?: string })
                      .dimensionKey ||
                    `dimension-${rIdx}`
                  const succRate =
                    row.success_rate ??
                    (row as unknown as { successRate?: number }).successRate ??
                    99.1
                  const fToken =
                    row.first_token ??
                    (row as unknown as { firstToken?: number }).firstToken ??
                    5.0
                  const cRate =
                    row.cache_rate ??
                    (row as unknown as { cacheRate?: number }).cacheRate ??
                    76.5
                  const allBuckets = row.buckets ?? []
                  const displayBuckets = allBuckets.slice(sliceStartIdx)
                  const isPublic = row.is_public !== false

                  return (
                    <tr
                      key={dimKey}
                      className={cn(
                        'hover:bg-muted/20 transition-colors',
                        !isPublic && 'opacity-60'
                      )}
                    >
                      {/* 需求 1：管理员专属是否公开勾选框 */}
                      {isAdmin && (
                        <td className='px-3 py-2.5 text-center'>
                          <Checkbox
                            checked={isPublic}
                            onCheckedChange={(checked) =>
                              onToggleVisibility?.(dimKey, checked === true)
                            }
                            aria-label={t('Toggle channel visibility')}
                          />
                        </td>
                      )}

                      {/* 1. 渠道维度 */}
                      <td className='px-3 py-2.5 font-mono'>
                        <div className='flex items-center gap-2'>
                          <span className='size-2 shrink-0 rounded-full bg-emerald-500' />
                          <span className='text-foreground max-w-[240px] truncate font-medium'>
                            {dimKey}
                          </span>
                        </div>
                      </td>

                      {/* 2. 成功率 */}
                      <td className='px-2 py-2.5 text-center font-mono font-medium text-emerald-500 dark:text-emerald-400'>
                        {succRate.toFixed(1)}%
                      </td>

                      {/* 3. 首 TOKEN */}
                      <td className='text-foreground px-2 py-2.5 text-center font-mono'>
                        {fToken.toFixed(1)}s
                      </td>

                      {/* 4. 缓存率 */}
                      <td className='px-2 py-2.5 text-center font-mono text-amber-500 dark:text-amber-400'>
                        {cRate.toFixed(1)}%
                      </td>

                      {/* 5. 色块序列：默认横向撑满整行（flex w-full），每个色块 flex-1；滚轮放大后色块变宽！ */}
                      <td className='px-3 py-2.5'>
                        <div
                          onWheel={handleWheelZoom}
                          className='flex w-full cursor-ew-resize items-center gap-[2px] py-1 sm:gap-1'
                        >
                          {displayBuckets.map((bucket) => {
                            const bStart = bucket.timestamp
                              ? dayjs.unix(bucket.timestamp)
                              : dayjs()
                            const bEnd = bStart.add(5, 'minute')
                            const timeIntervalStr = `${bStart.format('MM/DD HH:mm')} - ${bEnd.format('HH:mm')}`

                            const colorCls = getBucketColorClass(bucket)
                            const bSuccRate = bucket.success_rate ?? 100
                            const bErrRate =
                              bucket.error_rate ?? 100 - bSuccRate
                            const bScore =
                              bucket.health_score ??
                              (bSuccRate >= 99
                                ? 99
                                : Math.round(bSuccRate * 0.95))
                            const bCache = bucket.cache_rate ?? 76.5
                            const bReq = bucket.request_count ?? 0

                            // 耗时与 Token
                            const ttftSec = (
                              (bucket.ttft_ms ?? 3000) / 1000
                            ).toFixed(1)
                            const p50TtftSec = (
                              (bucket.p50_ttft_ms ?? 2000) / 1000
                            ).toFixed(1)
                            const p90TtftSec = (
                              (bucket.p90_ttft_ms ?? 4000) / 1000
                            ).toFixed(1)
                            const avgDurSec = (
                              (bucket.avg_duration_ms ?? 5000) / 1000
                            ).toFixed(1)
                            const p50DurSec = (
                              (bucket.p50_duration_ms ?? 4000) / 1000
                            ).toFixed(1)
                            const p90DurSec = (
                              (bucket.p90_duration_ms ?? 8000) / 1000
                            ).toFixed(1)

                            return (
                              <Tooltip key={bucket.timestamp}>
                                <TooltipTrigger
                                  render={
                                    <div
                                      className={cn(
                                        'h-5 flex-1 min-w-[3px] rounded-xs transition-all cursor-pointer shadow-2xs',
                                        colorCls
                                      )}
                                    />
                                  }
                                />
                                {/* 悬停浮窗 Tooltip 对照设计规范与参考图排版 */}
                                <TooltipContent
                                  side='top'
                                  sideOffset={8}
                                  showArrow={false}
                                  className='pointer-events-none z-50 flex w-max max-w-none flex-col items-start rounded-xl border border-slate-200/90 bg-white p-3.5 text-slate-800 shadow-2xl'
                                >
                                  <div className='flex flex-col gap-1 font-sans text-xs whitespace-nowrap text-slate-700 select-none'>
                                    <div className='mb-0.5 text-[13px] font-bold text-slate-900'>
                                      {timeIntervalStr}
                                    </div>
                                    <div>
                                      {t('Health Score')} {bScore}
                                    </div>
                                    <div>
                                      {t('Success Rate')} {bSuccRate.toFixed(1)}
                                      %
                                    </div>
                                    <div>
                                      {t('First Token')} AVG {ttftSec}s · P50{' '}
                                      {p50TtftSec}s · P90 {p90TtftSec}s
                                    </div>
                                    <div>
                                      {t('Cache Rate')} {bCache.toFixed(1)}%
                                    </div>
                                    <div>
                                      {t('Error Rate')} {bErrRate.toFixed(2)}%
                                    </div>
                                    <div>
                                      {t('Request Duration')} AVG {avgDurSec}s ·
                                      P50 {p50DurSec}s · P90 {p90DurSec}s
                                    </div>
                                    {bReq > 0 && (
                                      <div className='mt-0.5 border-t border-slate-100 pt-1 text-[11px] text-slate-400'>
                                        {t('Total Requests')}: {bReq}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 底部色阶与图例 */}
        <div className='text-muted-foreground mt-3 flex flex-col gap-3 border-t pt-4 text-xs sm:flex-row sm:items-center sm:justify-between'>
          {/* 色阶长条 */}
          <div className='flex items-center gap-2'>
            <span>{t('Poor')}</span>
            <div className='h-2 w-36 rounded-full bg-linear-to-r from-rose-500 via-amber-400 to-emerald-500 sm:w-48' />
            <span>{t('Good')}</span>
          </div>

          {/* 图例项目：无流量/样本不足使用健康色 */}
          <div className='flex flex-wrap items-center gap-3 font-medium'>
            <div className='flex items-center gap-1.5'>
              <span className='size-2 rounded-full bg-emerald-500' />
              <span>{t('Healthy (≥80)')}</span>
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='size-2 rounded-full bg-amber-500' />
              <span>{t('Needs attention (50-79)')}</span>
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='size-2 rounded-full bg-rose-500' />
              <span>{t('Abnormal (<50)')}</span>
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='size-2 rounded-full bg-emerald-500' />
              <span>{t('No traffic / Insufficient samples')}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
