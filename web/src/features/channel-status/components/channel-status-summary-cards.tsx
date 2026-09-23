import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'

interface ChannelStatusSummaryCardsProps {
  successRate: number
  errorRate: number
  ttftP50: number
  ttftAvg: number
  ttftP90: number
  cacheRate: number
}

export function ChannelStatusSummaryCards({
  successRate,
  errorRate,
  ttftP50,
  ttftAvg,
  ttftP90,
  cacheRate,
}: ChannelStatusSummaryCardsProps) {
  const { t } = useTranslation()

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
      {/* 1. 成功率卡片 */}
      <Card className='bg-card/60 border backdrop-blur-xs'>
        <CardContent className='flex flex-col gap-2 p-5'>
          <div className='flex items-center gap-2'>
            <span className='size-2.5 rounded-full bg-emerald-500 shadow-xs' />
            <span className='text-muted-foreground text-xs font-medium'>
              {t('Success Rate')}
            </span>
          </div>
          <div className='flex items-baseline gap-2'>
            <span className='font-mono text-3xl font-bold tracking-tight text-emerald-500 dark:text-emerald-400'>
              {successRate.toFixed(1)}%
            </span>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t('Error Rate')} {errorRate.toFixed(2)}%
          </p>
        </CardContent>
      </Card>

      {/* 2. 首 TOKEN P50 卡片 */}
      <Card className='bg-card/60 border backdrop-blur-xs'>
        <CardContent className='flex flex-col gap-2 p-5'>
          <div className='flex items-center gap-2'>
            <span className='size-2.5 rounded-full bg-emerald-500 shadow-xs' />
            <span className='text-muted-foreground text-xs font-medium'>
              {t('First Token P50')}
            </span>
          </div>
          <div className='flex items-baseline gap-2'>
            <span className='text-foreground font-mono text-3xl font-bold tracking-tight'>
              {ttftP50.toFixed(1)}s
            </span>
          </div>
          <p className='text-muted-foreground font-mono text-xs'>
            AVG {ttftAvg.toFixed(1)}s · P90 {ttftP90.toFixed(1)}s
          </p>
        </CardContent>
      </Card>

      {/* 3. 缓存率卡片 */}
      <Card className='bg-card/60 border backdrop-blur-xs'>
        <CardContent className='flex flex-col gap-2 p-5'>
          <div className='flex items-center gap-2'>
            <span className='size-2.5 rounded-full bg-amber-500 shadow-xs' />
            <span className='text-muted-foreground text-xs font-medium'>
              {t('Cache Rate')}
            </span>
          </div>
          <div className='flex items-baseline gap-2'>
            <span className='font-mono text-3xl font-bold tracking-tight text-amber-500 dark:text-amber-400'>
              {cacheRate.toFixed(1)}%
            </span>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t('Fast Cache Ratio')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
