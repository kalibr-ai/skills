const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Type } = require("@sinclair/typebox");

const DEFAULT_BASE_URL = process.env.REMOTE_ROCKETSHIP_BASE_URL?.trim() || "https://www.remoterocketship.com";
const STORE_VERSION = 2;
const MAX_JOB_ID_HISTORY = 400;
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir?.() || process.env.HOME || ".", ".openclaw");
const CRON_STORE_PATH = path.join(OPENCLAW_HOME, "cron", "jobs.json");
const CADENCE_MS = {
  hourly: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  sixhours: 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  twelvehours: 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000
};

const JobsSchema = Type.Object({
  filters: Type.Record(Type.String(), Type.Unknown(), { description: "RR filters object" }),
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  itemsPerPage: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  includeJobDescription: Type.Optional(Type.Boolean()),
  baseUrl: Type.Optional(Type.String()),
  apiKey: Type.Optional(Type.String())
});

const SaveSecretSchema = Type.Object({
  value: Type.String({ minLength: 1 }),
  label: Type.Optional(Type.String()),
  scopeHint: Type.Optional(Type.String())
});

const KeyActionSchema = Type.Object({
  sessionCookie: Type.Optional(Type.String()),
  baseUrl: Type.Optional(Type.String())
});

const ScheduleSchema = Type.Object({
  cadence: Type.String({ description: "hourly | 6h | 12h | daily | off" }),
  everyMs: Type.Optional(Type.Integer({ minimum: 60 * 1000 })),
  baseUrl: Type.Optional(Type.String())
});

const EmptySchema = Type.Object({});

const textResult = (payload) => ({
  content: [
    {
      type: "text",
      text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)
    }
  ],
  details: payload
});

const normalizeBaseUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_BASE_URL;
  }
  return value.trim().replace(/\/$/, "");
};

const clampPagination = (filters, pageInput, perPageInput) => {
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.floor(pageInput)) : 1;
  const itemsPerPage = Number.isFinite(perPageInput) ? Math.min(50, Math.max(1, Math.floor(perPageInput))) : 20;
  return {
    ...filters,
    page,
    itemsPerPage
  };
};

const deriveJobId = (job) => {
  if (!job || typeof job !== "object") {
    return null;
  }
  return job.id ?? job.jobId ?? job.slug ?? job.url ?? job.canonicalUrl ?? job.jobSlug ?? null;
};

const sanitizeScopeForJob = (scope) => scope.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").toLowerCase() || "default";

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const loadCronStore = async () => {
  try {
    const raw = await fs.readFile(CRON_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version || 1,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
    };
  } catch {
    return { version: 1, jobs: [] };
  }
};

const saveCronStore = async (store) => {
  await ensureDir(path.dirname(CRON_STORE_PATH));
  await fs.writeFile(CRON_STORE_PATH, JSON.stringify(store, null, 2));
};

const systemEventText = (jobId) => `RR_CHECK:${jobId}`;

const upsertCronJob = async ({ jobId, everyMs, scope, agentId }) => {
  const store = await loadCronStore();
  const jobs = store.jobs.filter((job) => job.jobId !== jobId);
  const job = {
    jobId,
    name: `RR monitor (${scope})`,
    description: `Remote Rocketship monitoring for ${scope}`,
    enabled: true,
    deleteAfterRun: false,
    schedule: { kind: "every", everyMs },
    sessionTarget: "main",
    wakeMode: "now",
    payload: {
      kind: "systemEvent",
      text: systemEventText(jobId)
    }
  };
  if (agentId) {
    job.agentId = agentId;
  }
  jobs.push(job);
  store.jobs = jobs;
  await saveCronStore(store);
  return job;
};

const removeCronJob = async (jobId) => {
  const store = await loadCronStore();
  const before = store.jobs.length;
  store.jobs = store.jobs.filter((job) => job.jobId !== jobId);
  if (store.jobs.length !== before) {
    await saveCronStore(store);
    return true;
  }
  return false;
};

