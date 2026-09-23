import { createFileRoute } from '@tanstack/react-router'

import { AvailableChannels } from '@/features/available-channels'

export const Route = createFileRoute('/_authenticated/available-channels')({
  component: AvailableChannels,
})
