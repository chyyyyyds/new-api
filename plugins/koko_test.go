package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestKokoResponsesProtocol(t *testing.T) {
	testVideoResponsesProtocol(t, videoResponsesTestCase{
		pluginKey: "koko",
		model:     "seedance-2.5",
		requestBody: map[string]any{
			"model":      "seedance-2.5",
			"input":      "一只小狗在草地上奔跑",
			"duration":   14,
			"ratio":      "9:16",
			"resolution": "720p",
		},
		wantAction: "text_to_video",
		wantRequest: map[string]any{
			"model":      "seedance-2.5",
			"prompt":     "一只小狗在草地上奔跑",
			"duration":   float64(14),
			"ratio":      "9:16",
			"resolution": "720p",
			"count":      float64(1),
		},
		wantUsageKeys:  []string{"video_count"},
		wantVendorName: "koko",
	})
}

func TestKokoModelValidationAndPerRequestUsage(t *testing.T) {
	source, err := builtinplugins.Source("koko")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "koko"})
	require.NoError(t, err)

	tests := []struct {
		name       string
		model      string
		duration   int
		resolution string
		wantError  string
	}{
		{name: "Seedance 2.0 supports 5 seconds", model: "seedance-2.0", duration: 5, resolution: "720p"},
		{name: "Seedance 2.0 rejects 14 seconds", model: "seedance-2.0", duration: 14, resolution: "720p", wantError: "duration is not supported"},
		{name: "Seedance 2.5 supports 30 seconds", model: "seedance-2.5", duration: 30, resolution: "720p"},
		{name: "MiniMax supports 4 seconds", model: "minimaxh3", duration: 4, resolution: "2K"},
		{name: "MiniMax rejects 720p", model: "minimaxh3", duration: 15, resolution: "720p", wantError: "resolution is fixed"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			value, callErr := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_video", "decodeRequest"}, map[string]any{
				"model": test.model,
				"body": map[string]any{"kind": "json", "value": map[string]any{
					"model": test.model, "prompt": "测试视频", "duration": test.duration,
					"ratio": "16:9", "resolution": test.resolution, "count": 1,
				}},
			})
			if test.wantError != "" {
				require.ErrorContains(t, callErr, test.wantError)
				return
			}
			require.NoError(t, callErr)
			encoded, marshalErr := common.Marshal(value)
			require.NoError(t, marshalErr)
			var intent map[string]any
			require.NoError(t, common.Unmarshal(encoded, &intent))
			assert.Equal(t, test.model, intent["model"])
		})
	}

	for _, duration := range []int{4, 15, 30} {
		value, callErr := plugin.Engine.Call(t.Context(), "extractUsage", map[string]any{
			"requestBody": map[string]any{"duration": duration},
		})
		require.NoError(t, callErr)
		encoded, marshalErr := common.Marshal(value)
		require.NoError(t, marshalErr)
		var usage map[string]any
		require.NoError(t, common.Unmarshal(encoded, &usage))
		assert.Equal(t, float64(1), usage["video_count"])
	}
}

func TestKokoBuildRequestsAndPollStatuses(t *testing.T) {
	source, err := builtinplugins.Source("koko")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "koko"})
	require.NoError(t, err)

	value, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
		"model":         "minimaxh3",
		"upstreamModel": "minimaxh3",
		"baseUrl":       "https://pay.kokoai.online/openapi",
		"apiKey":        "secret",
		"publicTaskId":  "task-public-123",
		"requestBody": map[string]any{
			"model": "minimaxh3", "prompt": "测试视频", "duration": 4,
			"ratio": "16:9", "resolution": "2K", "count": 1,
		},
	})
	require.NoError(t, err)
	encoded, err := common.Marshal(value)
	require.NoError(t, err)
	var request map[string]any
	require.NoError(t, common.Unmarshal(encoded, &request))
	assert.Equal(t, "https://pay.kokoai.online/openapi/v1/videos", request["url"])
	headers, ok := request["headers"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "Bearer secret", headers["Authorization"])
	assert.Equal(t, "newapi_task-public-123", headers["Idempotency-Key"])

	statuses := map[string]string{
		"queued": "QUEUED", "running": "IN_PROGRESS", "completed": "SUCCESS", "failed": "FAILURE", "new": "UNKNOWN",
	}
	for upstream, expected := range statuses {
		result, callErr := plugin.Engine.Call(t.Context(), "parseTaskResult", map[string]any{}, map[string]any{"status": upstream, "failure_reason": "上游失败"})
		require.NoError(t, callErr)
		encoded, marshalErr := common.Marshal(result)
		require.NoError(t, marshalErr)
		var parsed map[string]any
		require.NoError(t, common.Unmarshal(encoded, &parsed))
		assert.Equal(t, expected, parsed["status"])
	}
}
