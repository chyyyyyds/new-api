const MODEL_RULES = {
  "seedance-2.0": {
    durations: [5, 15],
    defaultDuration: 15,
    resolution: "720p",
  },
  "seedance-2.5": {
    durations: [14, 30],
    defaultDuration: 14,
    resolution: "720p",
  },
  minimaxh3: {
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 15,
    resolution: "2K",
  },
};

const RATIOS = ["9:16", "1:1", "3:4", "4:3", "16:9"];
const MODES = ["text-to-video", "reference", "first-frame"];

export const meta = {
  apiVersion: 1,
  key: "koko",
  name: "KOKO Video",
  icon: "text:KK",
  description: {
    en: "KOKO Seedance and MiniMax video generation",
    zh: "KOKO Seedance 与 MiniMax 视频生成",
  },
  version: "1.0.0",
  author: { name: "KOKO" },
  website: "https://pay.kokoai.online/canvas/video",
  baseUrl: "https://pay.kokoai.online/openapi",
  models: Object.keys(MODEL_RULES),
  fetchMode: "per_task",
  usageSchema: {
    video_count: {
      type: "number",
      unit: "count",
      unitLabel: { en: "video", zh: "次", "zh-TW": "次" },
      description: { en: "Video generation unit price", zh: "视频生成单价", "zh-TW": "影片生成單價" },
    },
  },
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
};

function trimmed(value) {
  return String(value || "").trim();
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function modelRules(model) {
  const rules = MODEL_RULES[trimmed(model)];
  if (!rules) throw new Error("model is not supported");
  return rules;
}

function normalizeReferences(req) {
  const fields = ["reference_images", "image_urls", "images"].filter(function (name) {
    return own(req, name);
  });
  if (fields.length > 1) throw new Error("only one reference image field may be provided");
  if (!fields.length) return [];
  const values = req[fields[0]];
  if (!Array.isArray(values) || values.length > 9) throw new Error("reference images must be an array with at most 9 items");
  return values.map(function (item) {
    const url = typeof item === "string" ? item : item && typeof item === "object" ? item.url || item.image_url : "";
    if (!/^https:\/\//i.test(trimmed(url))) throw new Error("reference image URLs must use HTTPS");
    return { url: trimmed(url) };
  });
}

function normalizeVideoRequest(req, model) {
  if (!req || typeof req !== "object" || Array.isArray(req)) throw new Error("request body must be an object");
  const rules = modelRules(model);
  const prompt = trimmed(req.prompt);
  if (!prompt || prompt.length > 6000) throw new Error("prompt must contain between 1 and 6000 characters");

  const rawDuration = own(req, "duration") ? req.duration : req.seconds;
  const duration = rawDuration === undefined ? rules.defaultDuration : Number(rawDuration);
  if (!Number.isInteger(duration) || !rules.durations.includes(duration)) {
    throw new Error("duration is not supported by this model");
  }

  const ratio = trimmed(own(req, "ratio") ? req.ratio : req.aspect_ratio) || "16:9";
  if (!RATIOS.includes(ratio)) throw new Error("ratio is not supported");

  const resolution = trimmed(req.resolution) || rules.resolution;
  if (resolution.toLowerCase() !== rules.resolution.toLowerCase()) throw new Error("resolution is fixed for this model");

  const count = own(req, "count") ? Number(req.count) : 1;
  if (count !== 1) throw new Error("count must be 1");

  const references = normalizeReferences(req);
  const mode = trimmed(req.mode) || (references.length ? "reference" : "text-to-video");
  if (!MODES.includes(mode)) throw new Error("mode is not supported");

  const body = { model, prompt, duration, ratio, resolution: rules.resolution, mode, count: 1 };
  if (references.length) body.reference_images = references;
  return body;
}

function responsesInput(req) {
  const texts = [];
  const images = [];
  const input = req.input;
  if (typeof input === "string") texts.push(input);
  else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") {
        texts.push(item);
        continue;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const content = item.content === undefined ? [item] : Array.isArray(item.content) ? item.content : [item.content];
      for (const part of content) {
        if (typeof part === "string") {
          texts.push(part);
          continue;
        }
        if (!part || typeof part !== "object" || Array.isArray(part)) continue;
        if (["input_text", "text"].includes(part.type) && typeof part.text === "string") texts.push(part.text);
        if (["input_image", "image_url"].includes(part.type)) {
          const value = part.image_url && typeof part.image_url === "object" ? part.image_url.url : part.image_url;
          if (trimmed(value)) images.push(trimmed(value));
        }
      }
    }
  } else if (input !== undefined) {
    throw new Error("input must be a string or array");
  }
  return { prompt: texts.filter(trimmed).join("\n"), images };
}

function responsesVideoText(ctx) {
  const artifact = ctx && ctx.artifacts && ctx.artifacts.video;
  const url = trimmed(artifact && artifact.url);
  if (!url) throw new Error("video artifact is unavailable");
  const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return '<video controls src="' + escaped + '"></video>';
}

