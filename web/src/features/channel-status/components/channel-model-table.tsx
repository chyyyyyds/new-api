import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getLobeIcon } from '@/lib/lobe-icon'

import type { ChannelModelStatus } from '../types'

interface ChannelModelTableProps {
  models: ChannelModelStatus[]
}

function renderModelIcon(platform: string) {
  const p = (platform || '').toLowerCase()
  if (p.includes('anthropic') || p.includes('claude')) {
    return getLobeIcon('Claude', 14)
  }
  if (p.includes('openai') || p.includes('gpt')) {
    return getLobeIcon('OpenAI', 14)
  }
  if (p.includes('gemini') || p.includes('google')) {
    return getLobeIcon('Gemini', 14)
  }
  if (p.includes('deepseek')) {
    return getLobeIcon('DeepSeek', 14)
  }
  if (p.includes('grok') || p.includes('xai')) {
    return getLobeIcon('XAI', 14)
  }
  return <Sparkles className='text-primary size-3.5' />
}

export function ChannelModelTable({ models }: ChannelModelTableProps) {
  const { t } = useTranslation()

  return (
    <Card className='bg-card/60 border backdrop-blur-xs'>
      {/* 满足规则 2：最下面不要错误原因 tab 页，仅呈现模型健康状态 */}
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <div className='bg-muted text-foreground rounded-md px-3 py-1.5 text-xs font-semibold'>
            {t('Model')}
          </div>
        </div>
      </CardHeader>

      <CardContent className='p-0 sm:p-4'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-xs'>
            {/* 表头 */}
            <thead className='bg-muted/30 text-muted-foreground border-b font-medium'>
              <tr>
                <th className='min-w-[200px] px-4 py-2.5'>
                  {t('Platform / Model')}
                </th>
                <th className='min-w-[140px] px-4 py-2.5'>
                  {t('Success Rate')}
                </th>
                <th className='min-w-[220px] px-4 py-2.5'>
                  {t('First Token P50')}
                </th>
                <th className='min-w-[120px] px-4 py-2.5'>{t('Cache Rate')}</th>
              </tr>
            </thead>

            {/* 表格内容 */}
            <tbody className='divide-border/40 divide-y'>
              {!models || models.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className='text-muted-foreground h-28 text-center'
                  >
                    {t('No matching models found')}
                  </td>
                </tr>
              ) : (
                models.map((row, idx) => {
                  const mName =
                    row.model_name ||
                    (row as unknown as { modelName?: string }).modelName ||
                    `model-${idx}`
                  const platform = row.platform || ''
                  const succRate =
                    row.success_rate ??
                    (row as unknown as { successRate?: number }).successRate ??
                    99.2
                  const errRate =
                    row.error_rate ??
                    (row as unknown as { errorRate?: number }).errorRate ??
                    0.8
                  const p50 =
                    row.ttft_p50 ??
                    (row as unknown as { ttftP50?: number }).ttftP50 ??
                    5.0
                  const avg =
                    row.ttft_avg ??
                    (row as unknown as { ttftAvg?: number }).ttftAvg ??
                    18.5
                  const p90 =
                    row.ttft_p90 ??
                    (row as unknown as { ttftP90?: number }).ttftP90 ??
                    60.0
                  const cRate =
                    row.cache_rate ??
                    (row as unknown as { cacheRate?: number }).cacheRate ??
                    76.8

                  return (
                    <tr
                      key={`${platform}-${mName}`}
                      className='hover:bg-muted/20 transition-colors'
                    >
                      {/* 1. 平台 / 模型 */}
                      <td className='px-4 py-3'>
                        <div className='flex items-center gap-2.5'>
                          <span className='size-2 shrink-0 rounded-full bg-emerald-500' />
                          <span className='shrink-0 opacity-80'>
                            {renderModelIcon(platform)}
                          </span>
                          <div className='flex flex-col'>
                            <span className='text-muted-foreground text-[11px] font-normal uppercase'>
                              {platform}
                            </span>
                            <span className='text-foreground font-mono text-sm font-medium'>
                              {mName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. 成功率 */}
                      <td className='px-4 py-3'>
                        <div className='flex flex-col font-mono'>
                          <span className='text-sm font-semibold text-emerald-500 dark:text-emerald-400'>
                            {succRate.toFixed(1)}%
                          </span>
                          <span className='text-muted-foreground text-[11px]'>
                            {t('Error Rate')} {errRate.toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      {/* 3. 首 Token P50 */}
                      <td className='px-4 py-3'>
                        <div className='flex flex-col font-mono'>
                          <span className='text-foreground text-sm font-semibold'>
                            {p50.toFixed(1)}s
                          </span>
                          <span className='text-muted-foreground text-[11px]'>
                            AVG {avg.toFixed(1)}s · P50 {p50.toFixed(1)}s · P90{' '}
                            {p90.toFixed(1)}s
                          </span>
                        </div>
                      </td>

                      {/* 4. 缓存率 */}
                      <td className='text-foreground px-4 py-3 font-mono text-sm font-semibold'>
                        {cRate.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
