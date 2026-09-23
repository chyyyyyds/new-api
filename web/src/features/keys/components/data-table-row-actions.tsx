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
import type { Row } from '@tanstack/react-table'
import {
  Trash2,
  Edit,
  Power,
  PowerOff,
  ArrowUpToLine,
  Loader2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { updateApiKeyStatus } from '../api'
import { API_KEY_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import { apiKeySchema } from '../types'
import { useApiKeys } from './api-keys-provider'

function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (status.server_address) return status.server_address as string
    }
  } catch {
    /* empty */
  }
  return window.location.origin
}

function buildQuickCCSwitchURL(
  apiKey: string,
  keyName?: string,
  modelLimits?: string
): string {
  const serverAddress = getServerAddress()
  const systemName =
    useSystemConfigStore.getState().config.systemName ||
    (function () {
      try {
        const raw = localStorage.getItem('status')
        if (raw) {
          const s = JSON.parse(raw)
          if (s.system_name) return s.system_name as string
        }
      } catch {
        /* empty */
      }
      return keyName || 'FluxAI'
    })()

  // 判断应用类型与默认模型
  let app = 'codex'
  let defaultModel = 'gpt-5.5'
  const lowerLimits = (modelLimits || '').toLowerCase()
  const lowerName = (keyName || '').toLowerCase()

  if (
    lowerLimits.includes('claude') ||
    lowerName.includes('claude') ||
    lowerName.includes('anthropic')
  ) {
    app = 'claude'
    defaultModel = 'claude-3-7-sonnet-20250219'
  } else if (modelLimits) {
    const firstModel = modelLimits.split(',')[0]?.trim()
    if (firstModel) defaultModel = firstModel
  }

  const script = `({
  request: {
    url: "{{baseUrl}}/v1/usage",
    method: "GET",
    headers: { "Authorization": "Bearer {{apiKey}}" }
  },
  extractor: function(response) {
    if (typeof response === "string") { response = JSON.parse(response); }
    return {
      isValid: true,
      remaining: response.remaining ?? response.balance ?? 0,
      used: response.used ?? 0,
      total: response.total ?? 0,
      unit: response.unit || "USD"
    };
  }
})`

  const usageScriptBase64 =
    typeof window !== 'undefined' && typeof window.btoa === 'function'
      ? window.btoa(unescape(encodeURIComponent(script)))
      : ''

  const endpoint = app === 'codex' ? `${serverAddress}/v1` : serverAddress

  const params = new URLSearchParams()
  params.set('resource', 'provider')
  params.set('app', app)
  params.set('name', systemName)
  params.set('endpoint', endpoint)
  params.set('apiKey', apiKey.startsWith('sk-') ? apiKey : `sk-${apiKey}`)
  params.set('homepage', serverAddress)
  params.set('model', defaultModel)
  params.set('enabled', 'true')
  params.set('usageEnabled', 'true')
  if (usageScriptBase64) {
    params.set('usageScript', usageScriptBase64)
  }

  return `ccswitch://v1/import?${params.toString()}`
}

