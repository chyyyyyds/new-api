import {
  BarChart2,
  ChevronDown,
  LayoutGrid,
  LineChart,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface ChannelStatusHeaderProps {
  updatedAtText: string
  isRefreshing: boolean
  onRefresh: () => void
  timeRange: string
  setTimeRange: (val: string) => void
  selectedPlatform: string
  setSelectedPlatform: (val: string) => void
  selectedGroup: string
  setSelectedGroup: (val: string) => void
  selectedModel: string
  setSelectedModel: (val: string) => void
  onResetFilters: () => void
  availablePlatforms: string[]
  availableGroups: string[]
  availableModels: string[]
  viewMode: 'matrix' | 'line'
  setViewMode: (val: 'matrix' | 'line') => void
  metricMode: 'composite' | 'error_rate' | 'ttft' | 'cache'
  setMetricMode: (val: 'composite' | 'error_rate' | 'ttft' | 'cache') => void
  dimensionMode: string
  setDimensionMode: (val: string) => void
}

export function ChannelStatusHeader({
  updatedAtText,
  isRefreshing,
  onRefresh,
  timeRange,
  setTimeRange,
  selectedPlatform,
  setSelectedPlatform,
  selectedGroup,
  setSelectedGroup,
  selectedModel,
  setSelectedModel,
  onResetFilters,
  availablePlatforms,
  availableGroups,
  availableModels,
  viewMode,
  setViewMode,
  metricMode,
  setMetricMode,
  dimensionMode,
  setDimensionMode,
}: ChannelStatusHeaderProps) {
  const { t } = useTranslation()

  const timeRanges = [
    { label: '90m', value: '90m' },
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
  ]

  const metricModes = [
    { label: t('Composite'), value: 'composite' as const },
    { label: t('Error Rate'), value: 'error_rate' as const },
    { label: t('First Token'), value: 'ttft' as const },
    { label: t('Cache Rate'), value: 'cache' as const },
  ]

  return (
    <div className='bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-xs sm:p-6'>
      {/* 顶部标题与更新时间 */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <div className='bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg'>
              <BarChart2 className='size-5' />
            </div>
            <h1 className='text-xl font-bold tracking-tight sm:text-2xl'>
              {t('Channel Monitoring')}
            </h1>
          </div>
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <span className='size-2 animate-pulse rounded-full bg-emerald-500' />
            <span>
              {t('Updated as of')} {updatedAtText}
            </span>
          </div>
        </div>

        <Button
          variant='outline'
          size='icon'
          onClick={onRefresh}
          disabled={isRefreshing}
          className='size-8 shrink-0'
        >
          <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* 筛选与控制栏 */}
      <div className='flex flex-wrap items-center justify-between gap-3 pt-1'>
        {/* 左侧：时间范围选择 + 平台/分组/模型下拉筛选 + 重置 */}
        <div className='flex flex-wrap items-center gap-2'>
          {/* 时间切片按钮组 */}
          <div className='bg-muted/30 inline-flex rounded-lg border p-0.5 text-xs font-medium'>
            {timeRanges.map((tr) => (
              <button
                key={tr.value}
                type='button'
                onClick={() => setTimeRange(tr.value)}
                className={cn(
                  'rounded-md px-2.5 py-1 transition-all',
                  timeRange === tr.value
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tr.label}
              </button>
            ))}
          </div>

          {/* 平台筛选 */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='outline'
                  size='sm'
                  className='h-8 gap-1 text-xs'
                >
                  <span>
                    {t('Platform')}: {selectedPlatform || t('All')}
                  </span>
                  <ChevronDown className='size-3 opacity-60' />
                </Button>
              }
            />
            <DropdownMenuContent
              align='start'
              className='max-h-64 overflow-y-auto'
            >
              <DropdownMenuItem onClick={() => setSelectedPlatform('')}>
                {t('All')}
              </DropdownMenuItem>
              {availablePlatforms.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => setSelectedPlatform(p)}
                >
                  {p}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 分组筛选 */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='outline'
                  size='sm'
                  className='h-8 gap-1 text-xs'
                >
                  <span>
                    {t('Group')}: {selectedGroup || t('All')}
                  </span>
                  <ChevronDown className='size-3 opacity-60' />
                </Button>
              }
            />
            <DropdownMenuContent
              align='start'
              className='max-h-64 overflow-y-auto'
            >
              <DropdownMenuItem onClick={() => setSelectedGroup('')}>
                {t('All')}
              </DropdownMenuItem>
              {availableGroups.map((g) => (
                <DropdownMenuItem key={g} onClick={() => setSelectedGroup(g)}>
                  {g}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 模型筛选 */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='outline'
                  size='sm'
                  className='h-8 gap-1 text-xs'
                >
                  <span>
                    {t('Model')}: {selectedModel || t('All')}
                  </span>
                  <ChevronDown className='size-3 opacity-60' />
                </Button>
              }
            />
            <DropdownMenuContent
              align='start'
              className='max-h-64 overflow-y-auto'
            >
              <DropdownMenuItem onClick={() => setSelectedModel('')}>
                {t('All')}
              </DropdownMenuItem>
              {availableModels.map((m) => (
                <DropdownMenuItem key={m} onClick={() => setSelectedModel(m)}>
                  {m}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 重置筛选 */}
          <Button
            variant='ghost'
            size='sm'
            onClick={onResetFilters}
            className='text-muted-foreground hover:text-foreground h-8 px-2 text-xs'
          >
            <RotateCcw className='mr-1 size-3' />
            <span>{t('Reset')}</span>
          </Button>
        </div>

        {/* 右侧：聚合维度 + 色块矩阵/折线图 + 综合/错误率/首Token/缓存率 */}
        <div className='flex flex-wrap items-center gap-2'>
          {/* 聚合维度下拉 */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='outline'
                  size='sm'
                  className='h-8 gap-1 text-xs'
                >
                  <span>{dimensionMode}</span>
                  <ChevronDown className='size-3 opacity-60' />
                </Button>
              }
            />
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => setDimensionMode('平台 / 分组')}>
                {t('Platform / Group')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDimensionMode('平台')}>
                {t('Platform')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDimensionMode('分组')}>
                {t('Group')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 视图模式切换 */}
          <div className='bg-muted/30 inline-flex rounded-lg border p-0.5 text-xs font-medium'>
            <button
              type='button'
              onClick={() => setViewMode('matrix')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 transition-all',
                viewMode === 'matrix'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutGrid className='size-3.5' />
              <span>{t('Color Matrix')}</span>
            </button>
            <button
              type='button'
              onClick={() => setViewMode('line')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 transition-all',
                viewMode === 'line'
                  ? 'bg-background text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LineChart className='size-3.5' />
              <span>{t('Line Chart')}</span>
            </button>
          </div>

          {/* 指标模式切换 */}
          <div className='bg-muted/30 inline-flex rounded-lg border p-0.5 text-xs font-medium'>
            {metricModes.map((mm) => (
              <button
                key={mm.value}
                type='button'
                onClick={() => setMetricMode(mm.value)}
                className={cn(
                  'rounded-md px-2 py-1 transition-all',
                  metricMode === mm.value
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mm.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
