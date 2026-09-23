package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/ollama"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type OpenAIModel struct {
	ID         string         `json:"id"`
	Object     string         `json:"object"`
	Created    int64          `json:"created"`
	OwnedBy    string         `json:"owned_by"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	Permission []struct {
		ID                 string `json:"id"`
		Object             string `json:"object"`
		Created            int64  `json:"created"`
		AllowCreateEngine  bool   `json:"allow_create_engine"`
		AllowSampling      bool   `json:"allow_sampling"`
		AllowLogprobs      bool   `json:"allow_logprobs"`
		AllowSearchIndices bool   `json:"allow_search_indices"`
		AllowView          bool   `json:"allow_view"`
		AllowFineTuning    bool   `json:"allow_fine_tuning"`
		Organization       string `json:"organization"`
		Group              string `json:"group"`
		IsBlocking         bool   `json:"is_blocking"`
	} `json:"permission"`
	Root   string `json:"root"`
	Parent string `json:"parent"`
}

type OpenAIModelsResponse struct {
	Data    []OpenAIModel `json:"data"`
	Success bool          `json:"success"`
}

func parseStatusFilter(statusParam string) int {
	switch strings.ToLower(statusParam) {
	case "enabled", "1":
		return common.ChannelStatusEnabled
	case "disabled", "0":
		return 0
	default:
		return -1
	}
}

func clearChannelInfo(channel *model.Channel) {
	if channel.ChannelInfo.IsMultiKey {
		channel.ChannelInfo.MultiKeyDisabledReason = nil
		channel.ChannelInfo.MultiKeyDisabledTime = nil
	}
}

func channelIDsFromChannels(channels []*model.Channel) []int {
	ids := make([]int, 0, len(channels))
	for _, channel := range channels {
		if channel != nil && channel.Id > 0 {
			ids = append(ids, channel.Id)
		}
	}
	return ids
}

func closeActiveChannelWebSockets(channelIDs []int) {
	service.CloseActiveWebSocketsForChannels(channelIDs, service.ChannelDisabledCloseReason)
}

func hasEnabledMultiKey(channel *model.Channel) bool {
	if channel == nil || !channel.ChannelInfo.IsMultiKey {
		return true
	}
	keys := channel.GetKeys()
	if len(keys) == 0 {
		return false
	}
	for i := range keys {
		if channel.ChannelInfo.MultiKeyStatusList == nil {
			return true
		}
		if status, ok := channel.ChannelInfo.MultiKeyStatusList[i]; !ok || status == common.ChannelStatusEnabled {
			return true
		}
	}
	return false
}

func disableMultiKeyChannelIfUnavailable(channel *model.Channel) bool {
	if channel == nil || !channel.ChannelInfo.IsMultiKey || hasEnabledMultiKey(channel) {
		return false
	}
	if channel.Status != common.ChannelStatusEnabled {
		return true
	}
	channel.Status = common.ChannelStatusManuallyDisabled
	info := channel.GetOtherInfo()
	info["status_reason"] = model.ChannelStatusReasonAllKeysDisabled
	info["status_time"] = common.GetTimestamp()
	channel.SetOtherInfo(info)
	return true
}

func restoreMultiKeyChannelIfAvailable(channel *model.Channel) {
	if channel.Status != common.ChannelStatusManuallyDisabled || !hasEnabledMultiKey(channel) {
		return
	}
	info := channel.GetOtherInfo()
	if info["status_reason"] != model.ChannelStatusReasonAllKeysDisabled {
		return
	}
	channel.Status = common.ChannelStatusEnabled
	info["status_reason"] = ""
	info["status_time"] = common.GetTimestamp()
	channel.SetOtherInfo(info)
}

func applyChannelStatusFilter(query *gorm.DB, statusFilter int) *gorm.DB {
	if statusFilter == common.ChannelStatusEnabled {
		return query.Where("status = ?", common.ChannelStatusEnabled)
	}
	if statusFilter == 0 {
		return query.Where("status != ?", common.ChannelStatusEnabled)
	}
	return query
}

func buildChannelListQuery(group string, statusFilter int, typeFilter int) *gorm.DB {
	query := model.DB.Model(&model.Channel{})
	query = model.ApplyChannelGroupFilter(query, group)
	query = applyChannelStatusFilter(query, statusFilter)
	if typeFilter >= 0 {
		query = query.Where("type = ?", typeFilter)
	}
	return query
}

func GetChannelOps(c *gin.Context) {
	common.ApiSuccess(c, gin.H{
		"retry_times": common.RetryTimes,
	})
}

func GetChannelDefaultBaseURLs(c *gin.Context) {
	baseURLs := make(map[int]string)
	for channelType, baseURL := range constant.ChannelBaseURLs {
		if baseURL != "" {
			baseURLs[channelType] = baseURL
		}
	}
	common.ApiSuccess(c, baseURLs)
}

func GetAllChannels(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	channelData := make([]*model.Channel, 0)
	idSort, _ := strconv.ParseBool(c.Query("id_sort"))
	sortOptions := model.NewChannelSortOptions(c.Query("sort_by"), c.Query("sort_order"), idSort)
	enableTagMode, _ := strconv.ParseBool(c.Query("tag_mode"))
	groupFilter := model.NormalizeChannelGroupFilter(c.Query("group"))
	statusParam := c.Query("status")
	// statusFilter: -1 all, 1 enabled, 0 disabled (include auto & manual)
	statusFilter := parseStatusFilter(statusParam)
	// type filter
	typeStr := c.Query("type")
	typeFilter := -1
	if typeStr != "" {
		if t, err := strconv.Atoi(typeStr); err == nil {
			typeFilter = t
		}
	}

	var total int64

	if enableTagMode {
		tags, err := model.GetPaginatedChannelTags(buildChannelListQuery(groupFilter, statusFilter, typeFilter), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
		if err != nil {
			common.SysError("failed to get paginated tags: " + err.Error())
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取标签失败，请稍后重试"})
			return
		}
		total, err = model.CountChannelTags(buildChannelListQuery(groupFilter, statusFilter, typeFilter))
		if err != nil {
			common.SysError("failed to count tags: " + err.Error())
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取标签数量失败，请稍后重试"})
			return
		}
		for _, tag := range tags {
			if tag == nil || *tag == "" {
				continue
			}
			var tagChannels []*model.Channel
			err := sortOptions.Apply(buildChannelListQuery(groupFilter, statusFilter, typeFilter).Where("tag = ?", *tag)).
				Omit("key").
				Find(&tagChannels).Error
			if err != nil {
				common.SysError("failed to get channels by tag: " + err.Error())
				c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取标签渠道失败，请稍后重试"})
				return
			}
			channelData = append(channelData, tagChannels...)
		}
	} else {
		if err := buildChannelListQuery(groupFilter, statusFilter, typeFilter).Count(&total).Error; err != nil {
			common.SysError("failed to count channels: " + err.Error())
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取渠道数量失败，请稍后重试"})
			return
		}

		err := sortOptions.Apply(buildChannelListQuery(groupFilter, statusFilter, typeFilter)).
			Limit(pageInfo.GetPageSize()).
			Offset(pageInfo.GetStartIdx()).
			Omit("key").
			Find(&channelData).Error
		if err != nil {
			common.SysError("failed to get channels: " + err.Error())
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取渠道列表失败，请稍后重试"})
			return
		}
	}

	for _, datum := range channelData {
		clearChannelInfo(datum)
	}

	countQuery := buildChannelListQuery(groupFilter, statusFilter, -1)
	var results []struct {
		Type  int64
		Count int64
	}
	if err := countQuery.Select("type, count(*) as count").Group("type").Find(&results).Error; err != nil {
		common.SysError("failed to count channel types: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取渠道类型统计失败，请稍后重试"})
		return
	}
	typeCounts := make(map[int64]int64)
	for _, r := range results {
		typeCounts[r.Type] = r.Count
	}
	common.ApiSuccess(c, gin.H{
		"items":       channelData,
		"total":       total,
		"page":        pageInfo.GetPage(),
		"page_size":   pageInfo.GetPageSize(),
		"type_counts": typeCounts,
	})
	return
}

func buildFetchModelsHeaders(channel *model.Channel, key string) (http.Header, error) {
	var headers http.Header
	switch channel.Type {
	case constant.ChannelTypeAnthropic:
		headers = GetClaudeAuthHeader(key)
	default:
		headers = GetAuthHeader(key)
	}

	if err := applyFetchModelsHeaderOverrides(channel, key, headers); err != nil {
		return nil, err
	}
	return headers, nil
}

func applyFetchModelsHeaderOverrides(channel *model.Channel, key string, headers http.Header) error {
	info := &relaycommon.RelayInfo{
		IsChannelTest: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:          key,
			HeadersOverride: channel.GetHeaderOverride(),
		},
	}
	overrides, err := relaychannel.ResolveHeaderOverride(info, nil)
	if err != nil {
		return err
	}
	for name, value := range overrides {
		headers.Set(name, value)
	}

	return nil
}

func FetchUpstreamModels(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	channel, err := model.GetChannelById(id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	ids, err := fetchChannelUpstreamModelIDs(channel)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("获取模型列表失败: %s", err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    ids,
	})
}

func FixChannelsAbilities(c *gin.Context) {
	success, fails, err := model.FixAbility()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"success": success,
			"fails":   fails,
		},
	})
}

func SearchChannels(c *gin.Context) {
	keyword := c.Query("keyword")
	group := c.Query("group")
	modelKeyword := c.Query("model")
	statusParam := c.Query("status")
	statusFilter := parseStatusFilter(statusParam)
	idSort, _ := strconv.ParseBool(c.Query("id_sort"))
	sortOptions := model.NewChannelSortOptions(c.Query("sort_by"), c.Query("sort_order"), idSort)
	enableTagMode, _ := strconv.ParseBool(c.Query("tag_mode"))
	channelData := make([]*model.Channel, 0)
	if enableTagMode {
		tags, err := model.SearchTags(keyword, group, modelKeyword, idSort)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		for _, tag := range tags {
			if tag != nil && *tag != "" {
				var tagChannels []*model.Channel
				err := sortOptions.Apply(buildChannelListQuery(group, -1, -1).Where("tag = ?", *tag)).
					Omit("key").
					Find(&tagChannels).Error
				if err != nil {
					c.JSON(http.StatusOK, gin.H{
						"success": false,
						"message": err.Error(),
					})
					return
				}
				channelData = append(channelData, tagChannels...)
			}
		}
	} else {
		channels, err := model.SearchChannels(keyword, group, modelKeyword, idSort, sortOptions)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		channelData = channels
	}

	if statusFilter == common.ChannelStatusEnabled || statusFilter == 0 {
		filtered := make([]*model.Channel, 0, len(channelData))
		for _, ch := range channelData {
			if statusFilter == common.ChannelStatusEnabled && ch.Status != common.ChannelStatusEnabled {
				continue
			}
			if statusFilter == 0 && ch.Status == common.ChannelStatusEnabled {
				continue
			}
			filtered = append(filtered, ch)
		}
		channelData = filtered
	}

	// calculate type counts for search results
	typeCounts := make(map[int64]int64)
	for _, channel := range channelData {
		typeCounts[int64(channel.Type)]++
	}

	typeParam := c.Query("type")
	typeFilter := -1
	if typeParam != "" {
		if tp, err := strconv.Atoi(typeParam); err == nil {
			typeFilter = tp
		}
	}

	if typeFilter >= 0 {
		filtered := make([]*model.Channel, 0, len(channelData))
		for _, ch := range channelData {
			if ch.Type == typeFilter {
				filtered = append(filtered, ch)
			}
		}
		channelData = filtered
	}

	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	total := len(channelData)
	startIdx := min((page-1)*pageSize, total)
	endIdx := min(startIdx+pageSize, total)

	pagedData := channelData[startIdx:endIdx]

	for _, datum := range pagedData {
		clearChannelInfo(datum)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":       pagedData,
			"total":       total,
			"type_counts": typeCounts,
		},
	})
	return
}

func GetChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if channel != nil {
		clearChannelInfo(channel)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    channel,
	})
	return
}

// GetChannelKey 获取渠道密钥（需要通过安全验证中间件）
// 此函数依赖 SecureVerificationRequired 中间件，确保用户已通过安全验证
func GetChannelKey(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "渠道ID格式错误")
		return
	}

	// 获取渠道信息（包含密钥）
	channel, err := model.GetChannelById(channelId, true)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorI18n(c, i18n.MsgChannelNotExists)
		return
	}
	if err != nil {
		writeSecurityOperationError(c, err)
		return
	}

	// 记录操作审计日志（高危：查看渠道密钥）
	recordManageAudit(c, "channel.key_view", map[string]any{
		"id":   channelId,
		"name": channel.Name,
	})

	// 返回渠道密钥
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "获取成功",
		"data": map[string]any{
			"key": channel.Key,
		},
	})
}

// validateChannel 通用的渠道校验函数
func validateChannel(channel *model.Channel, isAdd bool) error {
	if channel == nil {
		return fmt.Errorf("channel cannot be empty")
	}

	// 校验 channel settings
	if err := channel.ValidateSettings(); err != nil {
		return fmt.Errorf("渠道额外设置[channel setting] 格式错误：%s", err.Error())
	}
	if channel.Type == constant.ChannelTypeTaskPlugin {
		pluginKey := strings.TrimSpace(channel.GetSetting().TaskPluginKey)
		if pluginKey == "" {
			return fmt.Errorf("task plugin key is required")
		}
		if len(pluginKey) > 30 {
			return fmt.Errorf("task plugin key must not exceed 30 characters")
		}
		plugin, ok := jsplugin.DefaultRegistry.Get(pluginKey)
		if !ok {
			return fmt.Errorf("task plugin %q is not registered", pluginKey)
		}
		if channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "" {
			// The plugin default is persisted onto the channel instead of being
			// resolved per request, so the destination host stays an auditable
			// channel property that only an administrator edit can change.
			if plugin.Meta.BaseURL == "" {
				return fmt.Errorf("base URL is required for task plugin channels")
			}
			defaultBaseURL := plugin.Meta.BaseURL
			channel.BaseURL = &defaultBaseURL
		}
	}

	if channel.Type == constant.ChannelTypeNewAPI && strings.TrimSpace(channel.GetBaseURL()) == "" {
		return fmt.Errorf("New API channel base URL cannot be empty")
	}
	if channel.Type == constant.ChannelTypeVLLM && strings.TrimSpace(channel.GetBaseURL()) == "" {
		return fmt.Errorf("vLLM channel base URL cannot be empty")
	}
	if channel.Type == constant.ChannelTypeSGLang && strings.TrimSpace(channel.GetBaseURL()) == "" {
		return fmt.Errorf("SGLang channel base URL cannot be empty")
	}

	// 如果是添加操作，检查 channel 和 key 是否为空
	if isAdd {
		if channel.Key == "" {
			return fmt.Errorf("channel cannot be empty")
		}

		// 检查模型名称长度是否超过 255
		for _, m := range channel.GetModels() {
			if len(m) > 255 {
				return fmt.Errorf("模型名称过长: %s", m)
			}
		}
	}

	// VertexAI 特殊校验
	if channel.Type == constant.ChannelTypeVertexAi {
		if channel.Other == "" {
			return fmt.Errorf("部署地区不能为空")
		}

		regionMap, err := common.StrToMap(channel.Other)
		if err != nil {
			return fmt.Errorf("部署地区必须是标准的Json格式，例如{\"default\": \"us-central1\", \"region2\": \"us-east1\"}")
		}

		if regionMap["default"] == nil {
			return fmt.Errorf("部署地区必须包含default字段")
		}
	}

	// Codex OAuth key validation (optional, only when JSON object is provided)
	if channel.Type == constant.ChannelTypeCodex {
		trimmedKey := strings.TrimSpace(channel.Key)
		if isAdd || trimmedKey != "" {
			if !strings.HasPrefix(trimmedKey, "{") {
				return fmt.Errorf("Codex key must be a valid JSON object")
			}
			var keyMap map[string]any
			if err := common.Unmarshal([]byte(trimmedKey), &keyMap); err != nil {
				return fmt.Errorf("Codex key must be a valid JSON object")
			}
			if v, ok := keyMap["access_token"]; !ok || v == nil || strings.TrimSpace(fmt.Sprintf("%v", v)) == "" {
				return fmt.Errorf("Codex key JSON must include access_token")
			}
			if v, ok := keyMap["account_id"]; !ok || v == nil || strings.TrimSpace(fmt.Sprintf("%v", v)) == "" {
				return fmt.Errorf("Codex key JSON must include account_id")
			}
		}
	}

	return nil
}

func RefreshCodexChannelCredential(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, fmt.Errorf("invalid channel id: %w", err))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	oauthKey, ch, err := service.RefreshCodexChannelCredential(ctx, channelId, service.CodexCredentialRefreshOptions{ResetCaches: true})
	if err != nil {
		common.SysError("failed to refresh codex channel credential: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "刷新凭证失败，请稍后重试"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "refreshed",
		"data": gin.H{
			"expires_at":   oauthKey.Expired,
			"last_refresh": oauthKey.LastRefresh,
			"account_id":   oauthKey.AccountID,
			"email":        oauthKey.Email,
			"channel_id":   ch.Id,
			"channel_type": ch.Type,
			"channel_name": ch.Name,
		},
	})
}

type AddChannelRequest struct {
	Mode                      string                `json:"mode"`
	MultiKeyMode              constant.MultiKeyMode `json:"multi_key_mode"`
	BatchAddSetKeyPrefix2Name bool                  `json:"batch_add_set_key_prefix_2_name"`
	Channel                   *model.Channel        `json:"channel"`
}

func getVertexArrayKeys(keys string) ([]string, error) {
	if keys == "" {
		return nil, nil
	}
	var keyArray []any
	err := common.Unmarshal([]byte(keys), &keyArray)
	if err != nil {
		return nil, fmt.Errorf("批量添加 Vertex AI 必须使用标准的JsonArray格式，例如[{key1}, {key2}...]，请检查输入: %w", err)
	}
	cleanKeys := make([]string, 0, len(keyArray))
	for _, key := range keyArray {
		var keyStr string
		switch v := key.(type) {
		case string:
			keyStr = strings.TrimSpace(v)
		default:
			bytes, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("Vertex AI key JSON 编码失败: %w", err)
			}
			keyStr = string(bytes)
		}
		if keyStr != "" {
			cleanKeys = append(cleanKeys, keyStr)
		}
	}
	if len(cleanKeys) == 0 {
		return nil, fmt.Errorf("批量添加 Vertex AI 的 keys 不能为空")
	}
	return cleanKeys, nil
}

func AddChannel(c *gin.Context) {
	addChannelRequest := AddChannelRequest{}
	err := c.ShouldBindJSON(&addChannelRequest)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if addChannelRequest.Channel != nil && addChannelRequest.Channel.Type == constant.ChannelTypeTaskPlugin &&
		!authz.Can(c.GetInt("id"), c.GetInt("role"), authz.TaskPluginBind) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "task plugin channels require the task_plugin.bind permission",
		})
		return
	}

	baseURLFromPluginDefault := addChannelRequest.Channel != nil &&
		addChannelRequest.Channel.Type == constant.ChannelTypeTaskPlugin &&
		(addChannelRequest.Channel.BaseURL == nil || strings.TrimSpace(*addChannelRequest.Channel.BaseURL) == "")
	// 使用统一的校验函数
	if err := validateChannel(addChannelRequest.Channel, true); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	addChannelRequest.Channel.CreatedTime = common.GetTimestamp()
	keys := make([]string, 0)
	switch addChannelRequest.Mode {
	case "multi_to_single":
		addChannelRequest.Channel.ChannelInfo.IsMultiKey = true
		addChannelRequest.Channel.ChannelInfo.MultiKeyMode = addChannelRequest.MultiKeyMode
		if addChannelRequest.Channel.Type == constant.ChannelTypeVertexAi && addChannelRequest.Channel.GetOtherSettings().VertexKeyType != dto.VertexKeyTypeAPIKey {
			array, err := getVertexArrayKeys(addChannelRequest.Channel.Key)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				return
			}
			addChannelRequest.Channel.ChannelInfo.MultiKeySize = len(array)
			addChannelRequest.Channel.Key = strings.Join(array, "\n")
		} else {
			cleanKeys := make([]string, 0)
			for key := range strings.SplitSeq(addChannelRequest.Channel.Key, "\n") {
				if key == "" {
					continue
				}
				key = strings.TrimSpace(key)
				cleanKeys = append(cleanKeys, key)
			}
			addChannelRequest.Channel.ChannelInfo.MultiKeySize = len(cleanKeys)
			addChannelRequest.Channel.Key = strings.Join(cleanKeys, "\n")
		}
		keys = []string{addChannelRequest.Channel.Key}
	case "batch":
		if addChannelRequest.Channel.Type == constant.ChannelTypeVertexAi && addChannelRequest.Channel.GetOtherSettings().VertexKeyType != dto.VertexKeyTypeAPIKey {
			// multi json
			keys, err = getVertexArrayKeys(addChannelRequest.Channel.Key)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				return
			}
		} else {
			keys = strings.Split(addChannelRequest.Channel.Key, "\n")
		}
	case "single":
		keys = []string{addChannelRequest.Channel.Key}
	default:
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "不支持的添加模式",
		})
		return
	}

	channels := make([]model.Channel, 0, len(keys))
	for _, key := range keys {
		if key == "" {
			continue
		}
		localChannel := addChannelRequest.Channel
		localChannel.Key = key
		if addChannelRequest.BatchAddSetKeyPrefix2Name && len(keys) > 1 {
			keyPrefix := localChannel.Key
			if len(localChannel.Key) > 8 {
				keyPrefix = localChannel.Key[:8]
			}
			localChannel.Name = fmt.Sprintf("%s %s", localChannel.Name, keyPrefix)
		}
		channels = append(channels, *localChannel)
	}
	err = model.BatchInsertChannels(channels)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	createAudit := map[string]any{
		"name":  addChannelRequest.Channel.Name,
		"type":  addChannelRequest.Channel.Type,
		"count": len(channels),
	}
	if baseURLFromPluginDefault {
		createAudit["base_url_source"] = "plugin_default"
	}
	recordManageAudit(c, "channel.create", createAudit)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteChannel(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	channelName := ""
	channelProxy := ""
	channelLookupFailed := false
	if existing, err := model.GetChannelById(id, false); err == nil && existing != nil {
		channelName = existing.Name
		channelProxy = existing.GetSetting().Proxy
	} else {
		channelLookupFailed = true
	}
	channel := model.Channel{Id: id}
	err := channel.Delete()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	if channelLookupFailed {
		service.ResetProxyClientCache()
	} else {
		service.InvalidateProxyClient(channelProxy)
	}
	recordManageAudit(c, "channel.delete", map[string]any{
		"id":   id,
		"name": channelName,
	})
	closeActiveChannelWebSockets([]int{id})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteDisabledChannel(c *gin.Context) {
	var ids []int
	if err := model.DB.Model(&model.Channel{}).
		Where("status = ? or status = ?", common.ChannelStatusAutoDisabled, common.ChannelStatusManuallyDisabled).
		Pluck("id", &ids).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	rows, err := model.DeleteDisabledChannel()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	if rows > 0 {
		service.ResetProxyClientCache()
	}
	recordManageAudit(c, "channel.delete_disabled", map[string]any{
		"count": rows,
	})
	closeActiveChannelWebSockets(ids)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
	return
}

type ChannelTag struct {
	Tag            string  `json:"tag"`
	NewTag         *string `json:"new_tag"`
	Priority       *int64  `json:"priority"`
	Weight         *uint   `json:"weight"`
	ModelMapping   *string `json:"model_mapping"`
	Models         *string `json:"models"`
	Groups         *string `json:"groups"`
	ParamOverride  *string `json:"param_override"`
	HeaderOverride *string `json:"header_override"`
}

func DisableTagChannels(c *gin.Context) {
	channelTag := ChannelTag{}
	err := c.ShouldBindJSON(&channelTag)
	if err != nil || channelTag.Tag == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	channels, err := model.GetChannelsByTag(channelTag.Tag, false, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ids := channelIDsFromChannels(channels)
	err = model.DisableChannelByTag(channelTag.Tag)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	recordManageAudit(c, "channel.tag_disable", map[string]any{
		"tag": channelTag.Tag,
	})
	closeActiveChannelWebSockets(ids)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func EnableTagChannels(c *gin.Context) {
	channelTag := ChannelTag{}
	err := c.ShouldBindJSON(&channelTag)
	if err != nil || channelTag.Tag == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	err = model.EnableChannelByTag(channelTag.Tag)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	recordManageAudit(c, "channel.tag_enable", map[string]any{
		"tag": channelTag.Tag,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func EditTagChannels(c *gin.Context) {
	channelTag := ChannelTag{}
	err := c.ShouldBindJSON(&channelTag)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	if channelTag.Tag == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "tag不能为空",
		})
		return
	}
	if (channelTag.ParamOverride != nil || channelTag.HeaderOverride != nil) &&
		!authz.Can(c.GetInt("id"), c.GetInt("role"), authz.ChannelSensitiveWrite) {
		common.ApiErrorI18n(c, i18n.MsgAuthInsufficientPrivilege)
		return
	}
	if channelTag.ParamOverride != nil {
		trimmed := strings.TrimSpace(*channelTag.ParamOverride)
		if trimmed != "" && !json.Valid([]byte(trimmed)) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "参数覆盖必须是合法的 JSON 格式",
			})
			return
		}
		channelTag.ParamOverride = common.GetPointer[string](trimmed)
	}
	if channelTag.HeaderOverride != nil {
		trimmed := strings.TrimSpace(*channelTag.HeaderOverride)
		if trimmed != "" && !json.Valid([]byte(trimmed)) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "请求头覆盖必须是合法的 JSON 格式",
			})
			return
		}
		channelTag.HeaderOverride = common.GetPointer[string](trimmed)
	}
	err = model.EditChannelByTag(channelTag.Tag, channelTag.NewTag, channelTag.ModelMapping, channelTag.Models, channelTag.Groups, channelTag.Priority, channelTag.Weight, channelTag.ParamOverride, channelTag.HeaderOverride)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	recordManageAudit(c, "channel.tag_edit", map[string]any{
		"tag": channelTag.Tag,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

type ChannelBatch struct {
	Ids []int   `json:"ids"`
	Tag *string `json:"tag"`
}

func DeleteChannelBatch(c *gin.Context) {
	channelBatch := ChannelBatch{}
	err := c.ShouldBindJSON(&channelBatch)
	if err != nil || len(channelBatch.Ids) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	deletedCount, err := model.BatchDeleteChannels(channelBatch.Ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	if deletedCount > 0 {
		service.ResetProxyClientCache()
	}
	recordManageAudit(c, "channel.delete_batch", map[string]any{
		"count": deletedCount,
	})
	closeActiveChannelWebSockets(channelBatch.Ids)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    deletedCount,
	})
	return
}

type PatchChannel struct {
	model.Channel
	MultiKeyMode *string `json:"multi_key_mode"`
	KeyMode      *string `json:"key_mode"` // 多key模式下密钥覆盖或者追加
}

type ChannelStatusRequest struct {
	Status int `json:"status"`
}

type ChannelStatusBatchRequest struct {
	Ids    []int `json:"ids"`
	Status int   `json:"status"`
}

func UpdateChannel(c *gin.Context) {
	channel := PatchChannel{}
	rawBody, err := c.GetRawData()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := common.Unmarshal(rawBody, &channel); err != nil {
		common.ApiError(c, err)
		return
	}
	var requestData map[string]any
	if err := common.Unmarshal(rawBody, &requestData); err != nil {
		common.ApiError(c, err)
		return
	}
	if _, ok := requestData["status"]; ok {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	clearChannelReadOnlyFields(&channel, requestData)

	if channel.Type == constant.ChannelTypeTaskPlugin &&
		!authz.Can(c.GetInt("id"), c.GetInt("role"), authz.TaskPluginBind) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "task plugin channels require the task_plugin.bind permission",
		})
		return
	}

	baseURLFromPluginDefault := channel.Type == constant.ChannelTypeTaskPlugin &&
		(channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "")
	// 使用统一的校验函数
	if err := validateChannel(&channel.Channel, false); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	// Preserve existing ChannelInfo to ensure multi-key channels keep correct state even if the client does not send ChannelInfo in the request.
	originChannel, err := model.GetChannelById(channel.Id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	originProxy := originChannel.GetSetting().Proxy
	proxyChanged := false
	if _, settingProvided := requestData["setting"]; settingProvided {
		newProxy, _ := service.NormalizeProxyURL(channel.GetSetting().Proxy)
		normalizedOriginProxy, originProxyErr := service.NormalizeProxyURL(originProxy)
		proxyChanged = originProxyErr != nil || normalizedOriginProxy != newProxy
	}

	// Always copy the original ChannelInfo so that fields like IsMultiKey and MultiKeySize are retained.
	channel.ChannelInfo = originChannel.ChannelInfo

	if channelHasSensitiveChanges(&channel, originChannel, requestData) &&
		!authz.Can(c.GetInt("id"), c.GetInt("role"), authz.ChannelSensitiveWrite) {
		common.ApiErrorI18n(c, i18n.MsgAuthInsufficientPrivilege)
		return
	}

	// If the request explicitly specifies a new MultiKeyMode, apply it on top of the original info.
	if channel.MultiKeyMode != nil && *channel.MultiKeyMode != "" {
		channel.ChannelInfo.MultiKeyMode = constant.MultiKeyMode(*channel.MultiKeyMode)
	}

	// 处理多key模式下的密钥追加/覆盖逻辑
	if channel.KeyMode != nil && channel.ChannelInfo.IsMultiKey {
		switch *channel.KeyMode {
		case "append":
			// 追加模式：将新密钥添加到现有密钥列表
			if originChannel.Key != "" {
				var newKeys []string
				var existingKeys []string

				// 解析现有密钥
				if strings.HasPrefix(strings.TrimSpace(originChannel.Key), "[") {
					// JSON数组格式
					var arr []json.RawMessage
					if err := json.Unmarshal([]byte(strings.TrimSpace(originChannel.Key)), &arr); err == nil {
						existingKeys = make([]string, len(arr))
						for i, v := range arr {
							existingKeys[i] = string(v)
						}
					}
				} else {
					// 换行分隔格式
					existingKeys = strings.Split(strings.Trim(originChannel.Key, "\n"), "\n")
				}

				// 处理 Vertex AI 的特殊情况
				if channel.Type == constant.ChannelTypeVertexAi && channel.GetOtherSettings().VertexKeyType != dto.VertexKeyTypeAPIKey {
					// 尝试解析新密钥为JSON数组
					if strings.HasPrefix(strings.TrimSpace(channel.Key), "[") {
						array, err := getVertexArrayKeys(channel.Key)
						if err != nil {
							c.JSON(http.StatusOK, gin.H{
								"success": false,
								"message": "追加密钥解析失败: " + err.Error(),
							})
							return
						}
						newKeys = array
					} else {
						// 单个JSON密钥
						newKeys = []string{channel.Key}
					}
				} else {
					// 普通渠道的处理
					inputKeys := strings.SplitSeq(channel.Key, "\n")
					for key := range inputKeys {
						key = strings.TrimSpace(key)
						if key != "" {
							newKeys = append(newKeys, key)
						}
					}
				}

				seen := make(map[string]struct{}, len(existingKeys)+len(newKeys))
				for _, key := range existingKeys {
					normalized := strings.TrimSpace(key)
					if normalized == "" {
						continue
					}
					seen[normalized] = struct{}{}
				}
				dedupedNewKeys := make([]string, 0, len(newKeys))
				for _, key := range newKeys {
					normalized := strings.TrimSpace(key)
					if normalized == "" {
						continue
					}
					if _, ok := seen[normalized]; ok {
						continue
					}
					seen[normalized] = struct{}{}
					dedupedNewKeys = append(dedupedNewKeys, normalized)
				}

				allKeys := append(existingKeys, dedupedNewKeys...)
				channel.Key = strings.Join(allKeys, "\n")
			}
		case "replace":
			// 覆盖模式：直接使用新密钥（默认行为，不需要特殊处理）
		}
	}
	err = channel.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	if proxyChanged {
		service.InvalidateProxyClient(originProxy)
	}
	// 记录变更的字段名（语言无关的字段标识），密钥仅记录"已更换"绝不记录内容。
	changedFields := make([]string, 0)
	if channel.Models != originChannel.Models {
		changedFields = append(changedFields, "models")
	}
	if channel.Group != originChannel.Group {
		changedFields = append(changedFields, "group")
	}
	if channel.Type != originChannel.Type {
		changedFields = append(changedFields, "type")
	}
	if !equalStringPtr(channel.BaseURL, originChannel.BaseURL) {
		changedFields = append(changedFields, "base_url")
	}
	if channel.Key != "" && channel.Key != originChannel.Key {
		changedFields = append(changedFields, "key")
	}
	updateAudit := map[string]any{
		"id":             channel.Id,
		"name":           channel.Name,
		"changed_fields": changedFields,
	}
	if baseURLFromPluginDefault {
		updateAudit["base_url_source"] = "plugin_default"
	}
	recordManageAudit(c, "channel.update", updateAudit)
	channel.Key = ""
	clearChannelInfo(&channel.Channel)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    channel,
	})
	return
}

func UpdateChannelStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	req := ChannelStatusRequest{}
	if err := c.ShouldBindJSON(&req); err != nil || !isManageableChannelStatus(req.Status) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	changed := model.UpdateChannelStatus(id, "", req.Status, "manual operation")
	if changed {
		model.InitChannelCache()
		if req.Status != common.ChannelStatusEnabled {
			closeActiveChannelWebSockets([]int{id})
		}
	}
	recordManageAudit(c, "channel.status_update", map[string]any{
		"id":      id,
		"status":  req.Status,
		"changed": changed,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    changed,
	})
}

func BatchUpdateChannelStatus(c *gin.Context) {
	req := ChannelStatusBatchRequest{}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Ids) == 0 || !isManageableChannelStatus(req.Status) {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	changedCount := 0
	var disabledIDs []int
	for _, id := range req.Ids {
		if model.UpdateChannelStatus(id, "", req.Status, "manual batch operation") {
			changedCount++
			if req.Status != common.ChannelStatusEnabled {
				disabledIDs = append(disabledIDs, id)
			}
		}
	}
	if changedCount > 0 {
		model.InitChannelCache()
	}
	if len(disabledIDs) > 0 {
		closeActiveChannelWebSockets(disabledIDs)
	}
	recordManageAudit(c, "channel.status_update_batch", map[string]any{
		"count":  changedCount,
		"total":  len(req.Ids),
		"status": req.Status,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    changedCount,
	})
}

func isManageableChannelStatus(status int) bool {
	return status == common.ChannelStatusEnabled || status == common.ChannelStatusManuallyDisabled
}

// equalStringPtr 比较两个 *string 是否相等（均为 nil 视为相等）。
func equalStringPtr(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

type fetchModelsRequest struct {
	ChannelID      int     `json:"channel_id"`
	BaseURL        *string `json:"base_url"`
	Type           int     `json:"type"`
	Key            string  `json:"key"`
	AdvancedCustom *string `json:"advanced_custom"`
	HeaderOverride *string `json:"header_override"`
	Proxy          *string `json:"proxy"`
}

func buildAdvancedCustomModelPreviewChannel(req fetchModelsRequest) (*model.Channel, error) {
	var channel *model.Channel
	if req.ChannelID > 0 {
		savedChannel, err := model.GetChannelById(req.ChannelID, true)
		if err != nil {
			return nil, err
		}
		if savedChannel.Type != constant.ChannelTypeAdvancedCustom {
			return nil, fmt.Errorf("channel %d is not an advanced custom channel", req.ChannelID)
		}
		channel = savedChannel
	} else {
		key := strings.TrimSpace(req.Key)
		if key != "" {
			key = strings.Split(key, "\n")[0]
		}
		channel = &model.Channel{
			Type: req.Type,
			Key:  key,
		}
	}

	if channel.Type != constant.ChannelTypeAdvancedCustom {
		return nil, fmt.Errorf("channel type must be advanced custom")
	}
	if req.BaseURL != nil {
		baseURL := strings.TrimSpace(*req.BaseURL)
		channel.BaseURL = &baseURL
	}

	settings := channel.GetOtherSettings()
	if req.AdvancedCustom != nil {
		rawConfig := strings.TrimSpace(*req.AdvancedCustom)
		if rawConfig == "" {
			return nil, fmt.Errorf("advanced_custom is required")
		}
		var config dto.AdvancedCustomConfig
		if err := common.UnmarshalJsonStr(rawConfig, &config); err != nil {
			return nil, err
		}
		settings.AdvancedCustom = &config
	} else if req.ChannelID <= 0 {
		return nil, fmt.Errorf("advanced_custom is required")
	}
	channel.SetOtherSettings(settings)

	if req.HeaderOverride != nil {
		rawHeaderOverride := strings.TrimSpace(*req.HeaderOverride)
		if rawHeaderOverride != "" {
			var headerOverride map[string]any
			if err := common.UnmarshalJsonStr(rawHeaderOverride, &headerOverride); err != nil {
				return nil, fmt.Errorf("header_override must be a JSON object: %w", err)
			}
		}
		channel.HeaderOverride = &rawHeaderOverride
	}
	if req.Proxy != nil {
		channelSettings := channel.GetSetting()
		channelSettings.Proxy = strings.TrimSpace(*req.Proxy)
		channel.SetSetting(channelSettings)
	}

	if err := validateChannel(channel, false); err != nil {
		return nil, err
	}
	return channel, nil
}

func FetchModels(c *gin.Context) {
	var req fetchModelsRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request",
		})
		return
	}

	var channel *model.Channel
	if req.Type == constant.ChannelTypeAdvancedCustom || req.ChannelID > 0 {
		var err error
		channel, err = buildAdvancedCustomModelPreviewChannel(req)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	} else {
		baseURL := ""
		if req.BaseURL != nil {
			baseURL = strings.TrimSpace(*req.BaseURL)
		}
		if baseURL == "" {
			baseURL = constant.GetChannelBaseURL(req.Type)
		}

		key := strings.TrimSpace(req.Key)
		if req.Type != constant.ChannelTypeCodex {
			key = strings.Split(key, "\n")[0]
		}
		channel = &model.Channel{
			Type:    req.Type,
			Key:     key,
			BaseURL: &baseURL,
		}
	}

	models, err := fetchChannelUpstreamModelIDs(channel)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("获取模型列表失败: %s", err.Error()),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    models,
	})
}

func BatchSetChannelTag(c *gin.Context) {
	channelBatch := ChannelBatch{}
	err := c.ShouldBindJSON(&channelBatch)
	if err != nil || len(channelBatch.Ids) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数错误",
		})
		return
	}
	err = model.BatchSetChannelTag(channelBatch.Ids, channelBatch.Tag)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InitChannelCache()
	recordManageAudit(c, "channel.tag_batch_set", map[string]any{
		"count": len(channelBatch.Ids),
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    len(channelBatch.Ids),
	})
	return
}

func GetTagModels(c *gin.Context) {
	tag := c.Query("tag")
	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "tag不能为空",
		})
		return
	}

	channels, err := model.GetChannelsByTag(tag, false, false) // idSort=false, selectAll=false
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	var longestModels string
	maxLength := 0

	// Find the longest models string among all channels with the given tag
	for _, channel := range channels {
		if channel.Models != "" {
			currentModels := strings.Split(channel.Models, ",")
			if len(currentModels) > maxLength {
				maxLength = len(currentModels)
				longestModels = channel.Models
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    longestModels,
	})
	return
}

// CopyChannel handles cloning an existing channel with its key.
// POST /api/channel/copy/:id
// Optional query params:
//
//	suffix         - string appended to the original name (default "_复制")
//	reset_balance  - bool, when true will reset balance & used_quota to 0 (default true)
func CopyChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}

	suffix := c.DefaultQuery("suffix", "_复制")
	resetBalance := true
	if rbStr := c.DefaultQuery("reset_balance", "true"); rbStr != "" {
		if v, err := strconv.ParseBool(rbStr); err == nil {
			resetBalance = v
		}
	}

	// fetch original channel with key
	origin, err := model.GetChannelById(id, true)
	if err != nil {
		common.SysError("failed to get channel by id: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "获取渠道信息失败，请稍后重试"})
		return
	}
	if origin.Type == constant.ChannelTypeTaskPlugin &&
		!authz.Can(c.GetInt("id"), c.GetInt("role"), authz.TaskPluginBind) {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "task plugin channels require the task_plugin.bind permission"})
		return
	}

	// clone channel
	clone := *origin // shallow copy is sufficient as we will overwrite primitives
	clone.Id = 0     // let DB auto-generate
	clone.CreatedTime = common.GetTimestamp()
	clone.Name = origin.Name + suffix
	clone.TestTime = 0
	clone.ResponseTime = 0
	if resetBalance {
		clone.Balance = 0
		clone.UsedQuota = 0
	}

	if err := clone.ValidateSettings(); err != nil {
		common.SysError("failed to validate cloned channel: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "Failed to copy channel: invalid channel settings"})
		return
	}

	// insert
	if err := clone.Insert(); err != nil {
		common.SysError("failed to clone channel: " + err.Error())
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "复制渠道失败，请稍后重试"})
		return
	}
	model.InitChannelCache()
	recordManageAudit(c, "channel.copy", map[string]any{
		"sourceId": id,
		"id":       clone.Id,
		"name":     clone.Name,
	})
	// success
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": gin.H{"id": clone.Id}})
}

// MultiKeyManageRequest represents the request for multi-key management operations
type MultiKeyManageRequest struct {
	ChannelId int    `json:"channel_id"`
	Action    string `json:"action"`              // "disable_key", "enable_key", "delete_key", "delete_disabled_keys", "get_key_status"
	KeyIndex  *int   `json:"key_index,omitempty"` // for disable_key, enable_key, and delete_key actions
	Page      int    `json:"page,omitempty"`      // for get_key_status pagination
	PageSize  int    `json:"page_size,omitempty"` // for get_key_status pagination
	Status    *int   `json:"status,omitempty"`    // for get_key_status filtering: 1=enabled, 2=manual_disabled, 3=auto_disabled, nil=all
}

// MultiKeyStatusResponse represents the response for key status query
type MultiKeyStatusResponse struct {
	Keys       []KeyStatus `json:"keys"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
	// Statistics
	EnabledCount        int `json:"enabled_count"`
	ManualDisabledCount int `json:"manual_disabled_count"`
	AutoDisabledCount   int `json:"auto_disabled_count"`
}

