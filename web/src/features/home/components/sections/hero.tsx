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
import { ArrowRight, BookOpen, Boxes } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

import { AiCore } from '../ai-core'
import { ModelMarquee } from '../model-marquee'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const isExternalDocs = docsUrl.startsWith('http')

  return (
    <section className='home-hero relative z-10 overflow-hidden px-5 pt-28 pb-8 sm:px-6 md:pt-36 md:pb-12'>
      <div aria-hidden='true' className='home-hero-beam' />
      <div className='mx-auto grid max-w-7xl items-center gap-12 lg:min-h-[43rem] lg:grid-cols-[0.9fr_1.1fr] lg:gap-6'>
        <div className='relative z-10 flex flex-col items-start'>
          <div className='landing-animate-fade-up home-eyebrow opacity-0'>
            <Boxes className='size-3.5' aria-hidden='true' />
            {t('AI infrastructure for every model')}
          </div>

          <h1 className='home-hero-title landing-animate-fade-up opacity-0 [animation-delay:60ms]'>
            <span>{t('ONE API.')}</span>
            <span className='home-gradient-text'>{t('EVERY MODEL.')}</span>
          </h1>

          <p className='landing-animate-fade-up mt-7 max-w-xl text-xl leading-tight font-semibold tracking-tight opacity-0 [animation-delay:120ms] sm:text-2xl md:text-3xl'>
            {t('One interface, connect the entire AI world.')}
          </p>
          <p className='text-muted-foreground landing-animate-fade-up mt-5 max-w-xl text-sm leading-7 opacity-0 [animation-delay:160ms] md:text-base'>
            OpenAI · Claude · Gemini · DeepSeek · GLM · Qwen
            <br />
            {t('One key gives you access to leading AI models.')}
          </p>

          <div className='landing-animate-fade-up mt-8 flex flex-wrap gap-3 opacity-0 [animation-delay:220ms]'>
            <Button
              size='lg'
              className='home-primary-button h-12 gap-2 px-6 text-sm'
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
              className='home-secondary-button h-12 gap-2 px-6 text-sm'
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

        <div className='landing-animate-fade-up min-w-0 opacity-0 [animation-delay:180ms]'>
          <AiCore
            ariaLabel={t('Supported AI providers')}
            gatewayLabel={t('AI Gateway')}
            onlineLabel={t('Online')}
          />
        </div>
      </div>

      <div className='mx-auto mt-8 max-w-7xl border-t border-white/5 pt-6 md:mt-2'>
        <ModelMarquee ariaLabel={t('Unified model access')} />
      </div>
    </section>
  )
}