const parseCadenceInput = (cadenceValue, explicitEveryMs) => {
  if (typeof cadenceValue === "string") {
    const trimmed = cadenceValue.trim();
    if (trimmed.length > 0) {
      const normalized = trimmed.toLowerCase();
      const compact = normalized.replace(/[^a-z0-9]/gi, "");
      if (compact === "off" || compact === "none" || compact === "stop") {
        return { disable: true };
      }
      if (CADENCE_MS[compact]) {
        return { everyMs: CADENCE_MS[compact], label: trimmed };
      }
      const match = compact.match(/^([0-9]+)(m|h|d)$/);
      if (match) {
        const value = Number(match[1]);
        const unit = match[2];
        let everyMs = Number.isFinite(value) ? value : NaN;
        if (Number.isFinite(everyMs)) {
          if (unit === "m") everyMs *= 60 * 1000;
          if (unit === "h") everyMs *= 60 * 60 * 1000;
          if (unit === "d") everyMs *= 24 * 60 * 60 * 1000;
          if (everyMs >= 60 * 1000) {
            return { everyMs, label: trimmed };
          }
        }
      }
    }
  }
  if (Number.isFinite(explicitEveryMs) && explicitEveryMs >= 60 * 1000) {
    return { everyMs: explicitEveryMs, label: `${explicitEveryMs}ms` };
  }
  if (!cadenceValue && explicitEveryMs === undefined) {
    return { disable: true };
  }
  throw new Error("Unsupported cadence. Try hourly, 6h, 12h, daily, off, or provide everyMs >= 60000.");
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Request failed (${response.status} ${response.statusText}): ${text}`);
  }
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function resolveScope(ctx) {
  if (ctx.sessionKey) {
    return `session:${ctx.sessionKey}`;
  }
  if (ctx.messageChannel && ctx.agentAccountId) {
    return `channel:${ctx.messageChannel}:${ctx.agentAccountId}`;
  }
  if (ctx.agentId) {
    return `agent:${ctx.agentId}`;
  }
  return "default";
}

module.exports = function register(api) {
  const pluginRoot = api.resolvePath?.(".") || process.cwd();
  const stateDir = path.join(pluginRoot, ".state");
  const storePath = path.join(stateDir, "secrets.json");
  let cache = null;

  const loadStore = async () => {
    if (cache) {
      return cache;
    }
    try {
      const raw = await fs.readFile(storePath, "utf8");
      const parsed = JSON.parse(raw);
      cache = {
        version: parsed.version === STORE_VERSION ? STORE_VERSION : STORE_VERSION,
        entries: parsed.entries ?? {}
      };
    } catch {
      cache = { version: STORE_VERSION, entries: {} };
    }
    return cache;
  };

  const persistStore = async (store) => {
    cache = store;
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(store, null, 2), { mode: 0o600 });
  };

  const getScopeEntry = async (scope) => {
    const store = await loadStore();
    const entry = store.entries[scope];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return entry;
    }
    if (entry === undefined) {
      return {};
    }
    return { legacy: entry };
  };

  const updateScopeEntry = async (scope, updater) => {
    const store = await loadStore();
    const current = (() => {
      const entry = store.entries[scope];
      return entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
    })();
    const next = updater({ ...current });
    store.entries[scope] = next;
    await persistStore(store);
    return next;
  };

  const setSecret = async (scope, key, value) => {
    await updateScopeEntry(scope, (entry) => ({
      ...entry,
      [key]: value
    }));
  };

  const getSecret = async (scope, key) => {
    const entry = await getScopeEntry(scope);
    return entry?.[key];
  };

  const clearSecret = async (scope, key) => {
    await updateScopeEntry(scope, (entry) => {
      const next = { ...entry };
      delete next[key];
      return next;
    });
  };

  const setLastSearch = async (scope, payload) => {
    await updateScopeEntry(scope, (entry) => ({
      ...entry,
      lastSearch: payload
    }));
  };

  const setMonitoringState = async (scope, monitoring) => {
    await updateScopeEntry(scope, (entry) => ({
      ...entry,
      monitoring
    }));
  };

  const buildMissingSecretResult = (code, message) => textResult({ error: code, message });

  const registerToolForContext = (factory, opts) => {
    api.registerTool((ctx) => factory(ctx), opts);
  };

  const createJobsTool = (ctx) => {
    const scope = resolveScope(ctx);
    return {
      name: "rr.jobs",
      label: "Remote Rocketship Jobs",
      description: "Fetch Remote Rocketship jobs with filters and pagination.",
      parameters: JobsSchema,
      async execute(_toolCallId, params = {}) {
        if (!params.filters || typeof params.filters !== "object") {
          return buildMissingSecretResult("INVALID_FILTERS", "filters object is required");
        }
        const filters = clampPagination({ ...params.filters }, params.page, params.itemsPerPage);
        const apiKey = (typeof params.apiKey === "string" && params.apiKey.trim()) || await getSecret(scope, "apiKey");
        if (!apiKey) {
          return buildMissingSecretResult("MISSING_API_KEY", "No RR API key stored. Ask the user to paste it so I can save it.");
        }
        const baseUrl = normalizeBaseUrl(params.baseUrl);
        try {
          const data = await fetchJson(`${baseUrl}/api/openclaw/jobs`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              filters,
              includeJobDescription: params.includeJobDescription === true
            })
          });

          const jobOpenings = Array.isArray(data.jobOpenings) ? data.jobOpenings : [];
          const jobIds = [];
          const currentIdSet = new Set();
          for (const job of jobOpenings) {
            const id = deriveJobId(job) || `${job.company?.slug || job.company?.name || "company"}:${job.slug || job.roleTitle || job.id || job.url || Math.random().toString(36).slice(2)}`;
            if (!currentIdSet.has(id)) {
              currentIdSet.add(id);
              jobIds.push(id);
            }
          }
          const previous = await getScopeEntry(scope);
          const previousIds = new Set(previous?.lastSearch?.jobIds || []);
          const newJobOpenings = jobOpenings.filter((job, index) => {
            const id = jobIds[index];
            return id && !previousIds.has(id);
          });

          await setLastSearch(scope, {
            filters: JSON.parse(JSON.stringify(filters)),
            itemsPerPage: filters.itemsPerPage,
            page: filters.page,
            lastRunAt: new Date().toISOString(),
            jobIds: jobIds.slice(0, MAX_JOB_ID_HISTORY),
            jobCount: jobOpenings.length
          });

          const enhancedResult = {
            ...data,
            usedFilters: filters,
            stats: {
              totalCount: typeof data.totalCount === "number" ? data.totalCount : jobOpenings.length,
              newCount: newJobOpenings.length
            },
            newJobOpenings
          };

          return textResult(enhancedResult);
        } catch (err) {
          return textResult({ error: "JOB_FETCH_FAILED", message: err instanceof Error ? err.message : String(err) });
        }
      }
    };
  };

  const createSaveApiKeyTool = (ctx) => {
    const scope = resolveScope(ctx);
    return {
      name: "rr.save_api_key",
      label: "Save RR API Key",
      description: "Securely store the Remote Rocketship API key for this conversation.",
      parameters: SaveSecretSchema,
      async execute(_toolCallId, params = {}) {
        const value = typeof params.value === "string" ? params.value.trim() : "";
        if (!value) {
          return buildMissingSecretResult("INVALID_API_KEY", "apiKey value required");
        }
        await setSecret(scope, "apiKey", value);
        return textResult({ saved: true, scope, message: params.label || "Saved the API key." });
      }
    };
  };

  const createSaveSessionCookieTool = (ctx) => {
    const scope = resolveScope(ctx);
    return {
      name: "rr.save_session_cookie",
      label: "Save RR Session Cookie",
      description: "Store the authenticated Remote Rocketship session cookie for key management.",
      parameters: SaveSecretSchema,
      async execute(_toolCallId, params = {}) {
        const value = typeof params.value === "string" ? params.value.trim() : "";
        if (!value) {
          return buildMissingSecretResult("INVALID_COOKIE", "session cookie is required");
        }
        await setSecret(scope, "sessionCookie", value);
        return textResult({ saved: true, scope, message: params.label || "Saved the session cookie." });
      }
    };
  };

  const createSecretClearingTool = (ctx, key, name, label) => {
    const scope = resolveScope(ctx);
    return {
      name,
      label,
      description: `Remove the stored ${label.toLowerCase()}.`,
      parameters: EmptySchema,
      async execute() {
        await clearSecret(scope, key);
        return textResult({ cleared: true, scope });
      }
    };
  };

  const createGetLastSearchTool = (ctx) => {
    const scope = resolveScope(ctx);
    return {
      name: "rr.get_last_search",
      label: "Get RR Search Context",
      description: "Return the filters/itemsPerPage from the last rr.jobs call.",
      parameters: EmptySchema,
      async execute() {
        const entry = await getScopeEntry(scope);
        if (!entry.lastSearch) {
          return buildMissingSecretResult("NO_SEARCH_HISTORY", "I haven't saved any RR search for this chat yet.");
        }
        return textResult(entry.lastSearch);
      }
    };
  };

  const createKeyActionTool = (ctx, action, name, label, description) => {
    const scope = resolveScope(ctx);
    return {
      name,
      label,
      description,
      parameters: KeyActionSchema,
      async execute(_toolCallId, params = {}) {
        const sessionCookie = (typeof params.sessionCookie === "string" && params.sessionCookie.trim()) || await getSecret(scope, "sessionCookie");
        if (!sessionCookie) {
          return buildMissingSecretResult("MISSING_SESSION_COOKIE", "No RR session cookie stored. Ask the user to log in and paste it.");
        }
        try {
          const data = await fetchJson(`${normalizeBaseUrl(params.baseUrl)}/api/openclaw/key`, {
            method: action === "GET" ? "GET" : "POST",
            headers: {
              "content-type": "application/json",
              Cookie: sessionCookie
            },
            body: action === "GET" ? undefined : JSON.stringify({ action })
          });
          if (action === "create" || action === "rotate") {
            const apiKey = data?.apiKey;
            if (typeof apiKey === "string" && apiKey.trim()) {
              await setSecret(scope, "apiKey", apiKey.trim());
            }
          }
          return textResult(data);
        } catch (err) {
          return textResult({ error: "KEY_ACTION_FAILED", message: err instanceof Error ? err.message : String(err) });
        }
      }
    };
  };

  const createScheduleTool = (ctx) => {
    const scope = resolveScope(ctx);
    const scopeKey = sanitizeScopeForJob(scope);
    const jobId = `rr-${scopeKey}`;
    return {
      name: "rr.schedule_checks",
      label: "Schedule RR Monitoring",
      description: "Enable or disable cron-based monitoring for the last RR search.",
      parameters: ScheduleSchema,
      async execute(_toolCallId, params = {}) {
        const entry = await getScopeEntry(scope);
        const cadenceInput = typeof params.cadence === "string" ? params.cadence.trim() : "";
        let parsed;
        try {
          parsed = parseCadenceInput(cadenceInput, params.everyMs);
        } catch (err) {
          return textResult({ error: "INVALID_CADENCE", message: err instanceof Error ? err.message : String(err) });
        }

        if (parsed.disable) {
          const removed = await removeCronJob(jobId);
          await setMonitoringState(scope, undefined);
          return textResult({ scheduled: false, jobId, removed, message: "Monitoring disabled." });
        }

        if (!entry.lastSearch) {
          return buildMissingSecretResult("NO_SEARCH_HISTORY", "Run rr.jobs once before scheduling monitoring so I know which filters to watch.");
        }

        try {
          await upsertCronJob({ jobId, everyMs: parsed.everyMs, scope, agentId: ctx.agentId });
          const monitoring = {
            cadence: parsed.label || params.cadence,
            everyMs: parsed.everyMs,
            jobId,
            systemEvent: systemEventText(jobId),
            scope
          };
          await setMonitoringState(scope, monitoring);
          return textResult({ scheduled: true, ...monitoring });
        } catch (err) {
          return textResult({ error: "CRON_WRITE_FAILED", message: err instanceof Error ? err.message : String(err) });
        }
      }
    };
  };

  registerToolForContext((ctx) => createJobsTool(ctx), { optional: false });
  registerToolForContext((ctx) => createSaveApiKeyTool(ctx), { optional: false });
  registerToolForContext((ctx) => createSaveSessionCookieTool(ctx), { optional: true });
  registerToolForContext((ctx) => createSecretClearingTool(ctx, "apiKey", "rr.clear_api_key", "Clear API Key"), { optional: true });
  registerToolForContext((ctx) => createSecretClearingTool(ctx, "sessionCookie", "rr.clear_session_cookie", "Clear Session Cookie"), { optional: true });
  registerToolForContext((ctx) => createGetLastSearchTool(ctx), { optional: true });
  registerToolForContext((ctx) => createKeyActionTool(ctx, "GET", "rr.key_status", "RR Key Status", "Fetch usage counters and metadata for the current RR API key."), { optional: true });
  registerToolForContext((ctx) => createKeyActionTool(ctx, "create", "rr.generate_key", "RR Generate Key", "Create a new RR API key."), { optional: true });
  registerToolForContext((ctx) => createKeyActionTool(ctx, "rotate", "rr.rotate_key", "RR Rotate Key", "Rotate (revoke + create) the RR API key."), { optional: true });
  registerToolForContext((ctx) => createKeyActionTool(ctx, "revoke", "rr.revoke_key", "RR Revoke Key", "Revoke the RR API key without creating a new one."), { optional: true });
  registerToolForContext((ctx) => createScheduleTool(ctx), { optional: true });
};
