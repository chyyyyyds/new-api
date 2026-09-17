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
import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'

export const CURL_EXAMPLE = `curl https://chyyds.com/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5.6",
    "messages": [{"role":"user","content":"Hello"}],
    "stream": true
  }'`

const CAPABILITIES = [
  'OpenAI Compatible',
  'Responses API',
  'Chat Completions',
  'Streaming',
] as const

export function DeveloperTerminal() {
  const { t } = useTranslation()

  return (
    <div className='developer-terminal'>
      <div className='developer-terminal-header'>
        <div className='flex items-center gap-3'>
          <span aria-hidden='true' className='developer-terminal-lights'>
            <i />
            <i />
            <i />
          </span>
          <span className='font-mono text-xs text-slate-400'>
            {t('API Playground')}
          </span>
        </div>
        <CopyButton
          value={CURL_EXAMPLE}
          className='size-8 text-slate-400 hover:bg-white/5 hover:text-white'
          tooltip={t('Copy code')}
          successTooltip={t('Copied!')}
          aria-label={t('Copy code')}
        />
      </div>

      <div className='developer-terminal-body'>
        <pre className='developer-terminal-command'>
          <code>{CURL_EXAMPLE}</code>
        </pre>
        <div
          className='developer-terminal-output'
          aria-label={t('Request flow')}
        >
          <p className='developer-terminal-line'>
            <span>$</span> POST /v1/chat/completions
          </p>
          <p className='developer-terminal-line'>
            <span>→</span> Model: gpt-5.6
          </p>
          <p className='developer-terminal-line'>
            <span>→</span> Protocol: Chat Completions
          </p>
          <p className='developer-terminal-line'>
            <span>→</span> Streaming: enabled
          </p>
          <p className='developer-terminal-line developer-terminal-success'>
            <span>←</span> 200 OK · Response received
          </p>
        </div>
      </div>

      <div className='developer-terminal-capabilities'>
        {CAPABILITIES.map((capability) => (
          <span key={capability}>
            <CheckCircle2 aria-hidden='true' />
            {t(capability)}
          </span>
        ))}
      </div>
    </div>
  )
}
