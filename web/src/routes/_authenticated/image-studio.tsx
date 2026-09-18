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
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Images, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  createCanvasConfigMessage,
  NEW_API_CANVAS_READY,
  parseCanvasLifecycleMessage,
} from '@/features/image-studio/lib/host-bridge'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/image-studio')({
  component: ImageStudioRoute,
})

function ImageStudioRoute() {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [canvasReady, setCanvasReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectedKeyId, setConnectedKeyId] = useState('')

  const keysQuery = useQuery({
    queryKey: ['image-studio', 'api-keys', userId],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 100 })
      if (!result.success) {
        throw createServerError(result, t('Failed to load API keys'))
      }
      return (result.data?.items ?? []).filter(
        (item) => item.status === API_KEY_STATUS.ENABLED
      )
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  })

  const enabledKeys = keysQuery.data ?? []
  const selectedKey = enabledKeys.find(
    (item) => String(item.id) === selectedKeyId
  )
  const firstEnabledKeyId = enabledKeys[0]?.id

  useEffect(() => {
    if (!selectedKeyId && firstEnabledKeyId !== undefined) {
      setSelectedKeyId(String(firstEnabledKeyId))
    }
  }, [firstEnabledKeyId, selectedKeyId])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow
      ) {
        return
      }
      const message = parseCanvasLifecycleMessage(event.data)
      if (!message) return
      if (message.type === NEW_API_CANVAS_READY) {
        setCanvasReady(true)
        setConnectedKeyId('')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const connectCanvas = async () => {
    if (!selectedKey || !iframeRef.current?.contentWindow) return
    setConnecting(true)
    try {
      const result = await fetchTokenKey(selectedKey.id)
      if (!result.success || !result.data?.key) {
        throw createServerError(result, t('Unable to connect Canvas'))
      }
      const apiKey = result.data.key.startsWith('sk-')
        ? result.data.key
        : `sk-${result.data.key}`
      // API Key 只通过同源窗口消息传递，不进入 URL、历史记录或 Referer。
      iframeRef.current.contentWindow.postMessage(
        createCanvasConfigMessage(
          window.location.origin,
          apiKey,
          selectedKey.name
        ),
        window.location.origin
      )
      setConnectedKeyId(String(selectedKey.id))
    } catch (error) {
      handleServerError(error, t('Unable to connect Canvas'))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='bg-background flex flex-wrap items-center gap-2 border-b px-3 py-2'>
        <div className='mr-1 flex items-center gap-2 text-sm font-medium'>
          <Images className='size-4' aria-hidden='true' />
          {t('Image Studio')}
        </div>

        <NativeSelect
          className='min-w-52'
          value={selectedKeyId}
          disabled={keysQuery.isPending || enabledKeys.length === 0}
          aria-label={t('Select an API key')}
          onChange={(event) => {
            setSelectedKeyId(event.target.value)
            setConnectedKeyId('')
          }}
        >
          <NativeSelectOption value=''>
            {t('Select an API key')}
          </NativeSelectOption>
          {enabledKeys.map((item) => (
            <NativeSelectOption key={item.id} value={String(item.id)}>
              {item.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <Button
          size='sm'
          disabled={!selectedKey || !canvasReady || connecting}
          onClick={() => void connectCanvas()}
        >
          {connecting && <Loader2 className='size-4 animate-spin' />}
          {connectedKeyId === selectedKeyId ? t('Reconnect') : t('Connect')}
        </Button>

        <Button size='sm' variant='outline' render={<Link to='/keys' />}>
          {t('API Keys')}
        </Button>

        {connectedKeyId === selectedKeyId && selectedKey && (
          <span className='text-muted-foreground ml-auto text-xs'>
            {t('Connected to {{name}}', { name: selectedKey.name })}
          </span>
        )}
      </div>

      {!keysQuery.isPending &&
        !keysQuery.isError &&
        enabledKeys.length === 0 && (
          <Alert className='m-3 w-auto'>
            <AlertDescription>
              {t('Create an enabled API key before using Image Studio.')}
            </AlertDescription>
          </Alert>
        )}

      {keysQuery.isError && (
        <Alert variant='destructive' className='m-3 w-auto'>
          <AlertDescription>{t('Failed to load API keys')}</AlertDescription>
        </Alert>
      )}

      {/* Canvas 是固定提交构建的同源应用，需要脚本和同源存储；sandbox 无法在保留这两项能力时提供隔离。 */}
      {/* oxlint-disable-next-line react/iframe-missing-sandbox */}
      <iframe
        ref={iframeRef}
        src='/canvas/image'
        className='min-h-0 flex-1 border-0'
        title={t('Image Studio')}
      />
    </div>
  )
}
