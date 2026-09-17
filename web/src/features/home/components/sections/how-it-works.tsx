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
import { ArrowRight, ChartNoAxesCombined, KeyRound, Route } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

import { DeveloperTerminal } from '../developer-terminal'

const STEPS = [
  {
    number: '01',
    title: 'Get an API key',
    description:
      'Add your API keys, set up channels and configure access permissions',
    icon: KeyRound,
  },
  {
    number: '02',
    title: 'Connect',
    description:
      'Connect through OpenAI, Claude, Gemini, and other compatible API routes',
    icon: Route,
  },
  {
    number: '03',
    title: 'Monitor',
    description: 'Track usage, costs and performance with real-time analytics',
    icon: ChartNoAxesCombined,
  },
] as const

export function HowItWorks() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-5 py-20 sm:px-6 md:py-28'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-12 md:mb-16'>
          <span className='home-section-kicker'>{t('Quick start')}</span>
          <h2 className='home-section-title mt-4'>
            {t('Three steps to get started')}
          </h2>
          <p className='text-muted-foreground mt-4 text-sm leading-7 md:text-base'>
            {t('From API key to first response in minutes.')}
          </p>
        </AnimateInView>

        <div className='grid items-stretch gap-6 lg:grid-cols-[0.78fr_1.22fr]'>
          <AnimateInView animation='fade-right' className='home-steps-panel'>
            <ol className='home-steps-list'>
              {STEPS.map((step) => (
                <li key={step.number}>
                  <span className='home-step-number'>{step.number}</span>
                  <span className='home-step-icon'>
                    <step.icon aria-hidden='true' />
                  </span>
                  <div>
                    <h3>{t(step.title)}</h3>
                    <p>{t(step.description)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button
              variant='outline'
              size='lg'
              className='home-secondary-button mt-8 h-11 gap-2 px-5'
              render={<Link to='/keys' />}
            >
              {t('API Keys')}
              <ArrowRight data-icon='inline-end' className='size-4' />
            </Button>
          </AnimateInView>

          <AnimateInView
            animation='fade-left'
            delay={100}
            className='developer-terminal-reveal min-w-0'
          >
            <DeveloperTerminal />
          </AnimateInView>
        </div>
      </div>
    </section>
  )
}
