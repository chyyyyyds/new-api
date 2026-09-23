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

import { getEffectiveModelPerf } from '../model-perf'

describe('getEffectiveModelPerf', () => {
  it('为没有数据的模型分别随机生成状态(>=97%)、延迟(20-30s之内)、吞吐(30-40之间)', () => {
    const perf1 = getEffectiveModelPerf('claude-fable-5')

    // 状态需在 97% 以上
    expect(perf1.success_rate).toBeGreaterThanOrEqual(97)
    expect(perf1.success_rate).toBeLessThanOrEqual(100)

    // 延迟需在 20-30s 之内 (对应毫秒 20000ms ~ 30000ms)
    expect(perf1.avg_latency_ms).toBeGreaterThanOrEqual(20000)
    expect(perf1.avg_latency_ms).toBeLessThanOrEqual(30000)

    // 吞吐需在 30-40 之间
    expect(perf1.avg_tps).toBeGreaterThanOrEqual(30)
    expect(perf1.avg_tps).toBeLessThanOrEqual(40)

    // 状态点序列需生成 24 个有效点
    expect(perf1.recent_success_series).toHaveLength(24)
    for (const point of perf1.recent_success_series ?? []) {
      expect(point.success_rate).toBeGreaterThanOrEqual(0)
      expect(point.success_rate).toBeLessThanOrEqual(100)
    }
  })

  it('约四分之三的无数据模型包含约十分之一的不健康时段', () => {
    const modelNames = Array.from(
      { length: 40 },
      (_, index) => `unused-model-${index + 1}`
    )
    const unhealthyCounts = modelNames.map((modelName) => {
      const perf = getEffectiveModelPerf(modelName)
      return (perf.recent_success_series ?? []).filter(
        (point) => point.success_rate < 90
      ).length
    })

    expect(unhealthyCounts.filter((count) => count > 0)).toHaveLength(30)
    for (const count of unhealthyCounts) {
      expect([0, 2, 3]).toContain(count)
    }
  })

  it('不同模型分别独立随机，不使用同一组随机数据', () => {
    const perf1 = getEffectiveModelPerf('claude-fable-5')
    const perf2 = getEffectiveModelPerf('claude-fable-5-1')
    const perf3 = getEffectiveModelPerf('claude-haiku-4-5-20251001')

    // 三个模型的指标不完全相同
    const isIdentical =
      perf1.avg_latency_ms === perf2.avg_latency_ms &&
      perf1.avg_tps === perf2.avg_tps &&
      perf1.success_rate === perf2.success_rate

    expect(isIdentical).toBe(false)

    const isIdentical23 =
      perf2.avg_latency_ms === perf3.avg_latency_ms &&
      perf2.avg_tps === perf3.avg_tps &&
      perf2.success_rate === perf3.success_rate

    expect(isIdentical23).toBe(false)
  })

  it('相同模型多次获取结果稳定一致，避免页面重新渲染时数字闪烁', () => {
    const perfA1 = getEffectiveModelPerf('gpt-4o')
    const perfA2 = getEffectiveModelPerf('gpt-4o')

    expect(perfA1.success_rate).toBe(perfA2.success_rate)
    expect(perfA1.avg_latency_ms).toBe(perfA2.avg_latency_ms)
    expect(perfA1.avg_tps).toBe(perfA2.avg_tps)
    expect(perfA1.recent_success_series).toEqual(perfA2.recent_success_series)
  })

  it('仅当指标获取不到时才做随机，已有指标严格保持真实数据不覆盖', () => {
    // 只有状态有真实数据 (例如 88.5%)，延迟和吞吐缺失
    const partialPerf1 = getEffectiveModelPerf('test-model-1', {
      success_rate: 88.5,
    })
    expect(partialPerf1.success_rate).toBe(88.5) // 保留真实状态，不随机
    expect(partialPerf1.avg_latency_ms).toBeGreaterThanOrEqual(20000) // 延迟缺失则随机生成
    expect(partialPerf1.avg_latency_ms).toBeLessThanOrEqual(30000)
    expect(partialPerf1.avg_tps).toBeGreaterThanOrEqual(30) // 吞吐缺失则随机生成
    expect(partialPerf1.avg_tps).toBeLessThanOrEqual(40)

    // 只有延迟有真实数据 (例如 1500ms)，状态和吞吐缺失
    const partialPerf2 = getEffectiveModelPerf('test-model-2', {
      avg_latency_ms: 1500,
    })
    expect(partialPerf2.avg_latency_ms).toBe(1500) // 保留真实延迟
    expect(partialPerf2.success_rate).toBeGreaterThanOrEqual(97) // 状态随机
    expect(partialPerf2.avg_tps).toBeGreaterThanOrEqual(30) // 吞吐随机

    // 只有吞吐有真实数据 (例如 18.2)，状态和延迟缺失
    const partialPerf3 = getEffectiveModelPerf('test-model-3', {
      avg_tps: 18.2,
    })
    expect(partialPerf3.avg_tps).toBe(18.2) // 保留真实吞吐
    expect(partialPerf3.success_rate).toBeGreaterThanOrEqual(97) // 状态随机
    expect(partialPerf3.avg_latency_ms).toBeGreaterThanOrEqual(20000) // 延迟随机

    // 全部都有真实数据时，完全不被覆盖
    const completePerf = {
      avg_latency_ms: 800,
      avg_tps: 55,
      success_rate: 92.5,
      recent_success_series: [{ ts: 1700000000, success_rate: 92.5 }],
    }
    const result = getEffectiveModelPerf('test-model-4', completePerf)
    expect(result).toEqual(completePerf)
  })
})
