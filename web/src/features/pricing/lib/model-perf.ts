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
import type { SuccessRatePoint } from '@/features/performance-metrics/types'

import type { ModelPerfBadgeData } from '../components/model-perf-badge'

/**
 * 32 位 FNV-1a 字符串哈希算法
 * 将模型名称转换为整数种子，确保同一模型在相同输入下产生稳定离散的哈希值
 */
function hashString(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Mulberry32 伪随机数生成器 (PRNG)
 * 基于种子返回 [0, 1) 之间的均匀分布随机浮点数
 */
function createPrng(seed: number) {
  let s = seed
  return function () {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 获取或随机补齐模型性能指标
 *
 * 规则：
 * 1. 各个模型分别独立随机，基于模型名称生成独立伪随机种子，保证稳定且互不相同
 * 2. 只有获取不到对应数据时才补齐随机值：
 *    - 状态 (success_rate)：要 97% 以上 (97.0% ~ 99.9%)
 *    - 延迟 (avg_latency_ms)：要 20-30s 之内 (20000ms ~ 30000ms)
 *    - 吞吐 (avg_tps)：要 30-40 之间 (30.0 ~ 40.0)
 *    - 24 小时状态序列：约四分之三的模型含 2~3 个不健康时段，其余时段保持高成功率
 * 3. 若某个指标原本已有真实数据，则严格保留真实数据，不做覆盖
 */
export function getEffectiveModelPerf(
  modelName: string,
  realPerf?: Partial<ModelPerfBadgeData> | null
): ModelPerfBadgeData {
  // 步骤 1：判断各指标是否已有有效数据
  const hasSuccessRate =
    realPerf?.success_rate != null &&
    Number.isFinite(realPerf.success_rate) &&
    realPerf.success_rate >= 0 &&
    realPerf.success_rate <= 100

  const hasLatency =
    realPerf?.avg_latency_ms != null &&
    Number.isFinite(realPerf.avg_latency_ms) &&
    realPerf.avg_latency_ms > 0

  const hasTps =
    realPerf?.avg_tps != null &&
    Number.isFinite(realPerf.avg_tps) &&
    realPerf.avg_tps > 0

  const hasSeries =
    realPerf?.recent_success_series != null &&
    Array.isArray(realPerf.recent_success_series) &&
    realPerf.recent_success_series.length > 0

  // 若全部指标均有数据，直接返回
  if (hasSuccessRate && hasLatency && hasTps && hasSeries) {
    return realPerf as ModelPerfBadgeData
  }

  // 步骤 2：初始化模型专属伪随机数生成器（按模型名独立散列）
  const modelSeed = hashString(modelName || 'default_model')
  const rng = createPrng(modelSeed)

  // 步骤 3：状态（成功率）处理 - 缺失时随机生成 97% 以上 (97.0% ~ 99.9%)
  let finalSuccessRate: number
  if (hasSuccessRate) {
    finalSuccessRate = realPerf?.success_rate ?? 0
  } else {
    // 随机 97.0% ~ 99.9%，保留 1 位小数
    const randomRate = 97 + rng() * 2.9
    finalSuccessRate = Math.round(randomRate * 10) / 10
  }

  // 步骤 4：延迟处理 - 缺失时随机生成 20-30s 之内 (以毫秒存储 20000ms ~ 29900ms)
  let finalLatencyMs: number
  if (hasLatency) {
    finalLatencyMs = realPerf?.avg_latency_ms ?? 0
  } else {
    // 随机 20.0s ~ 29.9s 之间的秒数，转换为毫秒
    const randomSeconds = 20 + rng() * 9.9
    finalLatencyMs = Math.round(randomSeconds * 100) * 10
  }

  // 步骤 5：吞吐处理 - 缺失时随机生成 30-40 之间 (30.0 ~ 40.0)
  let finalTps: number
  if (hasTps) {
    finalTps = realPerf?.avg_tps ?? 0
  } else {
    // 随机 30.0 ~ 40.0 之间，保留 1 位小数
    const randomTps = 30 + rng() * 10
    finalTps = Math.round(randomTps * 10) / 10
  }

  // 步骤 6：近 24 小时状态点序列 - 缺失时生成少量稳定的异常时段，避免全绿过于理想化
  let finalSeries: SuccessRatePoint[]
  if (hasSeries) {
    finalSeries = realPerf?.recent_success_series ?? []
  } else {
    const currentHourStart = Math.floor(Date.now() / 1000 / 3600) * 3600
    // 状态序列使用独立随机源，避免实时指标是否缺失导致色块位置变动
    const seriesRng = createPrng(modelSeed ^ 0x9e3779b9)
    const hasUnhealthySlots = modelSeed % 4 !== 0
    // 24 个时段中 2~3 个约占 10%，用独立模型种子确保结果稳定
    let unhealthySlotCount = 0
    if (hasUnhealthySlots) {
      unhealthySlotCount = seriesRng() < 0.4 ? 3 : 2
    }
    const unhealthySlots = new Set<number>()
    while (unhealthySlots.size < unhealthySlotCount) {
      unhealthySlots.add(Math.floor(seriesRng() * 24))
    }

    finalSeries = []
    for (let slot = 0; slot < 24; slot++) {
      const ts = currentHourStart - (23 - slot) * 3600
      let rate: number
      if (unhealthySlots.has(slot)) {
        // 大部分是需关注的波动，少量为明显异常，更接近真实运行曲线
        const isCritical = seriesRng() < 0.2
        const lowerBound = isCritical ? 55 : 72
        const range = isCritical ? 15 : 18
        rate = Math.round((lowerBound + seriesRng() * range) * 10) / 10
      } else {
        // 健康时段围绕模型的综合成功率微小浮动
        const fluctuation = (seriesRng() - 0.5) * 1.5
        rate = Math.min(
          100,
          Math.max(97, Math.round((finalSuccessRate + fluctuation) * 10) / 10)
        )
      }
      finalSeries.push({ ts, success_rate: rate })
    }
  }

  return {
    ...realPerf,
    avg_latency_ms: finalLatencyMs,
    success_rate: finalSuccessRate,
    avg_tps: finalTps,
    recent_success_series: finalSeries,
  }
}
