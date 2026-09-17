package model

import (
	"fmt"
	"math"
	"slices"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id        int    `json:"id"`
	UserID    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	UseGroup  string `json:"use_group" gorm:"index;size:64;default:''"`
	TokenID   int    `json:"token_id" gorm:"index;default:0"`
	ChannelID int    `json:"channel_id" gorm:"index;default:0"`
	NodeName  string `json:"node_name" gorm:"index;size:64;default:''"`
	TokenUsed int    `json:"token_used" gorm:"default:0"`
	Count     int    `json:"count" gorm:"default:0"`
	Quota     int    `json:"quota" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID    int
	Username  string
	ModelName string
	Quota     int
	CreatedAt int64
	TokenUsed int
	UseGroup  string
	TokenID   int
	ChannelID int
	NodeName  string
}

// DashboardUsageModel 汇总数据看板中的单个模型用量。
type DashboardUsageModel struct {
	ModelName           string  `json:"model_name"`            // 模型名称
	Requests            int     `json:"requests"`              // 请求次数
	InputTokens         int64   `json:"input_tokens"`          // 非缓存输入 Token
	OutputTokens        int64   `json:"output_tokens"`         // 输出 Token
	CacheCreationTokens int64   `json:"cache_creation_tokens"` // 缓存创建 Token
	CacheReadTokens     int64   `json:"cache_read_tokens"`     // 缓存读取 Token
	TotalTokens         int64   `json:"total_tokens"`          // 总 Token
	ActualQuota         int64   `json:"actual_quota"`          // 应用分组倍率后的实际额度
	StandardQuota       float64 `json:"standard_quota"`        // 未应用分组倍率的标准额度
}

// DashboardUsageTimeline 汇总数据看板中的单个时间点用量。
type DashboardUsageTimeline struct {
	Timestamp           int64   `json:"timestamp"`             // 时间桶起始时间戳
	InputTokens         int64   `json:"input_tokens"`          // 非缓存输入 Token
	OutputTokens        int64   `json:"output_tokens"`         // 输出 Token
	CacheCreationTokens int64   `json:"cache_creation_tokens"` // 缓存创建 Token
	CacheReadTokens     int64   `json:"cache_read_tokens"`     // 缓存读取 Token
	CacheHitRate        float64 `json:"cache_hit_rate"`        // 缓存命中率，范围 0-100
}

// DashboardUsageDetails 是模型分布和 Token 趋势图的数据源。
type DashboardUsageDetails struct {
	Models   []DashboardUsageModel    `json:"models"`   // 按模型汇总的数据
	Timeline []DashboardUsageTimeline `json:"timeline"` // 按时间粒度汇总的数据
}

type dashboardUsageLog struct {
	ModelName        string
	CreatedAt        int64
	Quota            int
	PromptTokens     int
	CompletionTokens int
	Other            string
}

type dashboardUsageLogOther struct {
	GroupRatio            float64 `json:"group_ratio"`
	CacheTokens           int64   `json:"cache_tokens"`
	CacheCreationTokens   int64   `json:"cache_creation_tokens"`
	CacheCreationTokens5m int64   `json:"cache_creation_tokens_5m"`
	CacheCreationTokens1h int64   `json:"cache_creation_tokens_1h"`
}

type dashboardUsageAccumulator struct {
	granularity    string
	timezoneOffset int
	models         map[string]*DashboardUsageModel
	timeline       map[int64]*DashboardUsageTimeline
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog("正在更新数据看板数据...")
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

func logQuotaDataCache(quotaData *QuotaData) {
	key := fmt.Sprintf("%d\x00%s\x00%s\x00%d\x00%s\x00%d\x00%d\x00%s",
		quotaData.UserID,
		quotaData.Username,
		quotaData.ModelName,
		quotaData.CreatedAt,
		quotaData.UseGroup,
		quotaData.TokenID,
		quotaData.ChannelID,
		quotaData.NodeName,
	)
	count := quotaData.Count
	quota := quotaData.Quota
	tokenUsed := quotaData.TokenUsed
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
		cachedQuotaData.TokenUsed += tokenUsed
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	quotaData := &QuotaData{
		UserID:    params.UserID,
		Username:  params.Username,
		ModelName: params.ModelName,
		CreatedAt: createdAt,
		UseGroup:  params.UseGroup,
		TokenID:   params.TokenID,
		ChannelID: params.ChannelID,
		NodeName:  params.NodeName,
		Count:     1,
		Quota:     params.Quota,
		TokenUsed: params.TokenUsed,
	}

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(quotaData)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	// 如果缓存中有数据，就保存到数据库中
	// 1. 先查询数据库中是否有数据
	// 2. 如果有数据，就更新数据
	// 3. 如果没有数据，就插入数据
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		DB.Table("quota_data").
			Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
				quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
			First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			//quotaDataDB.Count += quotaData.Count
			//quotaDataDB.Quota += quotaData.Quota
			//DB.Table("quota_data").Save(quotaDataDB)
			increaseQuotaData(quotaData)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	common.SysLog(fmt.Sprintf("保存数据看板数据成功，共保存%d条数据", size))
}

func increaseQuotaData(quotaData *QuotaData) {
	err := DB.Table("quota_data").
		Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
		Updates(map[string]any{
			"count":      gorm.Expr("count + ?", quotaData.Count),
			"quota":      gorm.Expr("quota + ?", quotaData.Quota),
			"token_used": gorm.Expr("token_used + ?", quotaData.TokenUsed),
		}).Error
	if err != nil {
		common.SysLog(fmt.Sprintf("increaseQuotaData error: %s", err))
	}
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	err = DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	var quotaDatas []*QuotaData
	err = DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("username, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	var quotaDatas []*QuotaData
	// 从quota_data表中查询数据
	// only select model_name, sum(count) as count, sum(quota) as quota, model_name, created_at from quota_data group by model_name, created_at;
	//err = DB.Table("quota_data").Where("created_at >= ? and created_at <= ?", startTime, endTime).Find(&quotaDatas).Error
	err = DB.Table("quota_data").Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, created_at").Where("created_at >= ? and created_at <= ?", startTime, endTime).Group("model_name, created_at").Find(&quotaDatas).Error
	return quotaDatas, err
}

// GetDashboardUsageDetails 从消费日志中读取可拆分的 Token 与价格数据。
func GetDashboardUsageDetails(startTime, endTime int64, username string, userID int, granularity string, timezoneOffset int) (*DashboardUsageDetails, error) {
	query := LOG_DB.Model(&Log{}).
		Select("model_name, created_at, quota, prompt_tokens, completion_tokens, other").
		Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, startTime, endTime)
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	} else if username != "" {
		query = query.Where("username = ?", username)
	}

	rows, err := query.Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accumulator := newDashboardUsageAccumulator(granularity, timezoneOffset)
	for rows.Next() {
		var log dashboardUsageLog
		if err = LOG_DB.ScanRows(rows, &log); err != nil {
			return nil, err
		}
		accumulator.add(log)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	return accumulator.result(), nil
}

func aggregateDashboardUsageLogs(logs []dashboardUsageLog, granularity string, timezoneOffset int) *DashboardUsageDetails {
	accumulator := newDashboardUsageAccumulator(granularity, timezoneOffset)
	for _, log := range logs {
		accumulator.add(log)
	}
	return accumulator.result()
}

func newDashboardUsageAccumulator(granularity string, timezoneOffset int) *dashboardUsageAccumulator {
	return &dashboardUsageAccumulator{
		granularity:    granularity,
		timezoneOffset: timezoneOffset,
		models:         make(map[string]*DashboardUsageModel),
		timeline:       make(map[int64]*DashboardUsageTimeline),
	}
}

func (a *dashboardUsageAccumulator) add(log dashboardUsageLog) {
	modelName := log.ModelName
	if modelName == "" {
		modelName = "unknown"
	}

	var other dashboardUsageLogOther
	if log.Other != "" {
		_ = common.UnmarshalJsonStr(log.Other, &other)
	}
	cacheCreationTokens := other.CacheCreationTokens
	if other.CacheCreationTokens5m > 0 || other.CacheCreationTokens1h > 0 {
		cacheCreationTokens = other.CacheCreationTokens5m + other.CacheCreationTokens1h
	}
	cacheReadTokens := max(other.CacheTokens, 0)
	cacheCreationTokens = max(cacheCreationTokens, 0)
	outputTokens := int64(max(log.CompletionTokens, 0))
	inputTokens := int64(max(log.PromptTokens, 0)) - cacheReadTokens - cacheCreationTokens
	inputTokens = max(inputTokens, 0)
	totalTokens := inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens

	modelItem, ok := a.models[modelName]
	if !ok {
		modelItem = &DashboardUsageModel{ModelName: modelName}
		a.models[modelName] = modelItem
	}
	modelItem.Requests++
	modelItem.InputTokens += inputTokens
	modelItem.OutputTokens += outputTokens
	modelItem.CacheCreationTokens += cacheCreationTokens
	modelItem.CacheReadTokens += cacheReadTokens
	modelItem.TotalTokens += totalTokens
	modelItem.ActualQuota += int64(log.Quota)
	if other.GroupRatio > 0 && !math.IsNaN(other.GroupRatio) && !math.IsInf(other.GroupRatio, 0) {
		modelItem.StandardQuota += float64(log.Quota) / other.GroupRatio
	} else {
		modelItem.StandardQuota += float64(log.Quota)
	}

	bucket := dashboardUsageBucket(log.CreatedAt, a.granularity, a.timezoneOffset)
	timelineItem, ok := a.timeline[bucket]
	if !ok {
		timelineItem = &DashboardUsageTimeline{Timestamp: bucket}
		a.timeline[bucket] = timelineItem
	}
	timelineItem.InputTokens += inputTokens
	timelineItem.OutputTokens += outputTokens
	timelineItem.CacheCreationTokens += cacheCreationTokens
	timelineItem.CacheReadTokens += cacheReadTokens
}

func (a *dashboardUsageAccumulator) result() *DashboardUsageDetails {
	result := &DashboardUsageDetails{
		Models:   make([]DashboardUsageModel, 0, len(a.models)),
		Timeline: make([]DashboardUsageTimeline, 0, len(a.timeline)),
	}
	for _, item := range a.models {
		result.Models = append(result.Models, *item)
	}
	slices.SortFunc(result.Models, func(left, right DashboardUsageModel) int {
		if left.Requests != right.Requests {
			return right.Requests - left.Requests
		}
		if left.ModelName < right.ModelName {
			return -1
		}
		if left.ModelName > right.ModelName {
			return 1
		}
		return 0
	})

	for _, item := range a.timeline {
		cacheEligibleTokens := item.InputTokens + item.CacheReadTokens
		if cacheEligibleTokens > 0 {
			item.CacheHitRate = float64(item.CacheReadTokens) / float64(cacheEligibleTokens) * 100
		}
		result.Timeline = append(result.Timeline, *item)
	}
	slices.SortFunc(result.Timeline, func(left, right DashboardUsageTimeline) int {
		return int(left.Timestamp - right.Timestamp)
	})
	return result
}

func dashboardUsageBucket(timestamp int64, granularity string, timezoneOffset int) int64 {
	offsetSeconds := int64(timezoneOffset * 60)
	localTime := time.Unix(timestamp+offsetSeconds, 0).UTC()
	var bucket time.Time
	switch granularity {
	case "hour":
		bucket = localTime.Truncate(time.Hour)
	case "week":
		dayStart := time.Date(localTime.Year(), localTime.Month(), localTime.Day(), 0, 0, 0, 0, time.UTC)
		weekdayOffset := (int(dayStart.Weekday()) + 6) % 7
		bucket = dayStart.AddDate(0, 0, -weekdayOffset)
	default:
		bucket = time.Date(localTime.Year(), localTime.Month(), localTime.Day(), 0, 0, 0, 0, time.UTC)
	}
	return bucket.Unix() - offsetSeconds
}
