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
import { getLobeIcon } from '@/lib/lobe-icon'

const MODELS = [
  { name: 'GPT-5.6', icon: 'OpenAI' },
  { name: 'Claude', icon: 'Claude.Color' },
  { name: 'Gemini', icon: 'Gemini.Color' },
  { name: 'DeepSeek', icon: 'DeepSeek.Color' },
  { name: 'GLM', icon: 'Zhipu.Color' },
  { name: 'Qwen', icon: 'Qwen.Color' },
  { name: 'Grok', icon: 'Grok.Color' },
  { name: 'Mistral', icon: 'Mistral.Color' },
] as const

function ModelGroup(props: { duplicate?: boolean }) {
  return (
    <div
      className='model-marquee-group'
      aria-hidden={props.duplicate ? 'true' : undefined}
    >
      {MODELS.map((model) => (
        <div key={model.name} className='model-marquee-item'>
          <span className='model-marquee-icon'>
            {getLobeIcon(model.icon, 20)}
          </span>
          <span>{model.name}</span>
        </div>
      ))}
    </div>
  )
}

export function ModelMarquee(props: { ariaLabel: string }) {
  return (
    <div className='model-marquee' aria-label={props.ariaLabel}>
      <div className='model-marquee-track'>
        <ModelGroup />
        <ModelGroup duplicate />
      </div>
    </div>
  )
}
