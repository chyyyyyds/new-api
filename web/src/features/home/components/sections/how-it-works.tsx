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
import { ArrowRight, Box, KeyRound, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'

const CURL_EXAMPLE = `curl https://chyyds.com/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.6",
    "messages": [{"role":"user","content":"Hello chyyds.com"}]
  }'`

const STEPS = [
  {
    number: '1',
    title: 'Get an API key',
    description:
      'Add your API keys, set up channels and configure access permissions',
    icon: KeyRound,
  },
  {
    number: '2',
    title: 'Connect',
    description:
      'Connect through OpenAI, Claude, Gemini, and other compatible API routes',
    icon: Box,
  },
  {
    number: '3',
    title: 'Monitor',
    description: 'Track usage, costs and performance with real-time analytics',
    icon: Send,
  },
] as const

export function HowItWorks() {
  const { t } = useTranslation()

  return (
    <section className='border-border/50 relative z-10 border-t px-5 py-20 sm:px-6 md:py-28'>
      <div className='mx-auto max-w-7xl'>
        <AnimateInView className='mb-12 md:mb-16'>
          <h2 className='text-3xl font-bold tracking-tight md:text-5xl'>
            {t('Three steps to get started')}
          </h2>
          <p className='text-muted-foreground mt-4 text-sm leading-7 md:text-base'>
            {t('One API key connects your everyday AI workflow')}
          </p>
        </AnimateInView>

        <div className='grid gap-5 lg:grid-cols-[0.85fr_1.45fr]'>
          <AnimateInView
            animation='fade-right'
            className='bg-card/70 border-border/60 rounded-2xl border p-6 shadow-sm md:p-8'
          >
            <ol className='relative space-y-8 before:absolute before:top-7 before:bottom-7 before:left-5 before:w-px before:bg-blue-500/25'>
              {STEPS.map((step) => (
                <li key={step.number} className='relative flex gap-4'>
                  <div className='border-primary/25 bg-background text-primary z-10 flex size-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold'>
                    {step.number}
                  </div>
                  <div className='border-border/50 bg-muted/20 flex min-w-0 flex-1 gap-4 rounded-2xl border p-4'>
                    <div className='border-primary/15 bg-primary/5 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border'>
                      <step.icon className='size-5' aria-hidden='true' />
                    </div>
                    <div>
                      <h3 className='font-semibold'>{t(step.title)}</h3>
                      <p className='text-muted-foreground mt-1 text-sm leading-6'>
                        {t(step.description)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <Button
              variant='outline'
              size='lg'
              className='mt-8 h-11 gap-2 px-5'
              render={<Link to='/keys' />}
            >
              {t('API Keys')}
              <ArrowRight data-icon='inline-end' className='size-4' />
            </Button>
          </AnimateInView>

          <AnimateInView
            animation='fade-left'
            delay={100}
            className='bg-card/70 border-border/60 overflow-hidden rounded-2xl border shadow-sm'
          >
            <div className='border-border/60 flex items-center justify-between border-b px-5 py-4'>
              <div className='flex items-center gap-3'>
                <span className='bg-primary/10 text-primary rounded-lg px-3 py-1.5 text-xs font-medium'>
                  {t('Request')}
                </span>
                <span className='text-muted-foreground font-mono text-sm'>
                  cURL
                </span>
              </div>
              <CopyButton
                value={CURL_EXAMPLE}
                className='size-9'
                tooltip={t('Copy code')}
                successTooltip={t('Copied!')}
                aria-label={t('Copy code')}
              />
            </div>

            <div className='grid gap-5 p-5 xl:grid-cols-[1fr_14rem]'>
              <pre className='min-h-80 overflow-x-auto rounded-2xl border border-blue-500/20 bg-slate-950 p-5 font-mono text-xs leading-7 text-slate-200 shadow-inner sm:text-sm'>
                <code>{CURL_EXAMPLE}</code>
              </pre>

              <div className='grid content-start gap-4'>
                <div className='border-border/60 bg-background/60 rounded-2xl border p-5'>
                  <p className='text-primary text-sm font-semibold'>
                    {t('Compatible with OpenAI')}
                  </p>
                  <code className='bg-muted/50 text-primary mt-4 block overflow-x-auto rounded-lg px-3 py-2 text-xs'>
                    https://chyyds.com/v1
                  </code>
                </div>
                <div className='border-border/60 bg-background/60 text-muted-foreground grid gap-3 rounded-2xl border p-5 text-sm'>
                  <p>{t('One integration, multiple model families')}</p>
                  <p>{t('Streaming responses')}</p>
                  <p>{t('Multi-protocol support')}</p>
                </div>
              </div>
            </div>
          </AnimateInView>
        </div>
      </div>
    </section>
  )
}