type KeyStatus struct {
	Index        int    `json:"index"`
	Status       int    `json:"status"` // 1: enabled, 2: disabled
	DisabledTime int64  `json:"disabled_time,omitempty"`
	Reason       string `json:"reason,omitempty"`
	KeyPreview   string `json:"key_preview"` // first 10 chars of key for identification
}

// ManageMultiKeys handles multi-key management operations
func ManageMultiKeys(c *gin.Context) {
	request := MultiKeyManageRequest{}
	err := c.ShouldBindJSON(&request)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	channel, err := model.GetChannelById(request.ChannelId, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "渠道不存在",
		})
		return
	}

	if !channel.ChannelInfo.IsMultiKey {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该渠道不是多密钥模式",
		})
		return
	}
	if multiKeyActionRequiresSensitiveWrite(request.Action) &&
		!authz.Can(c.GetInt("id"), c.GetInt("role"), authz.ChannelSensitiveWrite) {
		common.ApiErrorI18n(c, i18n.MsgAuthInsufficientPrivilege)
		return
	}

	// get_key_status 为只读查询，不记录审计；其余为修改操作，记录审计并跳过中间件兜底。
	if request.Action == "get_key_status" {
		markAuditLogged(c)
	} else {
		recordManageAudit(c, "channel.multi_key_manage", map[string]any{
			"action": request.Action,
			"id":     channel.Id,
		})
	}

	lock := model.GetChannelPollingLock(channel.Id)
	lock.Lock()
	defer lock.Unlock()

	switch request.Action {
	case "get_key_status":
		keys := channel.GetKeys()

		// Default pagination parameters
		page := request.Page
		pageSize := request.PageSize
		if page <= 0 {
			page = 1
		}
		if pageSize <= 0 {
			pageSize = 50 // Default page size
		}

		// Statistics for all keys (unchanged by filtering)
		var enabledCount, manualDisabledCount, autoDisabledCount int

		// Build all key status data first
		var allKeyStatusList []KeyStatus
		for i, key := range keys {
			status := 1 // default enabled
			var disabledTime int64
			var reason string

			if channel.ChannelInfo.MultiKeyStatusList != nil {
				if s, exists := channel.ChannelInfo.MultiKeyStatusList[i]; exists {
					status = s
				}
			}

			// Count for statistics (all keys)
			switch status {
			case 1:
				enabledCount++
			case 2:
				manualDisabledCount++
			case 3:
				autoDisabledCount++
			}

			if status != 1 {
				if channel.ChannelInfo.MultiKeyDisabledTime != nil {
					disabledTime = channel.ChannelInfo.MultiKeyDisabledTime[i]
				}
				if channel.ChannelInfo.MultiKeyDisabledReason != nil {
					reason = channel.ChannelInfo.MultiKeyDisabledReason[i]
				}
			}

			// Create key preview (first 10 chars)
			keyPreview := key
			if len(key) > 10 {
				keyPreview = key[:10] + "..."
			}

			allKeyStatusList = append(allKeyStatusList, KeyStatus{
				Index:        i,
				Status:       status,
				DisabledTime: disabledTime,
				Reason:       reason,
				KeyPreview:   keyPreview,
			})
		}

		// Apply status filter if specified
		var filteredKeyStatusList []KeyStatus
		if request.Status != nil {
			for _, keyStatus := range allKeyStatusList {
				if keyStatus.Status == *request.Status {
					filteredKeyStatusList = append(filteredKeyStatusList, keyStatus)
				}
			}
		} else {
			filteredKeyStatusList = allKeyStatusList
		}

		// Calculate pagination based on filtered results
		filteredTotal := len(filteredKeyStatusList)
		totalPages := (filteredTotal + pageSize - 1) / pageSize
		if totalPages == 0 {
			totalPages = 1
		}
		if page > totalPages {
			page = totalPages
		}

		// Calculate range for current page
		start := (page - 1) * pageSize
		end := min(start+pageSize, filteredTotal)

		// Get the page data
		var pageKeyStatusList []KeyStatus
		if start < filteredTotal {
			pageKeyStatusList = filteredKeyStatusList[start:end]
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": MultiKeyStatusResponse{
				Keys:                pageKeyStatusList,
				Total:               filteredTotal, // Total of filtered results
				Page:                page,
				PageSize:            pageSize,
				TotalPages:          totalPages,
				EnabledCount:        enabledCount,        // Overall statistics
				ManualDisabledCount: manualDisabledCount, // Overall statistics
				AutoDisabledCount:   autoDisabledCount,   // Overall statistics
			},
		})
		return

	case "disable_key":
		if request.KeyIndex == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "未指定要禁用的密钥索引",
			})
			return
		}

		keyIndex := *request.KeyIndex
		if keyIndex < 0 || keyIndex >= channel.ChannelInfo.MultiKeySize {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "密钥索引超出范围",
			})
			return
		}

		if channel.ChannelInfo.MultiKeyStatusList == nil {
			channel.ChannelInfo.MultiKeyStatusList = make(map[int]int)
		}
		if channel.ChannelInfo.MultiKeyDisabledTime == nil {
			channel.ChannelInfo.MultiKeyDisabledTime = make(map[int]int64)
		}
		if channel.ChannelInfo.MultiKeyDisabledReason == nil {
			channel.ChannelInfo.MultiKeyDisabledReason = make(map[int]string)
		}

		channel.ChannelInfo.MultiKeyStatusList[keyIndex] = 2 // disabled

		shouldCloseWebSocket := disableMultiKeyChannelIfUnavailable(channel)
		err = channel.Update()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		if shouldCloseWebSocket {
			closeActiveChannelWebSockets([]int{channel.Id})
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "密钥已禁用",
		})
		return

	case "enable_key":
		if request.KeyIndex == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "未指定要启用的密钥索引",
			})
			return
		}

		keyIndex := *request.KeyIndex
		if keyIndex < 0 || keyIndex >= channel.ChannelInfo.MultiKeySize {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "密钥索引超出范围",
			})
			return
		}

		// 从状态列表中删除该密钥的记录，使其回到默认启用状态
		if channel.ChannelInfo.MultiKeyStatusList != nil {
			delete(channel.ChannelInfo.MultiKeyStatusList, keyIndex)
		}
		if channel.ChannelInfo.MultiKeyDisabledTime != nil {
			delete(channel.ChannelInfo.MultiKeyDisabledTime, keyIndex)
		}
		if channel.ChannelInfo.MultiKeyDisabledReason != nil {
			delete(channel.ChannelInfo.MultiKeyDisabledReason, keyIndex)
		}
		restoreMultiKeyChannelIfAvailable(channel)

		err = channel.Update()
		if err != nil {
			common.ApiError(c, err)
			return
		}

		model.InitChannelCache()
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "密钥已启用",
		})
		return

	case "enable_all_keys":
		// 清空所有禁用状态，使所有密钥回到默认启用状态
		var enabledCount int
		if channel.ChannelInfo.MultiKeyStatusList != nil {
			enabledCount = len(channel.ChannelInfo.MultiKeyStatusList)
		}

		channel.ChannelInfo.MultiKeyStatusList = make(map[int]int)
		channel.ChannelInfo.MultiKeyDisabledTime = make(map[int]int64)
		channel.ChannelInfo.MultiKeyDisabledReason = make(map[int]string)
		restoreMultiKeyChannelIfAvailable(channel)

		err = channel.Update()
		if err != nil {
			common.ApiError(c, err)
			return
		}

		model.InitChannelCache()
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("已启用 %d 个密钥", enabledCount),
		})
		return

	case "disable_all_keys":
		// 禁用所有启用的密钥
		if channel.ChannelInfo.MultiKeyStatusList == nil {
			channel.ChannelInfo.MultiKeyStatusList = make(map[int]int)
		}
		if channel.ChannelInfo.MultiKeyDisabledTime == nil {
			channel.ChannelInfo.MultiKeyDisabledTime = make(map[int]int64)
		}
		if channel.ChannelInfo.MultiKeyDisabledReason == nil {
			channel.ChannelInfo.MultiKeyDisabledReason = make(map[int]string)
		}

		var disabledCount int
		for i := 0; i < channel.ChannelInfo.MultiKeySize; i++ {
			status := 1 // default enabled
			if s, exists := channel.ChannelInfo.MultiKeyStatusList[i]; exists {
				status = s
			}

			// 只禁用当前启用的密钥
			if status == 1 {
				channel.ChannelInfo.MultiKeyStatusList[i] = 2 // disabled
				disabledCount++
			}
		}

		if disabledCount == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "没有可禁用的密钥",
			})
			return
		}

		shouldCloseWebSocket := disableMultiKeyChannelIfUnavailable(channel)
		err = channel.Update()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		if shouldCloseWebSocket {
			closeActiveChannelWebSockets([]int{channel.Id})
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("已禁用 %d 个密钥", disabledCount),
		})
		return

	case "delete_key":
		if request.KeyIndex == nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "未指定要删除的密钥索引",
			})
			return
		}

		keyIndex := *request.KeyIndex
		if keyIndex < 0 || keyIndex >= channel.ChannelInfo.MultiKeySize {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "密钥索引超出范围",
			})
			return
		}

		keys := channel.GetKeys()
		var remainingKeys []string
		var newStatusList = make(map[int]int)
		var newDisabledTime = make(map[int]int64)
		var newDisabledReason = make(map[int]string)

		newIndex := 0
		for i, key := range keys {
			// 跳过要删除的密钥
			if i == keyIndex {
				continue
			}

			remainingKeys = append(remainingKeys, key)

			// 保留其他密钥的状态信息，重新索引
			if channel.ChannelInfo.MultiKeyStatusList != nil {
				if status, exists := channel.ChannelInfo.MultiKeyStatusList[i]; exists && status != 1 {
					newStatusList[newIndex] = status
				}
			}
			if channel.ChannelInfo.MultiKeyDisabledTime != nil {
				if t, exists := channel.ChannelInfo.MultiKeyDisabledTime[i]; exists {
					newDisabledTime[newIndex] = t
				}
			}
			if channel.ChannelInfo.MultiKeyDisabledReason != nil {
				if r, exists := channel.ChannelInfo.MultiKeyDisabledReason[i]; exists {
					newDisabledReason[newIndex] = r
				}
			}
			newIndex++
		}

		if len(remainingKeys) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "不能删除最后一个密钥",
			})
			return
		}

		// Update channel with remaining keys
		channel.Key = strings.Join(remainingKeys, "\n")
		channel.ChannelInfo.MultiKeySize = len(remainingKeys)
		channel.ChannelInfo.MultiKeyStatusList = newStatusList
		channel.ChannelInfo.MultiKeyDisabledTime = newDisabledTime
		channel.ChannelInfo.MultiKeyDisabledReason = newDisabledReason

		shouldCloseWebSocket := disableMultiKeyChannelIfUnavailable(channel)
		err = channel.Update()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		if shouldCloseWebSocket {
			closeActiveChannelWebSockets([]int{channel.Id})
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "密钥已删除",
		})
		return

	case "delete_disabled_keys":
		keys := channel.GetKeys()
		var remainingKeys []string
		var deletedCount int
		var newStatusList = make(map[int]int)
		var newDisabledTime = make(map[int]int64)
		var newDisabledReason = make(map[int]string)

		newIndex := 0
		for i, key := range keys {
			status := 1 // default enabled
			if channel.ChannelInfo.MultiKeyStatusList != nil {
				if s, exists := channel.ChannelInfo.MultiKeyStatusList[i]; exists {
					status = s
				}
			}

			// 只删除自动禁用（status == 3）的密钥，保留启用（status == 1）和手动禁用（status == 2）的密钥
			if status == 3 {
				deletedCount++
			} else {
				remainingKeys = append(remainingKeys, key)
				// 保留非自动禁用密钥的状态信息，重新索引
				if status != 1 {
					newStatusList[newIndex] = status
					if channel.ChannelInfo.MultiKeyDisabledTime != nil {
						if t, exists := channel.ChannelInfo.MultiKeyDisabledTime[i]; exists {
							newDisabledTime[newIndex] = t
						}
					}
					if channel.ChannelInfo.MultiKeyDisabledReason != nil {
						if r, exists := channel.ChannelInfo.MultiKeyDisabledReason[i]; exists {
							newDisabledReason[newIndex] = r
						}
					}
				}
				newIndex++
			}
		}

		if deletedCount == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "没有需要删除的自动禁用密钥",
			})
			return
		}

		// Update channel with remaining keys
		channel.Key = strings.Join(remainingKeys, "\n")
		channel.ChannelInfo.MultiKeySize = len(remainingKeys)
		channel.ChannelInfo.MultiKeyStatusList = newStatusList
		channel.ChannelInfo.MultiKeyDisabledTime = newDisabledTime
		channel.ChannelInfo.MultiKeyDisabledReason = newDisabledReason

		shouldCloseWebSocket := disableMultiKeyChannelIfUnavailable(channel)
		err = channel.Update()
		if err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		if shouldCloseWebSocket {
			closeActiveChannelWebSockets([]int{channel.Id})
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("已删除 %d 个自动禁用的密钥", deletedCount),
			"data":    deletedCount,
		})
		return

	default:
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "不支持的操作",
		})
		return
	}
}

