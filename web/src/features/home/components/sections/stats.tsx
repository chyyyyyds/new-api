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
import { BarChart3, Bot, Gauge, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

const STATS = [
  { value: '100+', label: 'model billing support', icon: Bot },
  { value: '99.9%', label: 'Availability', icon: ShieldCheck },
  { value: '10ms', label: 'Average latency', icon: Gauge },
  { value: '100K+', label: 'API Requests', icon: BarChart3 },
] as const

interface StatsProps {
  className?: string
}

export function Stats(_props: StatsProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-5 py-12 sm:px-6 md:py-16'>
      <div className='mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {STATS.map((stat, index) => (
          <AnimateInView
            key={stat.label}
            delay={index * 70}
            animation='fade-up'
            className='bg-card/70 border-border/60 flex min-h-40 items-center gap-5 rounded-2xl border p-7 shadow-sm backdrop-blur-sm'
          >
            <div className='border-primary/20 bg-primary/5 text-primary flex size-14 shrink-0 items-center justify-center rounded-2xl border'>
              <stat.icon className='size-6' aria-hidden='true' />
            </div>
            <div>
              <p className='text-3xl font-bold tracking-tight tabular-nums'>
                {stat.value}
              </p>
              <p className='text-muted-foreground mt-2 text-sm'>
                {t(stat.label)}
              </p>
            </div>
          </AnimateInView>
        ))}
      </div>
    </section>
  )
}
