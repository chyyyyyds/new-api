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
import { useEffect, useRef, type PointerEvent } from 'react'

import { getLobeIcon } from '@/lib/lobe-icon'

const PROVIDERS = [
  { id: 'openai', name: 'GPT', icon: 'OpenAI', position: 'openai' },
  { id: 'claude', name: 'Claude', icon: 'Claude.Color', position: 'claude' },
  { id: 'gemini', name: 'Gemini', icon: 'Gemini.Color', position: 'gemini' },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'DeepSeek.Color',
    position: 'deepseek',
  },
  { id: 'glm', name: 'GLM', icon: 'Zhipu.Color', position: 'glm' },
  { id: 'qwen', name: 'Qwen', icon: 'Qwen.Color', position: 'qwen' },
] as const

interface AiCoreProps {
  ariaLabel: string
  gatewayLabel: string
  onlineLabel: string
}

export function AiCore(props: AiCoreProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    },
    []
  )

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      !window.matchMedia(
        '(pointer: fine) and (prefers-reduced-motion: no-preference)'
      ).matches
    ) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const offsetX = ((event.clientX - rect.left) / rect.width - 0.5) * 8
    const offsetY = ((event.clientY - rect.top) / rect.height - 0.5) * 8

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
    }
    animationFrameRef.current = window.requestAnimationFrame(() => {
      sceneRef.current?.style.setProperty('--core-x', `${offsetX}px`)
      sceneRef.current?.style.setProperty('--core-y', `${offsetY}px`)
      animationFrameRef.current = null
    })
  }

  const handlePointerLeave = () => {
    sceneRef.current?.style.setProperty('--core-x', '0px')
    sceneRef.current?.style.setProperty('--core-y', '0px')
  }

  return (
    <div
      ref={sceneRef}
      className='ai-core-scene'
      aria-label={props.ariaLabel}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div aria-hidden='true' className='ai-core-spotlight' />
      <div aria-hidden='true' className='ai-core-orbit ai-core-orbit-outer' />
      <div aria-hidden='true' className='ai-core-orbit ai-core-orbit-middle' />
      <div aria-hidden='true' className='ai-core-orbit ai-core-orbit-inner' />

      <svg
        aria-hidden='true'
        className='ai-core-data-flow'
        viewBox='0 0 600 600'
      >
        <g className='ai-core-link-lines'>
          <path d='M130 100 L300 300' />
          <path d='M490 145 L300 300' />
          <path d='M92 332 L300 300' />
          <path d='M505 340 L300 300' />
          <path d='M155 510 L300 300' />
          <path d='M455 505 L300 300' />
        </g>
        <g className='ai-core-flow-dots'>
          <circle r='3'>
            <animateMotion
              dur='8s'
              path='M130 100 L300 300'
              repeatCount='indefinite'
            />
          </circle>
          <circle r='3'>
            <animateMotion
              begin='2.8s'
              dur='10s'
              path='M505 340 L300 300'
              repeatCount='indefinite'
            />
          </circle>
          <circle r='3'>
            <animateMotion
              begin='5.4s'
              dur='11s'
              path='M155 510 L300 300'
              repeatCount='indefinite'
            />
          </circle>
        </g>
      </svg>

      <div className='ai-core-node ai-core-center'>
        <span className='ai-core-center-kicker'>AI CORE</span>
        <strong>chyyds.com</strong>
        <span className='ai-core-center-label'>{props.gatewayLabel}</span>
        <span className='ai-core-online'>
          <span aria-hidden='true' className='ai-core-online-dot' />
          {props.onlineLabel}
        </span>
      </div>

      {PROVIDERS.map((provider) => (
        <div
          key={provider.id}
          className={`ai-core-node ai-core-provider ai-core-provider-${provider.position}`}
        >
          <span className='ai-core-provider-icon'>
            {getLobeIcon(provider.icon, 23)}
          </span>
          <span>{provider.name}</span>
        </div>
      ))}
    </div>
  )
}
