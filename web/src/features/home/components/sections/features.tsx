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
import { Braces, Gauge, Globe2, ReceiptText, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

function NetworkVisual() {
  return (
    <div className='home-network-visual' aria-hidden='true'>
      <svg viewBox='0 0 680 250' preserveAspectRatio='none'>
        <path d='M52 152 C154 50 251 191 340 120 S528 35 630 116' />
        <path d='M78 88 C178 174 270 48 360 138 S538 199 614 82' />
        <path d='M148 212 C236 126 329 215 447 107 S570 72 643 160' />
        <circle cx='78' cy='88' r='5' />
        <circle cx='204' cy='136' r='5' />
        <circle cx='340' cy='120' r='6' />
        <circle cx='447' cy='107' r='5' />
        <circle cx='614' cy='82' r='5' />
        <circle cx='630' cy='116' r='5' />
      </svg>
      <span className='home-network-region home-network-region-tokyo'>
        Tokyo
      </span>
      <span className='home-network-region home-network-region-singapore'>
        Singapore
      </span>
      <span className='home-network-region home-network-region-us'>US</span>
      <span className='home-network-region home-network-region-europe'>
        Europe
      </span>
    </div>
  )
}

export function Features() {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 px-5 py-20 sm:px-6 md:py-28'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-12 max-w-2xl md:mb-16'>
          <span className='home-section-kicker'>
            {t('Core infrastructure')}
          </span>
          <h2 className='home-section-title mt-4'>
            {t('Built for the path between')}
            <br />
            <span className='home-gradient-text'>
              {t('your code and every model.')}
            </span>
          </h2>
          <p className='text-muted-foreground mt-5 max-w-xl text-sm leading-7 md:text-base'>
            {t('Designed for fast, observable, and secure AI delivery.')}
          </p>
        </AnimateInView>

        <div className='home-bento-grid'>
          <AnimateInView className='home-bento-card home-bento-network md:col-span-2 xl:col-span-7 xl:row-span-2'>
            <div className='home-bento-heading'>
              <span className='home-bento-icon'>
                <Globe2 aria-hidden='true' />
              </span>
              <span className='home-bento-meta'>
                {t('Abstract routing fabric')}
              </span>
            </div>
            <div className='relative z-10 mt-auto max-w-md'>
              <h3>{t('Global AI Network')}</h3>
              <p>
                {t(
                  'One interface for diverse model providers and routing policies.'
                )}
              </p>
            </div>
            <NetworkVisual />
          </AnimateInView>

          <AnimateInView
            delay={70}
            className='home-bento-card home-bento-pricing xl:col-span-5'
          >
            <div className='home-bento-heading'>
              <span className='home-bento-icon'>
                <ReceiptText aria-hidden='true' />
              </span>
            </div>
            <h3>{t('Transparent Billing')}</h3>
            <p>{t('Track input, output, and cached tokens in one place.')}</p>
            <div className='home-token-ledger' aria-hidden='true'>
              <span>{t('Input Tokens')}</span>
              <i />
              <span>{t('Output Tokens')}</span>
              <i />
              <span>{t('Cached Tokens')}</span>
            </div>
          </AnimateInView>

          <AnimateInView
            delay={110}
            className='home-bento-card home-bento-latency xl:col-span-5'
          >
            <div className='home-bento-heading'>
              <span className='home-bento-icon'>
                <Gauge aria-hidden='true' />
              </span>
              <strong>10ms</strong>
            </div>
            <h3>{t('Low Latency')}</h3>
            <p>
              {t('Optimized routing paths with clear performance visibility.')}
            </p>
            <div className='home-waveform' aria-hidden='true'>
              {[18, 36, 52, 26, 64, 42, 74, 48, 30, 56, 24, 40].map(
                (height) => (
                  <i key={height} style={{ height }} />
                )
              )}
            </div>
          </AnimateInView>

          <AnimateInView
            delay={140}
            className='home-bento-card home-bento-developer xl:col-span-5'
          >
            <div className='home-bento-heading'>
              <span className='home-bento-icon'>
                <Braces aria-hidden='true' />
              </span>
            </div>
            <h3>{t('Developer Friendly')}</h3>
            <p>
              {t('Build with familiar request formats and a unified endpoint.')}
            </p>
            <pre aria-label={t('Request example')}>
              <code>{`{
  "model": "gpt-5.6",
  "input": "Hello"
}`}</code>
            </pre>
          </AnimateInView>

          <AnimateInView
            delay={180}
            className='home-bento-card home-bento-security xl:col-span-7'
          >
            <div className='home-security-layout'>
              <div>
                <div className='home-bento-heading'>
                  <span className='home-bento-icon'>
                    <ShieldCheck aria-hidden='true' />
                  </span>
                </div>
                <h3>{t('Secure by Design')}</h3>
                <p>
                  {t(
                    'Layered access controls and auditable API key management.'
                  )}
                </p>
              </div>
              <div className='home-security-shield' aria-hidden='true'>
                <ShieldCheck />
                <span />
              </div>
            </div>
          </AnimateInView>
        </div>
      </div>
    </section>
  )
}
