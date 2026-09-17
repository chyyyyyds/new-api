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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='home-cta relative z-10 overflow-hidden px-5 py-24 sm:px-6 md:py-36'>
      <div aria-hidden='true' className='home-cta-glow' />
      <AnimateInView
        className='relative mx-auto max-w-3xl text-center'
        animation='scale-in'
      >
        <span className='home-section-kicker'>{t('The gateway is ready')}</span>
        <h2 className='mt-5 text-[clamp(2.7rem,8vw,6.5rem)] leading-none font-black tracking-[-0.055em]'>
          {t('READY TO BUILD?')}
        </h2>
        <p className='text-muted-foreground mx-auto mt-6 max-w-xl text-sm leading-7 md:text-base'>
          {t('One API key connects the AI models you need.')}
        </p>
        <div className='mt-9 flex flex-wrap items-center justify-center gap-3'>
          <Button
            size='lg'
            className='home-primary-button h-12 gap-2 px-6'
            render={<Link to='/sign-up' />}
          >
            {t('Get Started')}
            <ArrowRight data-icon='inline-end' className='size-4' />
          </Button>
          <Button
            size='lg'
            variant='outline'
            className='home-secondary-button h-12 px-6'
            render={<Link to='/pricing' />}
          >
            {t('View Pricing')}
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
