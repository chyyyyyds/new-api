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
import { createFileRoute } from '@tanstack/react-router'
import { Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmbeddedCanvasStudio } from '@/features/image-studio/components/embedded-canvas-studio'
import type { CanvasStudioDefaults } from '@/features/image-studio/lib/host-bridge'

const LEGACY_VIDEO_DEFAULTS: CanvasStudioDefaults = {
  studio: 'video',
  preferredModel: 'seedance-2.0-fast-720p-c5',
  videoSeconds: '10',
  videoResolution: '720',
  videoSize: '1280x720',
}

const STABLE_VIDEO_DEFAULTS: CanvasStudioDefaults = {
  studio: 'video',
  preferredModel: 'seedance-2.5',
  videoSeconds: '14',
  videoResolution: '720',
  videoSize: '16:9',
}

function resolveVideoDefaults(keyName: string) {
  return keyName === '视频生成（稳定版）'
    ? STABLE_VIDEO_DEFAULTS
    : LEGACY_VIDEO_DEFAULTS
}

export const Route = createFileRoute('/_authenticated/video-studio')({
  component: VideoStudioRoute,
})

function VideoStudioRoute() {
  const { t } = useTranslation()
  return (
    <EmbeddedCanvasStudio
      title={t('Video Studio')}
      icon={Video}
      iframePath='/canvas/video'
      preferredKeyName='seedance视频生成'
      fallbackKeyFragment='seedance'
      resolveDefaults={resolveVideoDefaults}
      emptyKeyMessage={t(
        'Create an enabled API key before using Video Studio.'
      )}
      defaults={LEGACY_VIDEO_DEFAULTS}
    />
  )
}
