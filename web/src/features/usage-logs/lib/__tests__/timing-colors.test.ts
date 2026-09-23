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
  getFirstResponseTimeColor,
  getResponseTimeColor,
  getTimeColor,
} from '../format'

describe('首字与耗时健康颜色规则', () => {
  describe('getFirstResponseTimeColor (首字响应时间)', () => {
    it('首字小于等于16秒时为健康色绿色(success)', () => {
      expect(getFirstResponseTimeColor(0.5)).toBe('success')
      expect(getFirstResponseTimeColor(5.0)).toBe('success')
      expect(getFirstResponseTimeColor(15.5)).toBe('success')
      expect(getFirstResponseTimeColor(16.0)).toBe('success')
    })

    it('首字大于16秒时为警告(warning)或危险(danger)', () => {
      expect(getFirstResponseTimeColor(16.1)).toBe('warning')
      expect(getFirstResponseTimeColor(22.1)).toBe('warning')
      expect(getFirstResponseTimeColor(29.9)).toBe('warning')
      expect(getFirstResponseTimeColor(30.0)).toBe('danger')
      expect(getFirstResponseTimeColor(43.3)).toBe('danger')
    })
  })

  describe('getTimeColor (纯耗时时长)', () => {
    it('耗时小于等于40秒时为健康色绿色(success)', () => {
      expect(getTimeColor(1)).toBe('success')
      expect(getTimeColor(29)).toBe('success')
      expect(getTimeColor(40)).toBe('success')
    })

    it('耗时大于40秒时为警告(warning)或危险(danger)', () => {
      expect(getTimeColor(40.1)).toBe('warning')
      expect(getTimeColor(59.9)).toBe('warning')
      expect(getTimeColor(60)).toBe('danger')
      expect(getTimeColor(90)).toBe('danger')
    })
  })

  describe('getResponseTimeColor (综合响应耗时)', () => {
    it('耗时小于等于40秒时无论输出token数量多少均为健康色绿色(success)', () => {
      // 截图第一行场景：耗时 29.0s，输出 675 tokens
      expect(getResponseTimeColor(29.0, 675)).toBe('success')
      // 低输出 token (<100) 场景，耗时 <= 40s 也为 success
      expect(getResponseTimeColor(35.0, 50)).toBe('success')
      // 临界点 40s
      expect(getResponseTimeColor(40.0, 10)).toBe('success')
    })

    it('耗时大于40秒时按吞吐量或时长判断', () => {
      // 耗时 47s 但输出了 2166 tokens (流速 46 t/s >= 30) -> success
      expect(getResponseTimeColor(47.0, 2166)).toBe('success')
      // 耗时 42s 输出 835 tokens (流速 19.8 t/s) -> warning
      expect(getResponseTimeColor(42.0, 835)).toBe('warning')
      // 耗时 68s (1m 8s) 输出 244 tokens (流速 3.6 t/s < 15) -> danger
      expect(getResponseTimeColor(68.0, 244)).toBe('danger')
    })
  })
})