function idempotencyKey(ctx) {
  const headers = ctx.requestHeaders || {};
  const provided = trimmed(headers["idempotency-key"] || headers["Idempotency-Key"]);
  if (/^[A-Za-z0-9_-]{8,100}$/.test(provided)) return provided;
  const normalized = trimmed(ctx.publicTaskId).replace(/[^A-Za-z0-9_-]/g, "_");
  return ("newapi_" + normalized).slice(0, 100);
}

export function buildSubmitRequest(ctx) {
  const model = trimmed(ctx.upstreamModel || ctx.model);
  const body = normalizeVideoRequest(ctx.requestBody || {}, model);
  // 使用网关任务号生成幂等键，避免网络重试导致上游重复扣费。
  return {
    url: ctx.baseUrl.replace(/\/+$/, "") + "/v1/videos",
    method: "POST",
    headers: {
      Authorization: "Bearer " + ctx.apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey(ctx),
    },
    body,
  };
}

export function parseSubmitResponse(_ctx, resp) {
  const body = resp.body || {};
  if (body.error && body.error.message) throw new Error(body.error.message);
  const taskId = body.id || body.task_id;
  if (!taskId) throw new Error("task id is empty");
  return { taskId, taskData: body };
}

export function extractUsage() {
  // 每次生成固定计费一次，时长只用于上游参数校验。
  return { video_count: 1 };
}

export function extractUsageOnComplete() {
  return {};
}

export function buildQueryRequest(ctx) {
  return {
    url: ctx.baseUrl.replace(/\/+$/, "") + "/v1/videos/" + encodeURIComponent(ctx.taskId),
    method: "GET",
    headers: { Authorization: "Bearer " + ctx.apiKey },
  };
}

export function parseTaskResult(_ctx, body) {
  const statuses = { queued: "QUEUED", running: "IN_PROGRESS", completed: "SUCCESS", failed: "FAILURE" };
  const status = statuses[body && body.status];
  const result = { status: status || "UNKNOWN" };
  if (!status) result.reason = "unrecognized status: " + trimmed(body && body.status);
  if (result.status === "FAILURE") result.reason = trimmed(body && body.failure_reason) || "task failed";
  return result;
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" ? [{ key: "video", type: "video", mimeType: "video/mp4" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  return {
    url: ctx.baseUrl.replace(/\/+$/, "") + "/v1/videos/" + encodeURIComponent(ctx.upstreamTaskId) + "/content",
    method: ctx.clientRequest.method,
    headers: { Authorization: "Bearer " + ctx.apiKey },
  };
}

export const protocols = {
  openai_responses: {
    decodeRequest(ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const req = ctx.body.value;
      if (!req || typeof req !== "object" || Array.isArray(req)) throw new Error("request body must be an object");
      const model = trimmed(req.model || ctx.model);
      const upstreamModel = trimmed(ctx.upstreamModel || model);
      const input = responsesInput(req);
      const prompt = input.prompt || trimmed(req.prompt);
      if (!prompt) throw new Error("input is required");
      const body = Object.assign({}, req, { model: upstreamModel, prompt });
      delete body.input;
      if (input.images.length)
        body.reference_images = input.images.map(function (url) {
          return { url };
        });
      const requestBody = normalizeVideoRequest(body, upstreamModel);
      return { kind: "submit", model: ctx.model || model, action: requestBody.reference_images ? "image_to_video" : "text_to_video", requestBody };
    },
    renderEvents(ctx, task, previousState) {
      const status = trimmed(task.status).toUpperCase() || "UNKNOWN";
      const value = Number(String(task.progress || "").replace("%", ""));
      const progress = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const state = { status, progress };
      if (status === "SUCCESS") {
        const events = previousState && previousState.status === status ? [] : [{ type: "output", data: responsesVideoText(ctx) }];
        return { events, state, done: true };
      }
      if (status === "FAILURE") return { events: [{ type: "error", code: "task_failed", message: task.fail_reason || "task failed" }], state, done: true };
      if (previousState && previousState.status === status && previousState.progress === progress) return { events: [], state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state, done: false };
    },
    renderFinal(ctx) {
      return {
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: responsesVideoText(ctx), annotations: [], logprobs: [] }],
          },
        ],
        metadata: { vendor: "koko" },
      };
    },
  },
  openai_video: {
    decodeRequest(ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const upstreamModel = trimmed(ctx.upstreamModel || ctx.model);
      const requestBody = normalizeVideoRequest(ctx.body.value, upstreamModel);
      return { kind: "submit", model: ctx.model, action: requestBody.reference_images ? "image_to_video" : "text_to_video", requestBody };
    },
    render(_ctx, task) {
      if (task.data && typeof task.data === "object" && !Array.isArray(task.data)) return task.data;
      return {};
    },
  },
};
