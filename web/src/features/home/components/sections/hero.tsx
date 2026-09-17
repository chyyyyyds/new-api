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
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Gauge,
  Network,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { getLobeIcon } from '@/lib/lobe-icon'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const PROVIDERS = [
  {
    id: 'openai',
    name: 'GPT',
    company: 'OpenAI',
    icon: 'OpenAI',
    position: 'left-[8%] top-[4%] lg:left-[10%]',
  },
  {
    id: 'claude',
    name: 'Claude',
    company: 'Anthropic',
    icon: 'Claude.Color',
    position: 'right-[3%] top-[6%]',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    company: 'Google',
    icon: 'Gemini.Color',
    position: 'left-0 top-[48%]',
  },
  {
    id: 'glm',
    name: 'GLM',
    company: 'Zhipu AI',
    icon: 'Zhipu.Color',
    position: 'right-0 top-[50%]',
  },
] as const

const VALUE_PROPS = [
  {
    icon: Sparkles,
    title: 'Direct model access',
    description: 'Connect to leading model providers with reliable output',
  },
  {
    icon: Gauge,
    title: 'Clear, transparent pricing',
    description: 'Track usage, latency, and costs at a glance',
  },
  {
    icon: Network,
    title: 'Stable, high-speed routing',
    description: 'Multi-route failover built for high concurrency',
  },
] as const

interface ProviderOrbitProps {
  ariaLabel: string
  gatewayLabel: string
}

function ProviderOrbit(props: ProviderOrbitProps) {
  return (
    <div
      className='relative mx-auto aspect-square w-full max-w-[620px]'
      aria-label={props.ariaLabel}
    >
      <div
        aria-hidden='true'
        className='absolute inset-[12%] rounded-full bg-blue-500/10 blur-3xl'
      />
      <div
        aria-hidden='true'
        className='absolute inset-[16%] rounded-full border border-blue-500/20'
      />
      <div
        aria-hidden='true'
        className='absolute inset-[27%] rounded-full border border-blue-400/30'
      />
      <div
        aria-hidden='true'
        className='absolute inset-[34%] rotate-45 rounded-[42%] border border-blue-500/20'
      />
      <div
        aria-hidden='true'
        className='absolute top-1/2 left-1/2 h-[48%] w-[74%] -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-[50%] border border-blue-500/20'
      />
      <div
        aria-hidden='true'
        className='absolute top-1/2 left-1/2 h-[74%] w-[48%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-[50%] border border-blue-500/20'
      />

      <div className='absolute top-1/2 left-1/2 flex size-[34%] min-h-36 min-w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-blue-300/50 bg-gradient-to-br from-blue-300 via-blue-500 to-blue-700 text-center text-white shadow-[0_0_70px_rgba(59,130,246,0.42)]'>
        <span className='text-lg font-extrabold tracking-tight sm:text-2xl'>
          chyyds.com
        </span>
        <span className='mt-2 text-[10px] font-semibold tracking-[0.24em] text-blue-100 uppercase sm:text-xs'>
          {props.gatewayLabel}
        </span>
      </div>

      {PROVIDERS.map((provider) => (
        <div
          key={provider.id}
          className={`bg-card/95 border-border/70 absolute flex w-[38%] min-w-36 items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl ${provider.position}`}
        >
          <div className='bg-muted/60 flex size-10 shrink-0 items-center justify-center rounded-xl'>
            {getLobeIcon(provider.icon, 25)}
          </div>
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold'>{provider.name}</p>
            <p className='text-muted-foreground truncate text-xs'>
              {provider.company}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const isExternalDocs = docsUrl.startsWith('http')

  return (
    <section className='relative z-10 overflow-hidden px-5 pt-28 pb-16 sm:px-6 md:pt-36 md:pb-20'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_34%,color-mix(in_oklab,var(--color-blue-500)_18%,transparent),transparent_32%),radial-gradient(circle_at_8%_8%,color-mix(in_oklab,var(--color-violet-500)_9%,transparent),transparent_24%)]'
      />

      <div className='mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8'>
        <div className='flex flex-col items-start'>
          <div className='landing-animate-fade-up border-primary/25 bg-primary/5 text-primary mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium opacity-0'>
            <CheckCircle2 className='size-3.5' aria-hidden='true' />
            {t('Built for efficient AI development')}
          </div>

          <h1 className='landing-animate-fade-up max-w-3xl text-[clamp(2.8rem,6.2vw,5.7rem)] leading-[1.02] font-black tracking-[-0.055em] opacity-0 [animation-delay:60ms]'>
            {t("Connect the world's leading AI")}
            <br />
            {t('Build without limits')}
          </h1>

          <p className='landing-animate-fade-up text-muted-foreground mt-7 max-w-2xl text-base leading-8 opacity-0 [animation-delay:120ms] md:text-lg'>
            {t(
              'Access leading AI models through one unified, standard API. Build faster, manage usage clearly, and scale with confidence.'
            )}
          </p>

          <div className='landing-animate-fade-up mt-8 flex flex-wrap gap-3 opacity-0 [animation-delay:180ms]'>
            <Button
              size='lg'
              className='h-12 gap-2 px-6 text-sm shadow-[0_10px_30px_rgba(59,130,246,0.25)]'
              render={
                <Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />
              }
            >
              {props.isAuthenticated ? t('Go to Dashboard') : t('Get Started')}
              <ArrowRight data-icon='inline-end' className='size-4' />
            </Button>
            <Button
              size='lg'
              variant='outline'
              className='h-12 gap-2 px-6 text-sm'
              render={
                isExternalDocs ? (
                  <a href={docsUrl} target='_blank' rel='noopener noreferrer' />
                ) : (
                  <Link to={docsUrl} />
                )
              }
            >
              <BookOpen data-icon='inline-start' className='size-4' />
              {t('Docs')}
            </Button>
          </div>
        </div>

        <div className='landing-animate-fade-up opacity-0 [animation-delay:220ms]'>
          <ProviderOrbit
            ariaLabel={t('Supported AI providers')}
            gatewayLabel={t('AI Gateway')}
          />
        </div>
      </div>

      <div className='mx-auto mt-8 grid max-w-7xl gap-4 border-t pt-8 sm:grid-cols-3 lg:mt-4'>
        {VALUE_PROPS.map((item) => (
          <div key={item.title} className='flex items-start gap-3'>
            <div className='border-primary/20 bg-primary/5 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border'>
              <item.icon className='size-5' aria-hidden='true' />
            </div>
            <div>
              <h2 className='text-sm font-semibold'>{t(item.title)}</h2>
              <p className='text-muted-foreground mt-1 text-xs leading-5'>
                {t(item.description)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
