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
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { Features } from '../features'
import { Hero } from '../hero'
import { HowItWorks } from '../how-it-works'
import { Stats } from '../stats'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children?: ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: { docs_link: '/docs' } }),
}))

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: (name: string) => <span>{name}</span>,
}))

vi.mock('@/components/animate-in-view', () => ({
  AnimateInView: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/copy-button', () => ({
  CopyButton: ({ value }: { value: string }) => (
    <button type='button' data-copy-value={value}>
      Copy code
    </button>
  ),
}))

afterEach(() => {
  cleanup()
})

describe('landing page sections', () => {
  test('shows the six primary providers around chyyds.com', () => {
    render(<Hero isAuthenticated={false} />)

    expect(screen.getByText('chyyds.com')).toBeInTheDocument()
    expect(screen.getByText('GPT')).toBeInTheDocument()
    expect(screen.getAllByText('Claude').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Gemini').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DeepSeek').length).toBeGreaterThan(0)
    expect(screen.getAllByText('GLM').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Qwen').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Kimi/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Embeddings/i)).not.toBeInTheDocument()
  })

  test('uses chyyds.com in the quick-start API example', () => {
    const { container } = render(<HowItWorks />)

    expect(container.textContent).toContain('https://chyyds.com/v1')
    expect(container.textContent).toContain('/v1/chat/completions')
    expect(container.textContent).toContain('Responses API')
    expect(container.textContent).toContain('Streaming')
    expect(container.textContent).not.toContain('cun.ai')
  })

  test('presents metrics in one infrastructure status panel', () => {
    const { container } = render(<Stats />)

    expect(container.querySelectorAll('.home-status-panel')).toHaveLength(1)
    expect(container.querySelectorAll('.home-status-metric')).toHaveLength(4)
    expect(screen.getByText('99.9%')).toBeInTheDocument()
  })

  test('uses a varied bento layout for the core capabilities', () => {
    const { container } = render(<Features />)

    expect(container.querySelectorAll('.home-bento-card')).toHaveLength(5)
    expect(screen.getByText('Global AI Network')).toBeInTheDocument()
    expect(screen.getByText('Transparent Billing')).toBeInTheDocument()
    expect(screen.getByText('Secure by Design')).toBeInTheDocument()
  })
})
