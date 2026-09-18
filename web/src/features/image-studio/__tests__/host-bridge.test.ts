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
import { describe, expect, it } from 'vitest'

import {
  createCanvasConfigMessage,
  NEW_API_CANVAS_CONFIG,
  NEW_API_CANVAS_READY,
  parseCanvasLifecycleMessage,
} from '../lib/host-bridge'

describe('image studio host bridge', () => {
  it('creates a versioned Canvas configuration message', () => {
    expect(
      createCanvasConfigMessage(
        'https://api.example.com',
        'sk-image-key',
        '图图',
        'user-42'
      )
    ).toEqual({
      type: NEW_API_CANVAS_CONFIG,
      version: 1,
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-image-key',
      channelName: '图图',
      historyScope: 'user-42',
    })
  })

  it('accepts only supported lifecycle messages', () => {
    expect(
      parseCanvasLifecycleMessage({
        type: NEW_API_CANVAS_READY,
        version: 1,
      })
    ).toEqual({ type: NEW_API_CANVAS_READY, version: 1 })
    expect(
      parseCanvasLifecycleMessage({ type: NEW_API_CANVAS_READY, version: 2 })
    ).toBeNull()
    expect(
      parseCanvasLifecycleMessage({ type: 'new-api:unknown', version: 1 })
    ).toBeNull()
  })
})
