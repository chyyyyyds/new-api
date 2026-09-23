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
import { Images } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmbeddedCanvasStudio } from '@/features/image-studio/components/embedded-canvas-studio'

export const Route = createFileRoute('/_authenticated/image-studio')({
  component: ImageStudioRoute,
})

function ImageStudioRoute() {
  const { t } = useTranslation()
  return (
    <EmbeddedCanvasStudio
      title={t('Image Studio')}
      icon={Images}
      iframePath='/canvas/image'
      preferredKeyName='image2生图'
      fallbackKeyFragment='生图'
      emptyKeyMessage={t(
        'Create an enabled API key before using Image Studio.'
      )}
      defaults={{ studio: 'image' }}
    />
  )
}
