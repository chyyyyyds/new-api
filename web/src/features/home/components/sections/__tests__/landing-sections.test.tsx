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

import { Hero } from '../hero'
import { HowItWorks } from '../how-it-works'

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
  AnimateInView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
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
  test('shows only the four requested providers around chyyds.com', () => {
    render(<Hero isAuthenticated={false} />)

    expect(screen.getByText('chyyds.com')).toBeInTheDocument()
    expect(screen.getByText('GPT')).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('Gemini')).toBeInTheDocument()
    expect(screen.getByText('GLM')).toBeInTheDocument()
    expect(screen.queryByText(/Kimi/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Embeddings/i)).not.toBeInTheDocument()
  })

  test('uses chyyds.com in the quick-start API example', () => {
    const { container } = render(<HowItWorks />)

    expect(container.textContent).toContain('https://chyyds.com/v1')
    expect(container.textContent).not.toContain('cun.ai')
  })
})
