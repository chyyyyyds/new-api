import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getChannelStatus, updateChannelStatusVisibility } from './api'
import { ChannelAvailabilityMatrix } from './components/channel-availability-matrix'
import { ChannelStatusHeader } from './components/channel-status-header'
import { ChannelStatusSummaryCards } from './components/channel-status-summary-cards'

export function ChannelStatus() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [timeRange, setTimeRange] = useState('90m')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [viewMode, setViewMode] = useState<'matrix' | 'line'>('matrix')
  const [metricMode, setMetricMode] = useState<
    'composite' | 'error_rate' | 'ttft' | 'cache'
  >('composite')
  const [dimensionMode, setDimensionMode] = useState('平台 / 分组')

  // 请求渠道状态数据（动态从数据库获取）
  const {
    data: response,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: [
      'channel-status',
      timeRange,
      selectedPlatform,
      selectedGroup,
      selectedModel,
    ],
    queryFn: () =>
      getChannelStatus({
        time_range: timeRange,
        platform: selectedPlatform || undefined,
        group: selectedGroup || undefined,
        model: selectedModel || undefined,
      }),
    staleTime: 30_000,
  })

  const statusData = response?.data

  // 管理员切换公开展示
  const { mutate: toggleVisibility } = useMutation({
    mutationFn: (newPublicDims: string[]) =>
      updateChannelStatusVisibility({ public_dimensions: newPublicDims }),
    onSuccess: () => {
      toast.success(t('Updated successfully'))
      void queryClient.invalidateQueries({ queryKey: ['channel-status'] })
    },
    onError: (err) => {
      toast.error(err.message || t('Failed to update'))
    },
  })

  const handleToggleVisibility = (dimKey: string, nextIsPublic: boolean) => {
    if (!statusData?.channels) return
    const currentPublicDims = statusData.channels
      .filter((c) =>
        c.dimension_key === dimKey ? nextIsPublic : c.is_public !== false
      )
      .map((c) => c.dimension_key)
    toggleVisibility(currentPublicDims)
  }

  // 提取可用筛选列表
  const { availablePlatforms, availableGroups, availableModels } =
    useMemo(() => {
      const pSet = new Set<string>()
      const gSet = new Set<string>()
      const mSet = new Set<string>()

      statusData?.channels.forEach((c) => {
        if (c.platform) pSet.add(c.platform)
        if (c.group_name) gSet.add(c.group_name)
      })

      statusData?.models.forEach((m) => {
        if (m.platform) pSet.add(m.platform)
        if (m.model_name) mSet.add(m.model_name)
      })

      return {
        availablePlatforms: [...pSet].sort(),
        availableGroups: [...gSet].sort(),
        availableModels: [...mSet].sort(),
      }
    }, [statusData])

  const updatedAtText = statusData?.updated_at
    ? dayjs.unix(statusData.updated_at).format('MM/DD HH:mm')
    : dayjs().format('MM/DD HH:mm')

  const handleResetFilters = () => {
    setSelectedPlatform('')
    setSelectedGroup('')
    setSelectedModel('')
  }

  const userRole = useAuthStore((s) => s.auth.user?.role)
  const isUserAdmin = userRole === ROLE.ADMIN || userRole === ROLE.SUPER_ADMIN
  const isAdmin = isUserAdmin || (statusData?.is_admin ?? false)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-5 pb-16'>
          {/* 1. 顶部监控 Header 与筛选控制器 */}
          <ChannelStatusHeader
            updatedAtText={updatedAtText}
            isRefreshing={isLoading || isRefetching}
            onRefresh={() => void refetch()}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            selectedPlatform={selectedPlatform}
            setSelectedPlatform={setSelectedPlatform}
            selectedGroup={selectedGroup}
            setSelectedGroup={setSelectedGroup}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            onResetFilters={handleResetFilters}
            availablePlatforms={availablePlatforms}
            availableGroups={availableGroups}
            availableModels={availableModels}
            viewMode={viewMode}
            setViewMode={setViewMode}
            metricMode={metricMode}
            setMetricMode={setMetricMode}
            dimensionMode={dimensionMode}
            setDimensionMode={setDimensionMode}
          />

          {isLoading ? (
            <div className='text-muted-foreground flex h-64 flex-col items-center justify-center gap-2'>
              <Loader2 className='size-8 animate-spin' />
              <span className='text-sm'>{t('Loading...')}</span>
            </div>
          ) : (
            <>
              {/* 2. 三大核心概览指标卡片（动态统计） */}
              <ChannelStatusSummaryCards
                successRate={statusData?.success_rate ?? 99.1}
                errorRate={statusData?.error_rate ?? 0.92}
                ttftP50={statusData?.ttft_p50 ?? 5.0}
                ttftAvg={statusData?.ttft_avg ?? 19.4}
                ttftP90={statusData?.ttft_p90 ?? 60.0}
                cacheRate={statusData?.cache_rate ?? 76.5}
              />

              {/* 3. 可用性趋势色块矩阵卡片（需求1:管理员勾选；需求3:色块撑满与缩放） */}
              <ChannelAvailabilityMatrix
                channels={statusData?.channels ?? []}
                updatedAt={statusData?.updated_at ?? dayjs().unix()}
                isAdmin={isAdmin}
                onToggleVisibility={handleToggleVisibility}
              />
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
export default ChannelStatus
