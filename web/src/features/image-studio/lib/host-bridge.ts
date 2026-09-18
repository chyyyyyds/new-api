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
export const NEW_API_CANVAS_READY = 'new-api:canvas-ready'
export const NEW_API_CANVAS_CONFIG = 'new-api:canvas-config'
export const NEW_API_CANVAS_CONFIGURED = 'new-api:canvas-configured'

type CanvasLifecycleMessage = {
  type: typeof NEW_API_CANVAS_READY | typeof NEW_API_CANVAS_CONFIGURED
  version: 1
}

export function createCanvasConfigMessage(baseUrl: string, apiKey: string) {
  return {
    type: NEW_API_CANVAS_CONFIG,
    version: 1,
    baseUrl,
    apiKey,
  } as const
}

export function parseCanvasLifecycleMessage(
  data: unknown
): CanvasLifecycleMessage | null {
  if (!data || typeof data !== 'object') return null
  const candidate = data as Record<string, unknown>
  if (candidate.version !== 1) return null
  if (
    candidate.type !== NEW_API_CANVAS_READY &&
    candidate.type !== NEW_API_CANVAS_CONFIGURED
  ) {
    return null
  }
  return candidate as CanvasLifecycleMessage
}
