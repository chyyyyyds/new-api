import { useQuery } from '@tanstack/react-query'
import {
  Check,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { getAvailableChannels } from './api'
import type { AvailableChannelPlatform } from './types'

interface PlatformTheme {
  iconKey: string
  platformBadge: string
  groupBadge: string
  groupRatioBadge: string
  modelTag: string
  modelIconKey: string
}

// 依据平台名称提供高度一致的专属高亮色彩主题与图标
function getPlatformTheme(platform: string): PlatformTheme {
  const p = platform.toLowerCase()
  if (p.includes('anthropic') || p.includes('claude')) {
    return {
      iconKey: 'Claude',
      platformBadge:
        'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      groupBadge:
        'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300',
      groupRatioBadge:
        'bg-amber-400 text-amber-950 font-bold dark:bg-amber-400 dark:text-black',
      modelTag:
        'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/70',
      modelIconKey: 'Claude',
    }
  }
  if (p.includes('openai') || p.includes('gpt')) {
    return {
      iconKey: 'OpenAI',
      platformBadge:
        'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      groupBadge:
        'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
      groupRatioBadge:
        'bg-emerald-500 text-black font-bold dark:bg-emerald-400 dark:text-black',
      modelTag:
        'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-500/70',
      modelIconKey: 'OpenAI',
    }
  }
  if (p.includes('grok') || p.includes('xai')) {
    return {
      iconKey: 'XAI',
      platformBadge:
        'border-zinc-500/50 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
      groupBadge:
        'border-zinc-500/40 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-800 dark:text-zinc-200',
      groupRatioBadge:
        'bg-zinc-600 text-zinc-100 font-bold dark:bg-zinc-600 dark:text-zinc-100',
      modelTag:
        'border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-500/25 hover:border-zinc-500/70',
      modelIconKey: 'XAI',
    }
  }
  if (p.includes('gemini') || p.includes('google')) {
    return {
      iconKey: 'Gemini',
      platformBadge:
        'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400',
      groupBadge:
        'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300',
      groupRatioBadge:
        'bg-blue-500 text-white font-bold dark:bg-blue-400 dark:text-black',
      modelTag:
        'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25 hover:border-blue-500/70',
      modelIconKey: 'Gemini',
    }
  }
  if (p.includes('deepseek')) {
    return {
      iconKey: 'DeepSeek',
      platformBadge:
        'border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      groupBadge:
        'border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300',
      groupRatioBadge:
        'bg-cyan-500 text-black font-bold dark:bg-cyan-400 dark:text-black',
      modelTag:
        'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 hover:border-cyan-500/70',
      modelIconKey: 'DeepSeek',
    }
  }
  if (p.includes('midjourney')) {
    return {
      iconKey: 'Midjourney',
      platformBadge:
        'border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
      groupBadge:
        'border-fuchsia-500/40 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300',
      groupRatioBadge:
        'bg-fuchsia-500 text-white font-bold dark:bg-fuchsia-400 dark:text-black',
      modelTag:
        'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-500/25 hover:border-fuchsia-500/70',
      modelIconKey: 'Midjourney',
    }
  }
  return {
    iconKey: 'Sparkles',
    platformBadge:
      'border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400',
    groupBadge:
      'border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300',
    groupRatioBadge:
      'bg-violet-500 text-white font-bold dark:bg-violet-400 dark:text-black',
    modelTag:
      'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/25 hover:border-violet-500/70',
    modelIconKey: 'Sparkles',
  }
}

function renderIcon(iconKey: string, size: number = 14) {
  if (iconKey === 'Sparkles') {
    return <Sparkles style={{ width: size, height: size }} />
  }
  return getLobeIcon(iconKey, size)
}

export function AvailableChannels() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })

  const {
    data: response,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['available-channels'],
    queryFn: getAvailableChannels,
    staleTime: 60_000,
  })

  const rawPlatforms = response?.data

  // 根据搜索词过滤平台、分组或支持的模型
  const filteredPlatforms = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rawPlatforms ?? []

    return (rawPlatforms ?? [])
      .map((item) => {
        const matchPlatform = item.platform.toLowerCase().includes(term)
        const matchedGroups = item.groups.filter(
          (g) =>
            g.name.toLowerCase().includes(term) || `${g.ratio}`.includes(term)
        )
        const matchedModels = item.models.filter((m) =>
          m.toLowerCase().includes(term)
        )

        if (
          matchPlatform ||
          matchedGroups.length > 0 ||
          matchedModels.length > 0
        ) {
          return {
            ...item,
            // 搜索时不硬截断分组，但如果具体匹配到了分组或模型也高亮保留
            groups: item.groups,
            models: item.models,
          }
        }
        return null
      })
      .filter((item): item is AvailableChannelPlatform => item !== null)
  }, [rawPlatforms, search])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4 pb-16'>
          {/* 头部标题区 */}
          <div className='flex flex-col gap-1'>
            <div className='flex items-center gap-2'>
              <Layers className='text-primary size-6' />
              <h1 className='text-2xl font-bold tracking-tight'>
                {t('Available Channels')}
              </h1>
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('View available channels, groups, and supported models.')}
            </p>
          </div>

          {/* 搜索与控制栏 */}
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='relative w-full max-w-sm'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2' />
              <Input
                placeholder={t('Search by platform, group, or model...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='pl-9'
              />
            </div>

            <Button
              variant='outline'
              size='sm'
              onClick={() => void refetch()}
              disabled={isLoading || isRefetching}
              className='w-fit self-end'
            >
              <RefreshCw
                className={cn(
                  'size-4',
                  (isLoading || isRefetching) && 'animate-spin'
                )}
              />
              <span>{t('Refresh')}</span>
            </Button>
          </div>

          {/* 主表格区：严格包含【平台】、【分组】、【支持模型】三列 */}
          <Card className='overflow-hidden border'>
            <CardContent className='p-0'>
              <Table>
                <TableHeader className='bg-muted/40'>
                  <TableRow>
                    <TableHead className='w-[160px] font-semibold md:w-[200px]'>
                      {t('Platform')}
                    </TableHead>
                    <TableHead className='w-[240px] font-semibold md:w-[320px]'>
                      {t('Group')}
                    </TableHead>
                    <TableHead className='font-semibold'>
                      {t('Supported Models')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={3} className='h-36 text-center'>
                        <div className='text-muted-foreground flex flex-col items-center justify-center gap-2'>
                          <Loader2 className='size-6 animate-spin' />
                          <span className='text-sm'>{t('Loading...')}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filteredPlatforms.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className='h-36 text-center'>
                        <div className='text-muted-foreground flex flex-col items-center justify-center gap-1'>
                          <Server className='size-8 opacity-40' />
                          <span className='text-sm'>
                            {t('No matching channels found')}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading &&
                    filteredPlatforms.length > 0 &&
                    filteredPlatforms.map((row) => {
                      const theme = getPlatformTheme(row.platform)
                      return (
                        <TableRow
                          key={row.platform}
                          className='hover:bg-muted/30 border-b'
                        >
                          {/* 1. 平台列 */}
                          <TableCell className='align-top font-medium'>
                            <div className='pt-1'>
                              <div
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs tracking-wider uppercase font-semibold shadow-2xs',
                                  theme.platformBadge
                                )}
                              >
                                <span className='flex shrink-0 items-center'>
                                  {renderIcon(theme.iconKey, 14)}
                                </span>
                                <span>{row.platform}</span>
                              </div>
                            </div>
                          </TableCell>

                          {/* 2. 分组列（公开状态 + 品牌图标 + 分组名 + 高亮分组倍率） */}
                          <TableCell className='align-top'>
                            <div className='flex flex-wrap items-center gap-2 pt-1'>
                              {row.groups.length > 0 ? (
                                row.groups.map((group) => (
                                  <div
                                    key={group.name}
                                    className='inline-flex items-center gap-1.5'
                                  >
                                    <span className='text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[11px] font-normal'>
                                      <Globe className='size-3.5 opacity-70' />
                                      <span>{t('Public')}</span>
                                    </span>
                                    <div
                                      className={cn(
                                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors shadow-2xs',
                                        theme.groupBadge
                                      )}
                                    >
                                      <span className='flex shrink-0 items-center'>
                                        {renderIcon(theme.iconKey, 13)}
                                      </span>
                                      <span className='font-medium'>
                                        {group.name}
                                      </span>
                                      <span
                                        className={cn(
                                          'rounded px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none shadow-xs',
                                          theme.groupRatioBadge
                                        )}
                                      >
                                        {group.ratio}x
                                      </span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <span className='text-muted-foreground text-xs'>
                                  -
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 3. 支持模型列（平台专属色彩 Tag，前置品牌图标，点击复制） */}
                          <TableCell className='align-top'>
                            <div className='flex max-w-4xl flex-wrap gap-2 pt-1'>
                              {row.models.length > 0 ? (
                                row.models.map((model) => {
                                  const isCopied = copiedText === model
                                  return (
                                    <Tooltip key={model}>
                                      <TooltipTrigger
                                        render={
                                          <button
                                            type='button'
                                            onClick={() =>
                                              void copyToClipboard(model)
                                            }
                                            className={cn(
                                              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono transition-all cursor-pointer shadow-2xs',
                                              isCopied
                                                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 font-bold scale-[1.02]'
                                                : theme.modelTag
                                            )}
                                          />
                                        }
                                      >
                                        {isCopied ? (
                                          <Check className='size-3.5 shrink-0 text-emerald-500' />
                                        ) : (
                                          <span className='flex shrink-0 items-center'>
                                            {renderIcon(theme.modelIconKey, 13)}
                                          </span>
                                        )}
                                        <span>{model}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {isCopied
                                          ? t('Copied!')
                                          : t('Click to copy: {{text}}', {
                                              text: model,
                                            })}
                                      </TooltipContent>
                                    </Tooltip>
                                  )
                                })
                              ) : (
                                <span className='text-muted-foreground text-xs'>
                                  -
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
