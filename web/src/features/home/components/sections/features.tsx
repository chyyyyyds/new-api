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
import {
  Code2,
  DollarSign,
  Gauge,
  Globe2,
  Network,
  ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

const FEATURES = [
  {
    title: 'Developer Friendly',
    description: 'Compatible API routes for common AI application workflows',
    icon: Code2,
  },
  {
    title: 'Global Coverage',
    description: 'Multi-region deployment for stable global access',
    icon: Globe2,
  },
  {
    title: 'High Performance',
    description: 'Support for high concurrency with automatic load balancing',
    icon: Gauge,
  },
  {
    title: 'Lightning Fast',
    description:
      'Optimized network architecture ensures millisecond response times',
    icon: Network,
  },
  {
    title: 'Transparent Billing',
    description: 'Pay-as-you-go with real-time usage monitoring',
    icon: DollarSign,
  },
  {
    title: 'Secure & Reliable',
    description:
      'Enterprise-grade security with comprehensive permission management',
    icon: ShieldCheck,
  },
] as const

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-5 py-20 sm:px-6 md:py-28'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mx-auto mb-12 max-w-2xl text-center md:mb-16'>
          <h2 className='text-3xl font-bold tracking-tight md:text-5xl'>
            {t('Core capabilities')}{' '}
            <span className='text-primary'>chyyds.com</span>
          </h2>
          <p className='text-muted-foreground mt-4 text-sm leading-7 md:text-base'>
            {t(
              'Built for AI applications, digital assets, and what comes next'
            )}
          </p>
        </AnimateInView>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {FEATURES.map((feature, index) => (
            <AnimateInView
              key={feature.title}
              delay={index * 70}
              animation='fade-up'
              className='bg-card/70 border-border/60 group min-h-60 rounded-2xl border p-7 shadow-sm transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-blue-500/35 hover:shadow-lg md:p-8'
            >
              <div className='border-primary/20 bg-primary/5 text-primary flex size-14 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-105'>
                <feature.icon className='size-6' aria-hidden='true' />
              </div>
              <h3 className='mt-8 text-xl font-semibold'>{t(feature.title)}</h3>
              <p className='text-muted-foreground mt-3 text-sm leading-7'>
                {t(feature.description)}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
