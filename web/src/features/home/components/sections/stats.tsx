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
import { Activity, Radio } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

const STATS = [
  { value: '100+', label: 'model billing support' },
  { value: '99.9%', label: 'Availability' },
  { value: '10ms', label: 'Average latency' },
  { value: '100K+', label: 'API Requests' },
] as const

interface StatsProps {
  className?: string
}

export function Stats(_props: StatsProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-5 py-14 sm:px-6 md:py-20'>
      <AnimateInView className='home-status-panel mx-auto max-w-7xl'>
        <div className='home-status-header'>
          <div className='flex items-center gap-3'>
            <span className='home-status-icon'>
              <Activity className='size-4' aria-hidden='true' />
            </span>
            <div>
              <p className='text-sm font-semibold'>
                {t('Infrastructure status')}
              </p>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {t('Unified model routing')}
              </p>
            </div>
          </div>
          <div className='home-online-badge'>
            <span aria-hidden='true' />
            {t('Gateway Online')}
          </div>
        </div>

        <div className='home-status-metrics'>
          {STATS.map((stat) => (
            <div key={stat.label} className='home-status-metric'>
              <strong>{stat.value}</strong>
              <span>{t(stat.label)}</span>
            </div>
          ))}
        </div>

        <div className='home-status-footer'>
          <div className='min-w-0 flex-1'>
            <div className='mb-3 flex items-center justify-between gap-3'>
              <span className='text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase'>
                {t('Route fabric')}
              </span>
              <span className='text-muted-foreground/60 text-[10px]'>
                {t('Showcase metrics')}
              </span>
            </div>
            <svg
              aria-hidden='true'
              className='home-status-sparkline'
              viewBox='0 0 720 72'
              preserveAspectRatio='none'
            >
              <defs>
                <linearGradient
                  id='status-line-fill'
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop offset='0%' stopColor='#168bff' stopOpacity='0.24' />
                  <stop offset='100%' stopColor='#168bff' stopOpacity='0' />
                </linearGradient>
              </defs>
              <path
                className='home-status-area'
                d='M0 57 C60 52 85 31 138 38 S222 66 279 40 S375 18 431 33 S520 54 573 31 S660 14 720 24 L720 72 L0 72 Z'
              />
              <path
                className='home-status-line'
                d='M0 57 C60 52 85 31 138 38 S222 66 279 40 S375 18 431 33 S520 54 573 31 S660 14 720 24'
              />
            </svg>
          </div>
          <div className='home-route-regions'>
            <Radio className='size-4' aria-hidden='true' />
            <span>Asia</span>
            <i />
            <span>US</span>
            <i />
            <span>EU</span>
          </div>
        </div>
      </AnimateInView>
    </section>
  )
}