type DataTableRowActionsProps<TData> = {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()
  const apiKey = apiKeySchema.parse(row.original)
  const {
    setOpen,
    setCurrentRow,
    triggerRefresh,
    resolveRealKey,
    loadingKeys,
  } = useApiKeys()
  const isEnabled = apiKey.status === API_KEY_STATUS.ENABLED
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const isRealKeyLoading = Boolean(loadingKeys[apiKey.id])

  const toggleLabel = isEnabled ? t('Disable') : t('Enable')

  const handleImportToCCS = async () => {
    setIsImporting(true)
    try {
      const realKey = await resolveRealKey(apiKey.id)
      if (!realKey) {
        toast.error(t('Failed to resolve API key'))
        return
      }
      const url = buildQuickCCSwitchURL(
        realKey,
        apiKey.name,
        apiKey.model_limits ?? undefined
      )

      const a = document.createElement('a')
      a.href = url
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      toast.success(t('Opening CC Switch...'))
    } catch {
      toast.error(t('Failed to open CC Switch'))
    } finally {
      setIsImporting(false)
    }
  }

  const handleToggleStatus = async (
    event?: React.MouseEvent<HTMLButtonElement>
  ) => {
    event?.stopPropagation()
    const newStatus = isEnabled
      ? API_KEY_STATUS.DISABLED
      : API_KEY_STATUS.ENABLED

    setIsTogglingStatus(true)
    try {
      const result = await updateApiKeyStatus(apiKey.id, newStatus)
      if (result.success) {
        const message = isEnabled
          ? t(SUCCESS_MESSAGES.API_KEY_DISABLED)
          : t(SUCCESS_MESSAGES.API_KEY_ENABLED)
        toast.success(message)
        triggerRefresh()
      } else {
        handleServerError(result, t(ERROR_MESSAGES.STATUS_UPDATE_FAILED))
      }
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsTogglingStatus(false)
    }
  }

  let statusIcon = <Power className='size-3.5' />
  if (isTogglingStatus) {
    statusIcon = <Loader2 className='size-3.5 animate-spin' />
  } else if (isEnabled) {
    statusIcon = <PowerOff className='size-3.5' />
  }

  return (
    <div className='-ml-1 flex items-center gap-1.5 py-0.5'>
      {/* 1. 导入到 CCS */}
      <button
        type='button'
        onClick={() => void handleImportToCCS()}
        disabled={isImporting || isRealKeyLoading}
        className='group text-muted-foreground hover:text-primary hover:bg-muted/60 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-1.5 py-1 transition-colors disabled:opacity-50'
        title={t('Import to CCS')}
      >
        {isImporting ? (
          <Loader2 className='size-3.5 animate-spin' />
        ) : (
          <ArrowUpToLine className='size-3.5 transition-transform group-hover:scale-110' />
        )}
        <span className='text-[11px] leading-none font-normal whitespace-nowrap'>
          {t('Import to CCS')}
        </span>
      </button>

      {/* 2. 禁用 / 启用 */}
      <button
        type='button'
        onClick={(e) => void handleToggleStatus(e)}
        disabled={isTogglingStatus}
        className={cn(
          'group flex flex-col items-center justify-center gap-1 px-1.5 py-1 transition-colors cursor-pointer rounded-md hover:bg-muted/60 disabled:opacity-50',
          isEnabled
            ? 'text-muted-foreground hover:text-destructive'
            : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
        )}
        title={toggleLabel}
      >
        <span className='transition-transform group-hover:scale-110'>
          {statusIcon}
        </span>
        <span className='text-[11px] leading-none font-normal whitespace-nowrap'>
          {toggleLabel}
        </span>
      </button>

      {/* 3. 编辑 */}
      <button
        type='button'
        onClick={() => {
          setCurrentRow(apiKey)
          setOpen('update')
        }}
        className='group text-muted-foreground hover:text-foreground hover:bg-muted/60 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-1.5 py-1 transition-colors'
        title={t('Edit')}
      >
        <Edit className='size-3.5 transition-transform group-hover:scale-110' />
        <span className='text-[11px] leading-none font-normal whitespace-nowrap'>
          {t('Edit')}
        </span>
      </button>

      {/* 4. 删除 */}
      <button
        type='button'
        onClick={() => {
          setCurrentRow(apiKey)
          setOpen('delete')
        }}
        className='group text-muted-foreground hover:text-destructive hover:bg-muted/60 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-1.5 py-1 transition-colors'
        title={t('Delete')}
      >
        <Trash2 className='size-3.5 transition-transform group-hover:scale-110' />
        <span className='text-[11px] leading-none font-normal whitespace-nowrap'>
          {t('Delete')}
        </span>
      </button>
    </div>
  )
}
