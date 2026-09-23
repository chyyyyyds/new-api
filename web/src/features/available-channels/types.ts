export type AvailableChannelGroup = {
  name: string
  ratio: number
  models: string[]
}

export type AvailableChannelPlatform = {
  platform: string
  groups: AvailableChannelGroup[]
  models: string[]
}

export type GetAvailableChannelsResponse = {
  success: boolean
  message: string
  data: AvailableChannelPlatform[]
}
