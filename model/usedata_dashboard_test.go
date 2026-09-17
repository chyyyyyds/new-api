package model

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestAggregateDashboardUsageLogs(t *testing.T) {
	result := aggregateDashboardUsageLogs([]dashboardUsageLog{
		{
			ModelName:        "gpt-test",
			CreatedAt:        1_725_156_000,
			Quota:            500,
			PromptTokens:     1_000,
			CompletionTokens: 100,
			Other:            `{"group_ratio":0.5,"cache_tokens":400,"cache_creation_tokens":100}`,
		},
		{
			ModelName:        "gpt-test",
			CreatedAt:        1_725_159_600,
			Quota:            300,
			PromptTokens:     300,
			CompletionTokens: 50,
			Other:            `{"group_ratio":1}`,
		},
	}, "day", 480)

	require.Len(t, result.Models, 1)
	assert.Equal(t, 2, result.Models[0].Requests)
	assert.Equal(t, int64(800), result.Models[0].InputTokens)
	assert.Equal(t, int64(150), result.Models[0].OutputTokens)
	assert.Equal(t, int64(100), result.Models[0].CacheCreationTokens)
	assert.Equal(t, int64(400), result.Models[0].CacheReadTokens)
	assert.Equal(t, int64(1_450), result.Models[0].TotalTokens)
	assert.Equal(t, int64(800), result.Models[0].ActualQuota)
	assert.Equal(t, float64(1_300), result.Models[0].StandardQuota)
	require.Len(t, result.Timeline, 1)
	assert.InDelta(t, 400.0/1200.0*100, result.Timeline[0].CacheHitRate, 0.001)
}

func TestGetDashboardUsageDetailsDatabaseMatrix(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{
			name: "sqlite",
			dsn:  filepath.Join(t.TempDir(), "dashboard.db"),
			open: func(dsn string) gorm.Dialector { return sqlite.Open(dsn) },
		},
		{
			name: "mysql",
			dsn:  os.Getenv("TEST_MYSQL_DSN"),
			open: func(dsn string) gorm.Dialector { return mysql.Open(dsn) },
		},
		{
			name: "postgres",
			dsn:  os.Getenv("TEST_POSTGRES_DSN"),
			open: func(dsn string) gorm.Dialector { return postgres.Open(dsn) },
		},
	}

	previousLogDB := LOG_DB
	t.Cleanup(func() { LOG_DB = previousLogDB })
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.dsn == "" {
				t.Skip("未配置该数据库的测试 DSN")
			}
			db, err := gorm.Open(test.open(test.dsn), &gorm.Config{})
			require.NoError(t, err)
			require.NoError(t, db.Migrator().DropTable(&Log{}))
			require.NoError(t, db.AutoMigrate(&Log{}))
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&Log{})) })

			LOG_DB = db
			require.NoError(t, db.Create(&Log{
				UserId:           7,
				Username:         "dashboard-user",
				CreatedAt:        1_725_156_000,
				Type:             LogTypeConsume,
				ModelName:        "gpt-test",
				Quota:            500,
				PromptTokens:     1_000,
				CompletionTokens: 100,
				Other:            `{"group_ratio":0.5,"cache_tokens":400,"cache_creation_tokens":100}`,
			}).Error)

			result, err := GetDashboardUsageDetails(
				1_725_155_000,
				1_725_157_000,
				"",
				7,
				"day",
				480,
			)
			require.NoError(t, err)
			require.Len(t, result.Models, 1)
			assert.Equal(t, int64(500), result.Models[0].InputTokens)
			assert.Equal(t, float64(1_000), result.Models[0].StandardQuota)
		})
	}
}
