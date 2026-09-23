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
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { useTopNavLinks } from '../use-top-nav-links'

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({
    status: {
      header_nav_modules: JSON.stringify({
        home: true,
        console: true,
        pricing: { enabled: true, requireAuth: false },
        rankings: { enabled: true, requireAuth: false },
        docs: true,
        about: true,
      }),
      docs_link: 'https://docs.example.com',
    },
  }),
}))

describe('useTopNavLinks 导航栏显示与隐藏规则', () => {
  beforeEach(() => {
    useAuthStore.setState({
      auth: {
        ...useAuthStore.getState().auth,
        accessToken: null,
        user: null,
      },
    })
  })

  it('未登录访客看不到排行榜、文档、关于', () => {
    const { result } = renderHook(() => useTopNavLinks())
    const titles = result.current.map((link) => link.title)

    expect(titles).not.toContain('Rankings')
    expect(titles).not.toContain('Docs')
    expect(titles).not.toContain('About')
    expect(titles).toContain('Home')
    expect(titles).toContain('Console')
    expect(titles).toContain('Model Square')
  })

  it('普通登录用户 (Role 1) 看不到排行榜、文档、关于', () => {
    useAuthStore.setState({
      auth: {
        ...useAuthStore.getState().auth,
        accessToken: 'user-token',
        user: {
          id: 2,
          username: 'normal_user',
          role: ROLE.USER,
        },
      },
    })

    const { result } = renderHook(() => useTopNavLinks())
    const titles = result.current.map((link) => link.title)

    expect(titles).not.toContain('Rankings')
    expect(titles).not.toContain('Docs')
    expect(titles).not.toContain('About')
  })

  it('管理员用户 (Role 10) 看不到排行榜、文档、关于', () => {
    useAuthStore.setState({
      auth: {
        ...useAuthStore.getState().auth,
        accessToken: 'admin-token',
        user: {
          id: 3,
          username: 'admin_user',
          role: ROLE.ADMIN,
        },
      },
    })

    const { result } = renderHook(() => useTopNavLinks())
    const titles = result.current.map((link) => link.title)

    expect(titles).not.toContain('Rankings')
    expect(titles).not.toContain('Docs')
    expect(titles).not.toContain('About')
  })

  it('超级管理员 (Root User / Role 100) 登录后能看到排行榜，看不到文档和关于', () => {
    useAuthStore.setState({
      auth: {
        ...useAuthStore.getState().auth,
        accessToken: 'root-token',
        user: {
          id: 1,
          username: 'root',
          role: ROLE.SUPER_ADMIN,
        },
      },
    })

    const { result } = renderHook(() => useTopNavLinks())
    const titles = result.current.map((link) => link.title)

    // 只有超级管理员能看到排行榜
    expect(titles).toContain('Rankings')
    // 文档与关于依然对所有人隐藏
    expect(titles).not.toContain('Docs')
    expect(titles).not.toContain('About')
  })
})