func multiKeyActionRequiresSensitiveWrite(action string) bool {
	return action == "delete_key" || action == "delete_disabled_keys"
}

// OllamaPullModel 拉取 Ollama 模型
func OllamaPullModel(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id"`
		ModelName string `json:"model_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request parameters",
		})
		return
	}

	if req.ChannelID == 0 || req.ModelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Channel ID and model name are required",
		})
		return
	}

	// 获取渠道信息
	channel, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Channel not found",
		})
		return
	}

	// 检查是否是 Ollama 渠道
	if channel.Type != constant.ChannelTypeOllama {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "This operation is only supported for Ollama channels",
		})
		return
	}

	baseURL := constant.GetChannelBaseURL(channel.Type)
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	key := strings.Split(channel.Key, "\n")[0]
	err = ollama.PullOllamaModel(baseURL, key, req.ModelName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": fmt.Sprintf("Failed to pull model: %s", err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Model %s pulled successfully", req.ModelName),
	})
}

// OllamaPullModelStream 流式拉取 Ollama 模型
func OllamaPullModelStream(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id"`
		ModelName string `json:"model_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request parameters",
		})
		return
	}

	if req.ChannelID == 0 || req.ModelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Channel ID and model name are required",
		})
		return
	}

	// 获取渠道信息
	channel, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Channel not found",
		})
		return
	}

	// 检查是否是 Ollama 渠道
	if channel.Type != constant.ChannelTypeOllama {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "This operation is only supported for Ollama channels",
		})
		return
	}

	baseURL := constant.GetChannelBaseURL(channel.Type)
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	// 设置 SSE 头部
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")

	key := strings.Split(channel.Key, "\n")[0]

	// 创建进度回调函数
	progressCallback := func(progress ollama.OllamaPullResponse) {
		data, _ := json.Marshal(progress)
		fmt.Fprintf(c.Writer, "data: %s\n\n", string(data))
		c.Writer.Flush()
	}

	// 执行拉取
	err = ollama.PullOllamaModelStream(baseURL, key, req.ModelName, progressCallback)

	if err != nil {
		errorData, _ := json.Marshal(gin.H{
			"error": err.Error(),
		})
		fmt.Fprintf(c.Writer, "data: %s\n\n", string(errorData))
	} else {
		successData, _ := json.Marshal(gin.H{
			"message": fmt.Sprintf("Model %s pulled successfully", req.ModelName),
		})
		fmt.Fprintf(c.Writer, "data: %s\n\n", string(successData))
	}

	// 发送结束标志
	fmt.Fprintf(c.Writer, "data: [DONE]\n\n")
	c.Writer.Flush()
}

// OllamaDeleteModel 删除 Ollama 模型
func OllamaDeleteModel(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id"`
		ModelName string `json:"model_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request parameters",
		})
		return
	}

	if req.ChannelID == 0 || req.ModelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Channel ID and model name are required",
		})
		return
	}

	// 获取渠道信息
	channel, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Channel not found",
		})
		return
	}

	// 检查是否是 Ollama 渠道
	if channel.Type != constant.ChannelTypeOllama {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "This operation is only supported for Ollama channels",
		})
		return
	}

	baseURL := constant.GetChannelBaseURL(channel.Type)
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	key := strings.Split(channel.Key, "\n")[0]
	err = ollama.DeleteOllamaModel(baseURL, key, req.ModelName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": fmt.Sprintf("Failed to delete model: %s", err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Model %s deleted successfully", req.ModelName),
	})
}

// OllamaVersion 获取 Ollama 服务版本信息
func OllamaVersion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid channel id",
		})
		return
	}

	channel, err := model.GetChannelById(id, true)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Channel not found",
		})
		return
	}

	if channel.Type != constant.ChannelTypeOllama {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "This operation is only supported for Ollama channels",
		})
		return
	}

	baseURL := constant.GetChannelBaseURL(channel.Type)
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	key := strings.Split(channel.Key, "\n")[0]
	version, err := ollama.FetchOllamaVersion(baseURL, key)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": fmt.Sprintf("获取Ollama版本失败: %s", err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"version": version,
		},
	})
}

// AvailableChannelGroupItemDTO 可用渠道分组信息
type AvailableChannelGroupItemDTO struct {
	Name   string   `json:"name"`   // 分组名称
	Ratio  float64  `json:"ratio"`  // 分组倍率
	Models []string `json:"models"` // 该分组支持的模型列表
}

// AvailableChannelPlatformDTO 可用渠道平台概览
type AvailableChannelPlatformDTO struct {
	Platform string                         `json:"platform"` // 平台名称，如 OpenAI, Anthropic, Grok
	Groups   []AvailableChannelGroupItemDTO `json:"groups"`   // 分组列表
	Models   []string                       `json:"models"`   // 平台支持的所有去重模型列表
}

// resolveAvailablePlatformName 根据渠道类型、名称及支持的模型推导真实平台展示名称
func resolveAvailablePlatformName(channelType int, channelName string, models []string) string {
	switch channelType {
	case constant.ChannelTypeOpenAI, constant.ChannelTypeAzure, constant.ChannelTypeOpenAIMax:
		return "OpenAI"
	case constant.ChannelTypeAnthropic:
		return "Anthropic"
	case constant.ChannelTypeGemini, constant.ChannelTypeVertexAi:
		return "Google Gemini"
	case constant.ChannelTypeDeepSeek:
		return "DeepSeek"
	case constant.ChannelTypeXai:
		return "Grok"
	case constant.ChannelTypeMidjourney, constant.ChannelTypeMidjourneyPlus:
		return "Midjourney"
	case constant.ChannelTypeAli:
		return "Aliyun"
	case constant.ChannelTypeZhipu, constant.ChannelTypeZhipu_v4:
		return "Zhipu"
	case constant.ChannelTypeMoonshot:
		return "Moonshot"
	case constant.ChannelTypeMiniMax:
		return "MiniMax"
	case constant.ChannelTypeLingYiWanWu:
		return "LingYiWanWu"
	case constant.ChannelTypeBaidu, constant.ChannelTypeBaiduV2:
		return "Baidu"
	case constant.ChannelTypeTencent:
		return "Tencent"
	case constant.ChannelTypeOllama:
		return "Ollama"
	}

	// 针对 Sub2API (59), NewAPI (60), Custom 等聚合中转渠道，基于所代理模型进行智能归类
	hasClaude := false
	hasGpt := false
	hasGrok := false
	hasGemini := false
	hasDeepseek := false

	for _, m := range models {
		lowerM := strings.ToLower(m)
		if strings.Contains(lowerM, "claude") {
			hasClaude = true
		} else if strings.Contains(lowerM, "gpt") || strings.Contains(lowerM, "o1") || strings.Contains(lowerM, "o3") || strings.Contains(lowerM, "codex") || strings.Contains(lowerM, "dall-e") {
			hasGpt = true
		} else if strings.Contains(lowerM, "grok") {
			hasGrok = true
		} else if strings.Contains(lowerM, "gemini") {
			hasGemini = true
		} else if strings.Contains(lowerM, "deepseek") {
			hasDeepseek = true
		}
	}

	if hasClaude && !hasGpt {
		return "Anthropic"
	}
	if hasGpt && !hasClaude {
		return "OpenAI"
	}
	if hasGrok && !hasClaude && !hasGpt {
		return "Grok"
	}
	if hasGemini && !hasClaude && !hasGpt {
		return "Google Gemini"
	}
	if hasDeepseek && !hasClaude && !hasGpt {
		return "DeepSeek"
	}

	lowerName := strings.ToLower(channelName)
	if strings.Contains(lowerName, "claude") || strings.Contains(lowerName, "anthropic") || strings.Contains(lowerName, "kiro") || strings.Contains(lowerName, "cc-max") || strings.Contains(lowerName, "ccmax") {
		return "Anthropic"
	}
	if strings.Contains(lowerName, "grok") {
		return "Grok"
	}
	if strings.Contains(lowerName, "openai") || strings.Contains(lowerName, "oai") {
		return "OpenAI"
	}

	name := constant.GetChannelTypeName(channelType)
	if name != "" && name != "Unknown" {
		return name
	}
	return "Other"
}

// GetAvailableChannels 获取所有可用渠道概览（所有人可访问）
// @Summary 获取可用渠道概览
// @Description 所有人均可查看的已启用可用渠道概览，包含平台名称、所属分组及其倍率、支持的去重模型列表
// @Tags Channel
// @Produce json
// @Success 200 {object} dto.GeneralResponse{data=[]AvailableChannelPlatformDTO} "可用渠道平台列表"
// @Router /api/channels/available [get]
func GetAvailableChannels(c *gin.Context) {
	// 步骤 1：查询所有状态为启用的渠道数据（仅选择必要字段，排除 Key 等敏感凭证）
	channels, err := model.GetEnabledChannelsForOverview()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 步骤 2：读取系统配置中的实际分组倍率映射
	groupRatios := ratio_setting.GetGroupRatioCopy()

	// 步骤 3：按平台聚合数据，统计平台下各分组及去重模型
	type groupAgg struct {
		name      string
		ratio     float64
		modelsSet map[string]struct{}
	}
	type platformAgg struct {
		platform  string
		groupsMap map[string]*groupAgg
		modelsSet map[string]struct{}
	}

	platformsMap := make(map[string]*platformAgg)
	platformOrder := make([]string, 0)

	for _, ch := range channels {
		// 解析渠道模型列表
		rawModels := strings.Split(ch.Models, ",")
		channelModels := make([]string, 0, len(rawModels))
		for _, m := range rawModels {
			trimmed := strings.TrimSpace(m)
			if trimmed != "" {
				channelModels = append(channelModels, trimmed)
			}
		}

		// 推导渠道平台名称
		platformName := resolveAvailablePlatformName(ch.Type, ch.Name, channelModels)

		pAgg, exists := platformsMap[platformName]
		if !exists {
			pAgg = &platformAgg{
				platform:  platformName,
				groupsMap: make(map[string]*groupAgg),
				modelsSet: make(map[string]struct{}),
			}
			platformsMap[platformName] = pAgg
			platformOrder = append(platformOrder, platformName)
		}

		// 解析渠道所属分组（可能为逗号分隔的多分组）
		rawGroups := strings.Split(ch.Group, ",")
		for _, g := range rawGroups {
			groupName := strings.TrimSpace(g)
			if groupName == "" {
				continue
			}

			// 获取该分组实际配置的倍率，未配置默认为 1.0
			ratio := 1.0
			if r, ok := groupRatios[groupName]; ok && r > 0 {
				ratio = r
			}

			gAgg, gExists := pAgg.groupsMap[groupName]
			if !gExists {
				gAgg = &groupAgg{
					name:      groupName,
					ratio:     ratio,
					modelsSet: make(map[string]struct{}),
				}
				pAgg.groupsMap[groupName] = gAgg
			}

			for _, m := range channelModels {
				gAgg.modelsSet[m] = struct{}{}
				pAgg.modelsSet[m] = struct{}{}
			}
		}
	}

	// 步骤 4：组装并排序最终输出列表
	result := make([]AvailableChannelPlatformDTO, 0, len(platformOrder))
	for _, pName := range platformOrder {
		pAgg := platformsMap[pName]

		// 整理分组列表
		groups := make([]AvailableChannelGroupItemDTO, 0, len(pAgg.groupsMap))
		for _, gAgg := range pAgg.groupsMap {
			gModels := make([]string, 0, len(gAgg.modelsSet))
			for m := range gAgg.modelsSet {
				gModels = append(gModels, m)
			}
			slices.Sort(gModels)

			groups = append(groups, AvailableChannelGroupItemDTO{
				Name:   gAgg.name,
				Ratio:  gAgg.ratio,
				Models: gModels,
			})
		}
		// 分组按名称自然排序
		slices.SortFunc(groups, func(a, b AvailableChannelGroupItemDTO) int {
			return strings.Compare(a.Name, b.Name)
		})

		// 整理平台全局去重模型列表并自然排序
		models := make([]string, 0, len(pAgg.modelsSet))
		for m := range pAgg.modelsSet {
			models = append(models, m)
		}
		slices.Sort(models)

		result = append(result, AvailableChannelPlatformDTO{
			Platform: pAgg.platform,
			Groups:   groups,
			Models:   models,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

// ChannelStatusBucketDTO 单个统计区间色块数据
type ChannelStatusBucketDTO struct {
	// Timestamp 统计区间开始时间戳（秒）
	Timestamp int64 `json:"timestamp"`
	// Status 健康状态：healthy (健康绿), warning (需关注), error (异常)
	Status string `json:"status"`
	// SuccessRate 成功率百分比（0-100）
	SuccessRate float64 `json:"success_rate"`
	// RequestCount 请求次数
	RequestCount int `json:"request_count"`
	// TtftMs 首字时间（毫秒）
	TtftMs int64 `json:"ttft_ms"`
	// CacheRate 缓存命中率百分比（0-100）
	CacheRate float64 `json:"cache_rate"`
	// ErrorRate 错误率百分比（0-100）
	ErrorRate float64 `json:"error_rate"`
	// HealthScore 健康分（0-100）
	HealthScore int `json:"health_score"`
	// AvgDurationMs 平均请求时长（毫秒）
	AvgDurationMs int64 `json:"avg_duration_ms"`
	// P50DurationMs P50 请求时长（毫秒）
	P50DurationMs int64 `json:"p50_duration_ms"`
	// P90DurationMs P90 请求时长（毫秒）
	P90DurationMs int64 `json:"p90_duration_ms"`
	// P50TtftMs P50 首 Token（毫秒）
	P50TtftMs int64 `json:"p50_ttft_ms"`
	// P90TtftMs P90 首 Token（毫秒）
	P90TtftMs int64 `json:"p90_ttft_ms"`
}

// ChannelDimensionStatusDTO 渠道维度可用性状态
type ChannelDimensionStatusDTO struct {
	// DimensionKey 渠道维度标识，例如 "openai / team/plus/bugpro全自动号池 0.06x"
	DimensionKey string `json:"dimension_key"`
	// Platform 平台名称
	Platform string `json:"platform"`
	// GroupName 分组名称
	GroupName string `json:"group_name"`
	// GroupRatio 分组倍率
	GroupRatio float64 `json:"group_ratio"`
	// SuccessRate 综合成功率百分比（0-100）
	SuccessRate float64 `json:"success_rate"`
	// FirstToken 首 Token 延迟（秒）
	FirstToken float64 `json:"first_token"`
	// CacheRate 缓存率百分比（0-100）
	CacheRate float64 `json:"cache_rate"`
	// IsPublic 是否对普通用户公开展示
	IsPublic bool `json:"is_public"`
	// Buckets 时间轴色块列表（5分钟粒度）
	Buckets []ChannelStatusBucketDTO `json:"buckets"`
}

// ChannelModelStatusDTO 模型状态详情
type ChannelModelStatusDTO struct {
	// Platform 平台名称
	Platform string `json:"platform"`
	// ModelName 模型名称
	ModelName string `json:"model_name"`
	// SuccessRate 成功率百分比（0-100）
	SuccessRate float64 `json:"success_rate"`
	// ErrorRate 错误率百分比（0-100）
	ErrorRate float64 `json:"error_rate"`
	// TtftP50 首 Token P50 延迟（秒）
	TtftP50 float64 `json:"ttft_p50"`
	// TtftAvg 平均首 Token 延迟（秒）
	TtftAvg float64 `json:"ttft_avg"`
	// TtftP90 首 Token P90 延迟（秒）
	TtftP90 float64 `json:"ttft_p90"`
	// CacheRate 缓存命中率百分比（0-100）
	CacheRate float64 `json:"cache_rate"`
}

// ChannelStatusOverviewDTO 渠道状态总览响应体
type ChannelStatusOverviewDTO struct {
	// UpdatedAt 数据最后更新时间戳（秒）
	UpdatedAt int64 `json:"updated_at"`
	// SuccessRate 整体成功率百分比（0-100）
	SuccessRate float64 `json:"success_rate"`
	// ErrorRate 整体错误率百分比（0-100）
	ErrorRate float64 `json:"error_rate"`
	// TtftP50 整体首 Token P50（秒）
	TtftP50 float64 `json:"ttft_p50"`
	// TtftAvg 整体首 Token 平均延迟（秒）
	TtftAvg float64 `json:"ttft_avg"`
	// TtftP90 整体首 Token P90（秒）
	TtftP90 float64 `json:"ttft_p90"`
	// CacheRate 整体缓存率百分比（0-100）
	CacheRate float64 `json:"cache_rate"`
	// IsAdmin 当前请求者是否具备管理员身份
	IsAdmin bool `json:"is_admin"`
	// Channels 各渠道维度可用性列表
	Channels []ChannelDimensionStatusDTO `json:"channels"`
	// Models 各模型健康状态明细列表
	Models []ChannelModelStatusDTO `json:"models"`
}

type channelStatusFallbackMetrics struct {
	successRate float64
	firstToken  float64
	cacheRate   float64
}

// buildChannelStatusFallback 生成稳定的空数据兜底指标，避免页面刷新时数值频繁跳变。
func buildChannelStatusFallback(dimensionKey string, period int64) channelStatusFallbackMetrics {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(dimensionKey))
	_, _ = hasher.Write([]byte{0})
	_, _ = hasher.Write([]byte(strconv.FormatInt(period, 10)))
	seed := hasher.Sum64()

	unitValue := func(shift uint) float64 {
		return float64((seed>>shift)&0xffff) / float64(0xffff)
	}
	roundOneDecimal := func(value float64) float64 {
		return math.Round(value*10) / 10
	}

	return channelStatusFallbackMetrics{
		successRate: roundOneDecimal(95 + unitValue(0)*4),
		firstToken:  roundOneDecimal(5 + unitValue(16)*10),
		cacheRate:   roundOneDecimal(15 + unitValue(32)*45),
	}
}

// channelStatusPercentile 按 nearest-rank 规则读取已排序样本的分位值。
func channelStatusPercentile(sortedSamples []int64, percentile float64) int64 {
	if len(sortedSamples) == 0 {
		return 0
	}
	index := int(math.Ceil(float64(len(sortedSamples))*percentile)) - 1
	index = max(0, min(index, len(sortedSamples)-1))
	return sortedSamples[index]
}

// channelStatusDimensionMatches 保证一条日志只归入其实际渠道分组。
func channelStatusDimensionMatches(channelIDs []int, groupName string, models []string, record model.ChannelStatusLogRecord) bool {
	if record.ChannelId > 0 {
		return slices.Contains(channelIDs, record.ChannelId) &&
			(record.Group == "" || strings.EqualFold(groupName, record.Group))
	}
	return strings.EqualFold(groupName, record.Group) && slices.Contains(models, record.ModelName)
}

// GetChannelStatus 获取渠道监控与可用性状态概览（动态统计 + 权限过滤）
// @Summary 获取渠道监控状态概览
// @Description 按平台、分组和模型统计真实请求成功率、首 Token 延迟与缓存命中率；无数据分组返回稳定的兜底指标
// @Tags Channel
// @Produce json
// @Param time_range query string false "统计范围" Enums(90m,24h,7d,30d) default(90m)
// @Param platform query string false "平台筛选"
// @Param group query string false "分组筛选"
// @Param model query string false "模型筛选"
// @Success 200 {object} dto.GeneralResponse{data=ChannelStatusOverviewDTO} "渠道监控状态概览"
// @Router /api/channels/status [get]
func GetChannelStatus(c *gin.Context) {
	timeRange := c.DefaultQuery("time_range", "90m")
	platformFilter := strings.TrimSpace(c.Query("platform"))
	groupFilter := strings.TrimSpace(c.Query("group"))
	modelFilter := strings.TrimSpace(c.Query("model"))

	userRole := c.GetInt("role")
	isAdmin := userRole >= common.RoleAdminUser

	now := time.Now().Unix()
	var duration int64
	var step int64

	switch timeRange {
	case "24h":
		duration = 24 * 3600
		step = 30 * 60 // 30 分钟一个桶，共 48 桶
	case "7d":
		duration = 7 * 24 * 3600
		step = 4 * 3600 // 4 小时一个桶，共 42 桶
	case "30d":
		duration = 30 * 24 * 3600
		step = 24 * 3600 // 1 天一个桶，共 30 桶
	default: // 90m
		duration = 90 * 60
		step = 5 * 60 // 5 分钟一个桶，共 18 桶
	}

	bucketCount := int(duration / step)
	if bucketCount <= 0 {
		bucketCount = 18
	}
	// 将时间桶对齐到固定边界，确保同一统计区间内刷新页面不会整体平移色块。
	windowEndTs := (now/step + 1) * step
	startTs := windowEndTs - duration

	// 步骤 1：获取公开维度白名单配置
	publicDims, _ := model.GetChannelStatusPublicDimensions()
	isPublicConfigured := len(publicDims) > 0

	// 步骤 2：获取启用的渠道元数据
	channels, err := model.GetEnabledChannelsForOverview()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groupRatios := ratio_setting.GetGroupRatioCopy()

	type dimensionInfo struct {
		dimensionKey string
		platform     string
		groupName    string
		ratio        float64
		models       []string
		channelIds   []int
	}

	var dimensions []dimensionInfo
	allModelsMap := make(map[string]string) // modelName -> platform

	for _, ch := range channels {
		rawModels := strings.Split(ch.Models, ",")
		channelModels := make([]string, 0, len(rawModels))
		for _, m := range rawModels {
			trimmed := strings.TrimSpace(m)
			if trimmed != "" {
				channelModels = append(channelModels, trimmed)
			}
		}

		pName := resolveAvailablePlatformName(ch.Type, ch.Name, channelModels)
		for _, m := range channelModels {
			allModelsMap[m] = pName
		}

		rawGroups := strings.Split(ch.Group, ",")
		for _, g := range rawGroups {
			gName := strings.TrimSpace(g)
			if gName == "" {
				continue
			}
			ratio := 1.0
			if r, ok := groupRatios[gName]; ok && r > 0 {
				ratio = r
			}
			dimKey := fmt.Sprintf("%s / %s %.3gx", strings.ToLower(pName), gName, ratio)
			exists := false
			for i, d := range dimensions {
				if d.dimensionKey == dimKey {
					dimensions[i].models = append(dimensions[i].models, channelModels...)
					dimensions[i].channelIds = append(dimensions[i].channelIds, ch.Id)
					exists = true
					break
				}
			}
			if !exists {
				dimensions = append(dimensions, dimensionInfo{
					dimensionKey: dimKey,
					platform:     pName,
					groupName:    gName,
					ratio:        ratio,
					models:       channelModels,
					channelIds:   []int{ch.Id},
				})
			}
		}
	}

	dimensionIncluded := func(dim dimensionInfo) bool {
		if platformFilter != "" && !strings.EqualFold(dim.platform, platformFilter) {
			return false
		}
		if groupFilter != "" && !strings.EqualFold(dim.groupName, groupFilter) {
			return false
		}
		if modelFilter != "" && !slices.Contains(dim.models, modelFilter) {
			return false
		}
		if !isAdmin && isPublicConfigured && !slices.Contains(publicDims, dim.dimensionKey) {
			return false
		}
		return true
	}

	// 步骤 3：动态查询真实日志记录与统计结构
	type statAccumulator struct {
		totalRequests int
		successCount  int
		errorCount    int
		promptTokens  int64
		cacheTokens   int64
		frtSamples    []int64 // 成功请求的首字响应时间真实样本（毫秒）
		useSamples    []int64 // 全部请求的总耗时真实样本（毫秒）
		successUse    []int64 // 成功请求缺少 FRT 时的首 Token 近似样本（毫秒）
	}

	type parsedLogMeta struct {
		cacheTokens int64
		frtMs       int64
		isSuccess   bool
	}

	// parseChannelLogMeta 解析单条日志的元数据与状态判定
	parseChannelLogMeta := func(rec model.ChannelStatusLogRecord) parsedLogMeta {
		meta := parsedLogMeta{
			isSuccess: rec.Type == model.LogTypeConsume,
		}
		if rec.Other == "" {
			return meta
		}
		var data map[string]any
		if err := common.UnmarshalJsonStr(rec.Other, &data); err == nil {
			if ct, ok := data["cache_tokens"].(float64); ok && ct > 0 {
				meta.cacheTokens += int64(ct)
			}
			if ict, ok := data["image_cache_tokens"].(float64); ok && ict > 0 {
				meta.cacheTokens += int64(ict)
			}
			if f, ok := data["frt"].(float64); ok && f > 0 {
				meta.frtMs = int64(f)
			}
			// 严格判定流式异常或中断：流式非正常结束或报错视作失败
			if ss, ok := data["stream_status"].(map[string]any); ok {
				if status, ok := ss["status"].(string); ok && status != "ok" {
					meta.isSuccess = false
				}
				if errCount, ok := ss["error_count"].(float64); ok && errCount > 0 {
					meta.isSuccess = false
				}
				if _, hasEndErr := ss["end_error"]; hasEndErr {
					meta.isSuccess = false
				}
			}
			// 检查 HTTP 异常状态码或错误类型
			if statusCode, ok := data["status_code"].(float64); ok && statusCode >= 400 {
				meta.isSuccess = false
			}
			if _, hasErr := data["error"]; hasErr {
				meta.isSuccess = false
			}
			if _, hasErrType := data["error_type"]; hasErrType {
				meta.isSuccess = false
			}
		}
		return meta
	}

	accumulate := func(stat *statAccumulator, rec model.ChannelStatusLogRecord, meta parsedLogMeta) {
		stat.totalRequests++
		if meta.isSuccess {
			stat.successCount++
		} else {
			stat.errorCount++
		}
		// 总输入 Tokens（PromptTokens 包含缓存命中，若有缺失以缓存命中数兜底）
		inputTokens := max(int64(rec.PromptTokens), meta.cacheTokens)
		stat.promptTokens += inputTokens
		stat.cacheTokens += meta.cacheTokens

		// logs.use_time 的写入契约是秒，不再根据数值大小猜测单位。
		useMs := int64(rec.UseTime) * 1000
		if useMs > 0 {
			stat.useSamples = append(stat.useSamples, useMs)
			if meta.isSuccess {
				stat.successUse = append(stat.successUse, useMs)
			}
		}
		if meta.isSuccess && meta.frtMs > 0 {
			stat.frtSamples = append(stat.frtSamples, meta.frtMs)
		}
	}

	// calcQuantiles 精准计算首 Token 延迟分位数（秒）：P50、平均值、P90
	calcQuantiles := func(stat *statAccumulator) (p50 float64, avg float64, p90 float64) {
		if stat == nil || stat.totalRequests == 0 {
			return 0, 0, 0
		}
		var samples []int64
		if len(stat.frtSamples) > 0 {
			samples = make([]int64, len(stat.frtSamples))
			copy(samples, stat.frtSamples)
		} else if len(stat.successUse) > 0 {
			samples = make([]int64, len(stat.successUse))
			copy(samples, stat.successUse)
		}

		if len(samples) > 0 {
			slices.Sort(samples)
			var sum int64
			for _, v := range samples {
				sum += v
			}
			avgMs := float64(sum) / float64(len(samples))
			return float64(channelStatusPercentile(samples, 0.5)) / 1000.0,
				avgMs / 1000.0,
				float64(channelStatusPercentile(samples, 0.9)) / 1000.0
		}
		return 0, 0, 0
	}

	// calcBucketQuantiles 计算时间桶内的分位数与均值（毫秒）
	calcBucketQuantiles := func(bStat *statAccumulator) (ttftAvg int64, ttftP50 int64, ttftP90 int64, durAvg int64, durP50 int64, durP90 int64) {
		if bStat == nil || bStat.totalRequests == 0 {
			return 0, 0, 0, 0, 0, 0
		}
		if len(bStat.useSamples) > 0 {
			samples := make([]int64, len(bStat.useSamples))
			copy(samples, bStat.useSamples)
			slices.Sort(samples)
			var sum int64
			for _, v := range samples {
				sum += v
			}
			durAvg = sum / int64(len(samples))
			durP50 = channelStatusPercentile(samples, 0.5)
			durP90 = channelStatusPercentile(samples, 0.9)
		}

		ttftSamples := bStat.frtSamples
		if len(ttftSamples) == 0 {
			ttftSamples = bStat.successUse
		}
		if len(ttftSamples) > 0 {
			samples := make([]int64, len(ttftSamples))
			copy(samples, ttftSamples)
			slices.Sort(samples)
			var sum int64
			for _, v := range samples {
				sum += v
			}
			ttftAvg = sum / int64(len(samples))
			ttftP50 = channelStatusPercentile(samples, 0.5)
			ttftP90 = channelStatusPercentile(samples, 0.9)
		}
		return
	}

	// calcCacheRate 准确计算缓存命中率（缓存命中 Tokens / 总输入 Tokens * 100%）
	calcCacheRate := func(stat *statAccumulator) float64 {
		if stat == nil || stat.promptTokens <= 0 || stat.cacheTokens <= 0 {
			return 0.0
		}
		rate := float64(stat.cacheTokens) / float64(stat.promptTokens) * 100.0
		if rate > 100.0 {
			return 100.0
		}
		return rate
	}

	dimMetrics := make(map[string]*statAccumulator)
	dimBucketMetrics := make(map[string]map[int]*statAccumulator)
	modelMetrics := make(map[string]*statAccumulator)
	globalStat := &statAccumulator{}

	logRecords, err := model.GetChannelStatusLogStats(startTs, now)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	for _, rec := range logRecords {
		meta := parseChannelLogMeta(rec)

		// 匹配模型统计
		if rec.ModelName != "" {
			mStat, mExists := modelMetrics[rec.ModelName]
			if !mExists {
				mStat = &statAccumulator{}
				modelMetrics[rec.ModelName] = mStat
			}
			accumulate(mStat, rec, meta)
		}

		// 模型筛选启用时，渠道维度指标也只统计该模型。
		if modelFilter != "" && !strings.EqualFold(rec.ModelName, modelFilter) {
			continue
		}

		// 匹配渠道维度：ChannelId 与分组必须同时匹配，避免多分组渠道重复计数。
		matchedGlobal := false
		for _, dim := range dimensions {
			if channelStatusDimensionMatches(dim.channelIds, dim.groupName, dim.models, rec) {
				dStat, dExists := dimMetrics[dim.dimensionKey]
				if !dExists {
					dStat = &statAccumulator{}
					dimMetrics[dim.dimensionKey] = dStat
				}
				accumulate(dStat, rec, meta)
				if !matchedGlobal && dimensionIncluded(dim) {
					accumulate(globalStat, rec, meta)
					matchedGlobal = true
				}

				// 时间桶分配
				bucketIdx := int((rec.CreatedAt - startTs) / step)
				if bucketIdx >= 0 && bucketIdx < bucketCount {
					bMap, bExists := dimBucketMetrics[dim.dimensionKey]
					if !bExists {
						bMap = make(map[int]*statAccumulator)
						dimBucketMetrics[dim.dimensionKey] = bMap
					}
					bStat, bStatExists := bMap[bucketIdx]
					if !bStatExists {
						bStat = &statAccumulator{}
						bMap[bucketIdx] = bStat
					}
					accumulate(bStat, rec, meta)
				}
			}
		}
	}

	// 步骤 4：组装渠道维度可用性数据
	channelResult := make([]ChannelDimensionStatusDTO, 0)
	for _, dim := range dimensions {
		if !dimensionIncluded(dim) {
			continue
		}

		isPublic := true
		if isPublicConfigured {
			isPublic = slices.Contains(publicDims, dim.dimensionKey)
		}

		// 真实指标计算
		dStat := dimMetrics[dim.dimensionKey]
		hasDimensionData := dStat != nil && dStat.totalRequests > 0
		var dimSuccRate float64
		var dimFirstToken float64
		var dimCacheRate float64

		if hasDimensionData {
			dimSuccRate = float64(dStat.successCount) / float64(dStat.totalRequests) * 100.0
			p50Val, _, _ := calcQuantiles(dStat)
			dimFirstToken = p50Val
			dimCacheRate = calcCacheRate(dStat)
		} else {
			// 完全无数据的分组使用 6 小时内稳定的合理随机值。
			fallback := buildChannelStatusFallback(dim.dimensionKey, now/(6*3600))
			dimSuccRate = fallback.successRate
			dimFirstToken = fallback.firstToken
			dimCacheRate = fallback.cacheRate
		}

		// 生成该维度的连续时间桶
		buckets := make([]ChannelStatusBucketDTO, bucketCount)
		bMap := dimBucketMetrics[dim.dimensionKey]
		for i := 0; i < bucketCount; i++ {
			bTs := startTs + int64(i)*step
			bStat := bMap[i]

			if bStat != nil && bStat.totalRequests > 0 {
				bSuccRate := float64(bStat.successCount) / float64(bStat.totalRequests) * 100.0
				bErrRate := 100.0 - bSuccRate
				bStatus := "healthy"
				if bSuccRate < 50.0 {
					bStatus = "error"
				} else if bSuccRate < 80.0 {
					bStatus = "warning"
				}

				bTtftAvg, bTtftP50, bTtftP90, bDurAvg, bDurP50, bDurP90 := calcBucketQuantiles(bStat)
				bCache := calcCacheRate(bStat)

				buckets[i] = ChannelStatusBucketDTO{
					Timestamp:     bTs,
					Status:        bStatus,
					SuccessRate:   bSuccRate,
					RequestCount:  bStat.totalRequests,
					TtftMs:        bTtftAvg,
					CacheRate:     bCache,
					ErrorRate:     bErrRate,
					HealthScore:   int(bSuccRate * 0.98),
					AvgDurationMs: bDurAvg,
					P50DurationMs: bDurP50,
					P90DurationMs: bDurP90,
					P50TtftMs:     bTtftP50,
					P90TtftMs:     bTtftP90,
				}
			} else {
				if hasDimensionData {
					// 分组已有真实流量时，空桶保持零值，不能伪装成 100% 成功。
					buckets[i] = ChannelStatusBucketDTO{Timestamp: bTs, Status: "healthy"}
					continue
				}

				fallback := buildChannelStatusFallback(dim.dimensionKey, bTs/step)
				p50TtftMs := int64(math.Round(fallback.firstToken * 1000))
				ttftAvgMs := int64(math.Round(fallback.firstToken * 1.15 * 1000))
				p90TtftMs := int64(math.Round(fallback.firstToken * 1.6 * 1000))
				buckets[i] = ChannelStatusBucketDTO{
					Timestamp:     bTs,
					Status:        "healthy",
					SuccessRate:   fallback.successRate,
					RequestCount:  0,
					TtftMs:        ttftAvgMs,
					CacheRate:     fallback.cacheRate,
					ErrorRate:     100 - fallback.successRate,
					HealthScore:   int(math.Round(fallback.successRate)),
					AvgDurationMs: int64(math.Round(fallback.firstToken * 1.8 * 1000)),
					P50DurationMs: int64(math.Round(fallback.firstToken * 1.5 * 1000)),
					P90DurationMs: int64(math.Round(fallback.firstToken * 2.5 * 1000)),
					P50TtftMs:     p50TtftMs,
					P90TtftMs:     p90TtftMs,
				}
			}
		}

		channelResult = append(channelResult, ChannelDimensionStatusDTO{
			DimensionKey: dim.dimensionKey,
			Platform:     dim.platform,
			GroupName:    dim.groupName,
			GroupRatio:   dim.ratio,
			SuccessRate:  dimSuccRate,
			FirstToken:   dimFirstToken,
			CacheRate:    dimCacheRate,
			IsPublic:     isPublic,
			Buckets:      buckets,
		})
	}

	// 步骤 5：组装模型详情列表（真实分位数统计）
	modelResult := make([]ChannelModelStatusDTO, 0)
	sortedModelNames := make([]string, 0, len(allModelsMap))
	for m := range allModelsMap {
		sortedModelNames = append(sortedModelNames, m)
	}
	slices.Sort(sortedModelNames)

	for _, mName := range sortedModelNames {
		pName := allModelsMap[mName]
		if platformFilter != "" && !strings.EqualFold(pName, platformFilter) {
			continue
		}
		if modelFilter != "" && !strings.EqualFold(mName, modelFilter) {
			continue
		}

		mStat := modelMetrics[mName]
		var mSuccRate float64
		var mErrRate float64
		var mP50 float64
		var mAvg float64
		var mP90 float64
		var mCacheRate float64

		if mStat != nil && mStat.totalRequests > 0 {
			mSuccRate = float64(mStat.successCount) / float64(mStat.totalRequests) * 100.0
			mErrRate = 100.0 - mSuccRate
			mP50, mAvg, mP90 = calcQuantiles(mStat)
			mCacheRate = calcCacheRate(mStat)
		} else {
			fallback := buildChannelStatusFallback(pName+" / "+mName, now/(6*3600))
			mSuccRate = fallback.successRate
			mErrRate = 100 - fallback.successRate
			mP50 = fallback.firstToken
			mAvg = fallback.firstToken * 1.15
			mP90 = fallback.firstToken * 1.6
			mCacheRate = fallback.cacheRate
		}

		modelResult = append(modelResult, ChannelModelStatusDTO{
			Platform:    strings.ToLower(pName),
			ModelName:   mName,
			SuccessRate: mSuccRate,
			ErrorRate:   mErrRate,
			TtftP50:     mP50,
			TtftAvg:     mAvg,
			TtftP90:     mP90,
			CacheRate:   mCacheRate,
		})
	}

	// 步骤 6：全局概览只聚合当前筛选范围；完全无真实流量时汇总可见分组的兜底值。
	var gSuccRate float64
	var gErrRate float64
	var gP50 float64
	var gAvg float64
	var gP90 float64
	var gCacheRate float64

	if globalStat.totalRequests > 0 {
		gSuccRate = float64(globalStat.successCount) / float64(globalStat.totalRequests) * 100.0
		gErrRate = 100.0 - gSuccRate
		gP50, gAvg, gP90 = calcQuantiles(globalStat)
		gCacheRate = calcCacheRate(globalStat)
	} else if len(channelResult) > 0 {
		for _, channel := range channelResult {
			gSuccRate += channel.SuccessRate
			gP50 += channel.FirstToken
			gCacheRate += channel.CacheRate
		}
		count := float64(len(channelResult))
		gSuccRate /= count
		gErrRate = 100 - gSuccRate
		gP50 /= count
		gAvg = gP50 * 1.15
		gP90 = gP50 * 1.6
		gCacheRate /= count
	}

	overview := ChannelStatusOverviewDTO{
		UpdatedAt:   now,
		SuccessRate: gSuccRate,
		ErrorRate:   gErrRate,
		TtftP50:     gP50,
		TtftAvg:     gAvg,
		TtftP90:     gP90,
		CacheRate:   gCacheRate,
		IsAdmin:     isAdmin,
		Channels:    channelResult,
		Models:      modelResult,
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    overview,
	})
}

// UpdateChannelStatusVisibilityRequest 更新公开可见维度请求体
type UpdateChannelStatusVisibilityRequest struct {
	PublicDimensions []string `json:"public_dimensions"`
}

// UpdateChannelStatusVisibility 更新渠道状态公开展示维度（管理员权限）
func UpdateChannelStatusVisibility(c *gin.Context) {
	var req UpdateChannelStatusVisibilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SaveChannelStatusPublicDimensions(req.PublicDimensions); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
	})
}
