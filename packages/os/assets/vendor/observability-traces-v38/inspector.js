(() => {
  // scripts/lib/trace-site-inspector/model.ts
  var GENERIC_FAILURE = /^(?:error|failed|command failed|command failed with exit code \d+|process exited with code \d+)\.?$/i;
  var FAILURE_STATUS = /^(?:error|failed|failure|timeout|timed_out)$/i;
  function stableTraceKey(row) {
    if (!row)
      return "";
    const metadata = asRecord(row.metadata);
    return clean(row.__traceSelectionKey ?? row.recordId ?? row.id ?? metadata?.trace_id ?? row.traceId ?? row.trace ?? metadata?.id ?? metadata?.rowid);
  }
  function traceParentKey(row) {
    return clean(row?.__traceParentKey) || stableTraceKey(row);
  }
  function isBatchChild(row) {
    return Boolean(clean(row?.__traceParentKey));
  }
  function branchName(row) {
    return clean(row?.branch ?? row?.taskSession) || "no-branch";
  }
  function isFailure(row) {
    if (!row)
      return false;
    if (row.ok === false)
      return true;
    if (FAILURE_STATUS.test(clean(row.status)))
      return true;
    const code = clean(row.code);
    return Boolean(code && code !== "OK" && code !== "SUCCESS");
  }
  function dedupeTraceRows(rows) {
    const result = [];
    const seen = new Set;
    let anonymous = 0;
    for (const row of rows) {
      const key = stableTraceKey(row) || `anonymous-${anonymous++}`;
      if (seen.has(key))
        continue;
      seen.add(key);
      result.push(row);
    }
    return result;
  }
  function branchSummary(rows, selected) {
    const branch = branchName(selected);
    const peers = dedupeTraceRows(rows).filter((row) => branchName(row) === branch).sort((a, b) => timestamp(b) - timestamp(a));
    return {
      branch,
      calls: peers.length,
      failures: peers.filter(isFailure).length,
      durationMs: peers.reduce((sum, row) => sum + number(row.durationMs), 0),
      inputTokens: peers.reduce((sum, row) => sum + number(row.inputTokens), 0),
      outputTokens: peers.reduce((sum, row) => sum + number(row.outputTokens), 0),
      totalTokens: peers.reduce((sum, row) => sum + totalTokens(row), 0),
      peers
    };
  }
  function extractTraceError(row) {
    const baseCode = clean(row.code) || "UNKNOWN_ERROR";
    const baseExit = optionalNumber(row.exitCode);
    const candidates = [];
    addCandidate(candidates, row.rawStderr, {
      score: 150,
      path: "stderr",
      code: baseCode,
      exitCode: baseExit,
      tool: clean(row.name ?? row.traceName) || null
    });
    for (const [key, value, score] of [
      ["batchResultsJson", row.batchResultsJson, 120],
      ["outputObj", row.outputObj, 100],
      ["rawResultJson", row.rawResultJson, 95],
      ["stderrObj", row.stderrObj, 90],
      ["output", row.output, 55]
    ]) {
      walkErrorCandidates(parseMaybeJson(value), candidates, {
        score,
        path: key,
        code: baseCode,
        exitCode: baseExit,
        tool: clean(row.name ?? row.traceName) || null,
        depth: 0
      });
    }
    const best = candidates.filter((candidate) => candidate.value.length > 0).sort((a, b) => b.score - a.score || b.value.length - a.value.length)[0];
    const detail = best?.value || fallbackErrorDetail(row);
    const code = best?.code || baseCode;
    const exitCode = best?.exitCode ?? baseExit;
    const failedTool = best?.tool || clean(row.name ?? row.traceName) || null;
    const headline = [
      failedTool,
      code,
      exitCode === null ? "" : `exit ${exitCode}`
    ].filter(Boolean).join(" · ");
    return {
      code,
      exitCode,
      failedTool,
      headline: headline || "Trace failure",
      detail
    };
  }
  function parseMaybeJson(value) {
    let current = value;
    for (let index = 0;index < 3; index += 1) {
      if (typeof current !== "string")
        break;
      const text = current.trim();
      if (!text || !text.startsWith("{") && !text.startsWith("[") && !text.startsWith('"'))
        break;
      try {
        current = JSON.parse(text);
      } catch {
        break;
      }
    }
    return current;
  }
  var childTraceCache = new WeakMap;
  function childTraceRecords(parent) {
    const sourceValue = parent.batchResultsJson;
    const stepsSourceValue = parent.rawResolvedInputJson ?? parent.rawInputJson ?? parent.inputObj ?? parent.input;
    const cached = childTraceCache.get(parent);
    if (cached && cached.source === sourceValue && cached.stepsSource === stepsSourceValue) {
      return cached.children;
    }
    const parsed = parseMaybeJson(sourceValue);
    const parsedRecord = asRecord(parsed);
    const source = Array.isArray(parsed) ? parsed : parsedRecord?.children ?? parsedRecord?.results;
    const parsedSteps = parseMaybeJson(stepsSourceValue);
    const parsedStepsRecord = asRecord(parsedSteps);
    const steps = Array.isArray(parsedSteps) ? parsedSteps : Array.isArray(parsedStepsRecord?.steps) ? parsedStepsRecord.steps : [];
    if (!Array.isArray(source)) {
      childTraceCache.set(parent, {
        source: sourceValue,
        stepsSource: stepsSourceValue,
        children: []
      });
      return [];
    }
    const parentKey = stableTraceKey(parent);
    const result = [];
    const walk = (value, depth, parentPath, siblingIndex) => {
      const record = asRecord(value);
      if (!record)
        return;
      const stepRecord = depth === 1 ? asRecord(steps[siblingIndex]) : null;
      const mergedRecord = stepRecord ? { ...stepRecord, ...record } : record;
      const data = asRecord(mergedRecord.data);
      const label = clean(mergedRecord.tool ?? mergedRecord.name ?? mergedRecord.facadeTool ?? mergedRecord.label) || "child";
      const segment = `${siblingIndex}:${label}`;
      const path = parentPath ? `${parentPath}/${segment}` : segment;
      const nativeKey = stableTraceKey(record);
      const selectionKey = nativeKey || `${parentKey}::child:${path}`;
      const status = clean(mergedRecord.status) || (mergedRecord.ok === false ? "error" : mergedRecord.ok === true ? "success" : "");
      const child = {
        ...mergedRecord,
        name: mergedRecord.name ?? mergedRecord.tool ?? mergedRecord.facadeTool ?? mergedRecord.label,
        traceName: mergedRecord.traceName ?? mergedRecord.name ?? mergedRecord.tool ?? mergedRecord.facadeTool,
        traceId: mergedRecord.traceId ?? mergedRecord.trace_id,
        branch: mergedRecord.branch ?? parent.branch,
        taskSession: mergedRecord.taskSession ?? parent.taskSession,
        worktree: mergedRecord.worktree ?? parent.worktree,
        startTime: mergedRecord.startTime ?? parent.startTime,
        displayTime: mergedRecord.displayTime ?? parent.displayTime,
        status,
        durationMs: mergedRecord.durationMs ?? mergedRecord.duration_ms ?? data?.durationMs ?? data?.duration_ms,
        inputTokens: mergedRecord.inputTokens ?? mergedRecord.input_tokens ?? data?.inputTokens ?? data?.input_tokens,
        outputTokens: mergedRecord.outputTokens ?? mergedRecord.output_tokens ?? data?.outputTokens ?? data?.output_tokens,
        tokens: mergedRecord.tokens ?? mergedRecord.totalTokens ?? mergedRecord.total_tokens ?? data?.totalTokens,
        input: record.input ?? record.rawInputJson ?? record.inputObj ?? stepRecord?.input ?? data?.input,
        rawInputJson: record.rawInputJson ?? record.inputObj ?? stepRecord?.input ?? mergedRecord.rawInputJson,
        output: mergedRecord.output ?? mergedRecord.message ?? data?.output ?? data?.stdout ?? data?.message,
        rawResultJson: mergedRecord.rawResultJson ?? record,
        __traceSelectionKey: selectionKey,
        __traceParentKey: parentKey,
        __traceDepth: depth,
        __tracePath: path
      };
      result.push(child);
      const nestedParsed = parseMaybeJson(record.children ?? record.results ?? data?.children ?? data?.results);
      if (Array.isArray(nestedParsed)) {
        nestedParsed.forEach((nested, index) => walk(nested, depth + 1, path, index));
      }
    };
    source.forEach((child, index) => walk(child, 1, "", index));
    childTraceCache.set(parent, {
      source: sourceValue,
      stepsSource: stepsSourceValue,
      children: result
    });
    return result;
  }
  function totalTokens(row) {
    const explicit = optionalNumber(row.tokens ?? row.totalTokens);
    if (explicit !== null)
      return explicit;
    return number(row.inputTokens) + number(row.outputTokens);
  }
  function number(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function optionalNumber(value) {
    if (value === null || value === undefined || value === "")
      return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function clean(value) {
    return String(value ?? "").trim();
  }
  function addCandidate(candidates, value, context) {
    if (value === null || value === undefined)
      return;
    const text = typeof value === "string" ? value.trim() : stringify(value);
    if (!text)
      return;
    const bounded = text.slice(0, 20000);
    const genericPenalty = GENERIC_FAILURE.test(bounded) ? 100 : 0;
    const specificity = /no such|not found|timed out|timeout|denied|invalid|missing|required|unsafe|blocked|cannot|failed to|exception|syntax|permission/i.test(bounded) ? 24 : 0;
    candidates.push({
      value: bounded,
      score: context.score + specificity - genericPenalty,
      path: context.path,
      code: context.code,
      exitCode: context.exitCode,
      tool: context.tool
    });
  }
  function walkErrorCandidates(value, candidates, context) {
    const parsed = parseMaybeJson(value);
    const depth = context.depth ?? 0;
    if (depth > 7 || parsed === null || parsed === undefined)
      return;
    if (typeof parsed === "string") {
      addCandidate(candidates, parsed, context);
      return;
    }
    if (Array.isArray(parsed)) {
      parsed.forEach((item, index) => walkErrorCandidates(item, candidates, {
        ...context,
        path: `${context.path}[${index}]`,
        depth: depth + 1
      }));
      return;
    }
    const record = asRecord(parsed);
    if (!record)
      return;
    const localCode = clean(record.code) || context.code;
    const localExit = optionalNumber(record.exitCode ?? record.exit_code) ?? context.exitCode;
    const localTool = clean(record.tool ?? record.name ?? record.facadeTool) || context.tool;
    const failed = record.ok === false || FAILURE_STATUS.test(clean(record.status)) || localCode && localCode !== "OK" && localCode !== "SUCCESS";
    const weightedKeys = {
      stderr: 145,
      error: 135,
      errorCause: 130,
      cause: 128,
      reason: 126,
      message: 122,
      detail: 115,
      diagnostics: 108,
      stdout: 52,
      output: 45
    };
    for (const [key, item] of Object.entries(record)) {
      const extra = weightedKeys[key] ?? 0;
      const nextContext = {
        score: context.score + extra + (failed ? 18 : 0),
        path: `${context.path}.${key}`,
        code: localCode,
        exitCode: localExit,
        tool: localTool,
        depth: depth + 1
      };
      if (extra > 0 && (typeof item === "string" || typeof item === "number")) {
        addCandidate(candidates, item, nextContext);
      }
      if (typeof item === "object" || typeof item === "string" && /^[\s]*[\[{]/.test(item)) {
        walkErrorCandidates(item, candidates, nextContext);
      }
    }
  }
  function fallbackErrorDetail(row) {
    const output = clean(row.output ?? row.summary);
    if (output && !GENERIC_FAILURE.test(output))
      return output;
    const code = clean(row.code) || "UNKNOWN_ERROR";
    const exit = optionalNumber(row.exitCode);
    return exit === null ? code : `${code} (exit ${exit})`;
  }
  function timestamp(row) {
    const value = clean(row.startTime ?? row.time ?? row.ts);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  }
  function stringify(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value ?? "");
    }
  }

  // scripts/lib/trace-site-inspector/inspector-state.ts
  var DEFAULT_WIDTH = 680;
  var MIN_WIDTH = 420;
  var MAX_WIDTH = 1e4;
  function createInspectorState(input = {}) {
    return {
      selectedKey: "",
      selectedRow: null,
      layout: "split",
      width: DEFAULT_WIDTH,
      displayMode: "formatted",
      callQuery: "",
      callRailCollapsed: false,
      ...input
    };
  }
  function reduceInspectorState(state, event) {
    switch (event.type) {
      case "hydrate-selection":
        return event.key === state.selectedKey ? state : { ...state, selectedKey: event.key };
      case "select":
        return {
          ...state,
          selectedKey: event.key,
          selectedRow: event.row,
          displayMode: state.displayMode === "workpad" && !isWorkpadTrace(event.row) ? "formatted" : state.displayMode,
          layout: state.layout === "fullscreen" ? "fullscreen" : "split"
        };
      case "clear-selection":
        return {
          ...state,
          selectedKey: "",
          selectedRow: null,
          layout: "collapsed"
        };
      case "rows-added": {
        if (!state.selectedKey)
          return state;
        const refreshed = findSelectedRow(event.rows, state.selectedKey);
        return refreshed ? { ...state, selectedRow: refreshed } : { ...state };
      }
      case "rows-replaced": {
        if (!state.selectedKey)
          return state;
        const refreshed = findSelectedRow(event.rows, state.selectedKey);
        return refreshed ? { ...state, selectedRow: refreshed } : state;
      }
      case "close":
        return { ...state, layout: "collapsed" };
      case "toggle-collapse":
        return {
          ...state,
          layout: state.layout === "collapsed" ? "split" : "collapsed"
        };
      case "toggle-call-rail":
        return { ...state, callRailCollapsed: !state.callRailCollapsed };
      case "toggle-fullscreen":
        return {
          ...state,
          layout: state.layout === "fullscreen" ? "split" : "fullscreen"
        };
      case "resize":
        return {
          ...state,
          width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(event.width))),
          layout: state.layout === "collapsed" ? "split" : state.layout
        };
      case "set-display-mode":
        return { ...state, displayMode: event.mode };
      case "set-call-query":
        return { ...state, callQuery: event.query.trim().toLowerCase() };
    }
  }
  function inspectorSections(row) {
    const input = parseMaybeJson(row.rawResolvedInputJson) ?? row.resolvedInputObj ?? parseMaybeJson(row.rawInputJson) ?? row.inputObj ?? row.input;
    const output = row.outputObj ?? parseMaybeJson(row.rawResultJson) ?? parseMaybeJson(row.output) ?? row.summary;
    const error = parseMaybeJson(row.rawStderr) ?? row.error ?? (isFailure(row) ? {
      code: clean(row.code) || "ERROR",
      message: clean(row.output ?? row.summary) || "Trace failed.",
      exitCode: row.exitCode ?? null
    } : null);
    const metadata = {
      traceId: row.traceId ?? row.trace ?? null,
      recordId: row.recordId ?? row.id ?? null,
      branch: row.branch ?? null,
      taskSession: row.taskSession ?? null,
      worktree: row.worktree ?? null,
      startTime: row.startTime ?? row.time ?? row.ts ?? null,
      status: row.status ?? null,
      code: row.code ?? null,
      exitCode: row.exitCode ?? null,
      durationMs: row.durationMs ?? null,
      inputTokens: row.inputTokens ?? null,
      outputTokens: row.outputTokens ?? null,
      totalTokens: totalTokens(row),
      cost: row.cost ?? null,
      metadata: row.metadata ?? null
    };
    return [
      { id: "input", title: "Input", tone: "neutral", value: input },
      {
        id: "output",
        title: "Output",
        tone: isFailure(row) ? "neutral" : "success",
        value: output
      },
      {
        id: "error",
        title: "Error",
        tone: isFailure(row) ? "error" : "neutral",
        value: error
      },
      { id: "metadata", title: "Metadata", tone: "neutral", value: metadata }
    ];
  }
  function isWorkpadTrace(row) {
    if (!row)
      return false;
    return [
      row.input,
      row.summary,
      row.rawInputJson,
      row.rawResolvedInputJson,
      row.resolvedInputObj,
      row.inputObj
    ].some((value) => /\bworkpad\.md\b/i.test(serializedText(value)));
  }
  function workpadTraceValue(row) {
    const result = asRecord2(parseMaybeJson(row.rawResultJson)) ?? asRecord2(parseMaybeJson(row.outputObj)) ?? asRecord2(row.outputObj);
    const data = asRecord2(result?.data);
    const nested = asRecord2(data?.data);
    const candidates = [
      nested?.stdout,
      nested?.output,
      data?.stdout,
      data?.output,
      result?.stdout,
      result?.output,
      row.output,
      row.summary
    ];
    for (const candidate of candidates) {
      const value = clean(candidate);
      if (value)
        return value;
    }
    return "No workpad content was recorded for this call.";
  }
  function inspectorContentSignature(row, mode) {
    return `${mode}:${serializedText(row)}`;
  }
  function normalizeBranchBreadcrumb(value) {
    const normalized = clean(value).replace(/^task\//, "");
    if (!normalized || normalized === "no-branch")
      return { stream: "no branch", task: "", label: "no branch" };
    const [stream = normalized, ...rest] = normalized.split("/").filter(Boolean);
    const task = rest.join("/");
    return {
      stream,
      task,
      label: task ? stream + " / " + task : stream
    };
  }
  function filterInspectorCalls(rows, query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized)
      return rows;
    return rows.filter((row) => [
      row.name,
      row.traceName,
      row.tool,
      row.input,
      row.output,
      row.summary,
      row.status,
      row.code,
      row.displayTime,
      row.time,
      row.startTime
    ].map(clean).join(" ").toLowerCase().includes(normalized));
  }
  function findSelectedRow(rows, selectedKey) {
    return rows.find((row) => stableTraceKey(row) === selectedKey || clean(row.traceId ?? row.trace) === selectedKey) ?? null;
  }
  function serializedText(value) {
    if (typeof value === "string")
      return value;
    try {
      return JSON.stringify(value ?? "");
    } catch {
      return String(value ?? "");
    }
  }
  function asRecord2(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  }

  class InspectorStore {
    state = createInspectorState();
    listeners = new Set;
    getSnapshot() {
      return this.state;
    }
    dispatch(event) {
      const next = reduceInspectorState(this.state, event);
      if (next === this.state)
        return this.state;
      this.state = next;
      for (const listener of this.listeners)
        listener(this.state);
      return this.state;
    }
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
  }
  var inspectorStore = new InspectorStore;

  // scripts/lib/trace-site-inspector/pagination-browser.ts
  function deriveTraceHistoryCursor(rows, explicitCursor) {
    if (explicitCursor !== undefined) {
      return typeof explicitCursor === "string" && explicitCursor ? explicitCursor : null;
    }
    const ordered = Array.from(rows);
    const key = stableTraceKey(ordered.at(-1));
    return key ? `id:${key}` : null;
  }
  function traceHistoryUrl(cursor, limit = 100) {
    return traceCursorUrl("older", cursor, limit);
  }
  function traceLiveUrl(cursor, limit = 100) {
    return traceCursorUrl("newer", cursor, limit);
  }
  function traceCursorUrl(direction, cursor, limit) {
    const params = new URLSearchParams({
      direction,
      cursor,
      limit: String(Math.max(1, Math.floor(limit))),
      site: "trace-burn-intelligence",
      sourceMode: "local-networked",
      includeRawPayload: "true"
    });
    return `/gateway/traces/recent?${params.toString()}`;
  }
  function parseTraceHistoryResponse(value) {
    return parseTraceCursorResponse(value, "older");
  }
  function parseTraceLiveResponse(value) {
    return parseTraceCursorResponse(value, "newer");
  }
  function parseTraceCursorResponse(value, direction) {
    const envelope = asRecord3(value);
    if (!envelope || envelope.ok !== true) {
      const error = asRecord3(envelope?.error);
      throw new Error(clean2(error?.message) || "Trace history request failed.");
    }
    const data = asRecord3(envelope.data);
    if (!data || data.direction !== direction) {
      throw new Error(`Trace response is missing the ${direction} direction.`);
    }
    if (!Array.isArray(data.rows)) {
      throw new Error("Trace history response rows must be an array.");
    }
    const rows = data.rows.map(asRecord3).filter(Boolean);
    if (rows.length !== data.rows.length) {
      throw new Error("Trace history response rows must contain objects.");
    }
    const nextCursor = data.nextCursor;
    if (nextCursor !== null && typeof nextCursor !== "string") {
      throw new Error("Trace history response nextCursor must be a string or null.");
    }
    return { rows, nextCursor };
  }
  function deriveTraceLiveCursor(rows) {
    const newest = Array.from(rows).at(0);
    const metadata = asRecord3(newest?.metadata);
    const rowid = clean2(metadata?.rowid);
    if (rowid && /^\d+$/.test(rowid))
      return rowid.padStart(12, "0");
    const key = stableTraceKey(newest);
    return key ? `id:${key}` : "000000000000";
  }
  function installTracePaginationTransport() {
    const inFlight = new Set;
    const handlePrefetch = (event) => {
      if (!(event instanceof CustomEvent))
        return;
      const detail = prefetchDetail(event.detail);
      if (!detail)
        return;
      event.preventDefault();
      if (inFlight.has(detail.cursor))
        return;
      inFlight.add(detail.cursor);
      fetchTraceHistoryPage(detail.cursor).then((page) => detail.accept(page.rows, page.nextCursor)).catch(() => detail.fail()).finally(() => inFlight.delete(detail.cursor));
    };
    document.addEventListener("trace:prefetch-request", handlePrefetch);
    return () => document.removeEventListener("trace:prefetch-request", handlePrefetch);
  }
  async function fetchTraceHistoryPage(cursor) {
    try {
      const transport = window.__consueloTraceHistoryTransport;
      if (!transport) {
        throw new Error("Trusted trace history transport is unavailable.");
      }
      const payload = await transport.fetchJson(traceHistoryUrl(cursor));
      return parseTraceHistoryResponse(payload);
    } catch (error) {
      throw error instanceof Error ? error : new Error("Trace history request failed.");
    }
  }
  function prefetchDetail(value) {
    const record = asRecord3(value);
    if (!record || typeof record.cursor !== "string" || !record.cursor || typeof record.accept !== "function" || typeof record.fail !== "function")
      return null;
    return record;
  }
  function asRecord3(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  }
  function clean2(value) {
    return String(value ?? "").trim();
  }

  // ../../../../../../../../../../Users/kokayi/Dev/opensaas/packages/os/node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js
  function createLazyMeasurementsView(count, flat, getItemKey) {
    const cache = new Array(count);
    return new Proxy(cache, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          const c = prop.charCodeAt(0);
          if (c >= 48 && c <= 57) {
            const i = +prop;
            if (Number.isInteger(i) && i >= 0 && i < count) {
              let v = target[i];
              if (!v) {
                const s = flat[i * 2];
                v = target[i] = {
                  index: i,
                  key: getItemKey(i),
                  start: s,
                  size: flat[i * 2 + 1],
                  end: s + flat[i * 2 + 1],
                  lane: 0
                };
              }
              return v;
            }
          }
          if (prop === "length")
            return count;
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }

  // ../../../../../../../../../../Users/kokayi/Dev/opensaas/packages/os/node_modules/@tanstack/virtual-core/dist/esm/utils.js
  function memo(getDeps, fn, opts) {
    let deps = opts.initialDeps ?? [];
    let result;
    let isInitial = true;
    function memoizedFunction() {
      var _a;
      const debugEnabled = !!opts.key && !!((_a = opts.debug) == null ? undefined : _a.call(opts));
      let depTime = 0;
      if (debugEnabled)
        depTime = Date.now();
      const newDeps = getDeps();
      const depsChanged = newDeps.length !== deps.length || newDeps.some((dep, index) => deps[index] !== dep);
      if (!depsChanged) {
        return result;
      }
      deps = newDeps;
      let resultTime = 0;
      if (debugEnabled)
        resultTime = Date.now();
      result = fn(...newDeps);
      if (debugEnabled) {
        const depEndTime = Math.round((Date.now() - depTime) * 100) / 100;
        const resultEndTime = Math.round((Date.now() - resultTime) * 100) / 100;
        const resultFpsPercentage = resultEndTime / 16;
        const pad = (str, num) => {
          str = String(str);
          while (str.length < num) {
            str = " " + str;
          }
          return str;
        };
        console.info(`%c⏱ ${pad(resultEndTime, 5)} /${pad(depEndTime, 5)} ms`, `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(0, Math.min(120 - 120 * resultFpsPercentage, 120))}deg 100% 31%);`, opts == null ? undefined : opts.key);
      }
      if ((opts == null ? undefined : opts.onChange) && !(isInitial && opts.skipInitialOnChange)) {
        opts.onChange(result);
      }
      isInitial = false;
      return result;
    }
    memoizedFunction.updateDeps = (newDeps) => {
      deps = newDeps;
    };
    return memoizedFunction;
  }
  function notUndefined(value, msg) {
    if (value === undefined) {
      throw new Error(`Unexpected undefined${msg ? `: ${msg}` : ""}`);
    } else {
      return value;
    }
  }
  var approxEqual = (a, b) => Math.abs(a - b) < 1.01;
  var debounce = (targetWindow, fn, ms) => {
    let timeoutId;
    return function(...args) {
      targetWindow.clearTimeout(timeoutId);
      timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms);
    };
  };

  // ../../../../../../../../../../Users/kokayi/Dev/opensaas/packages/os/node_modules/@tanstack/virtual-core/dist/esm/index.js
  var _isIOSResult;
  var isIOSWebKit = () => {
    if (_isIOSResult !== undefined)
      return _isIOSResult;
    if (typeof navigator === "undefined")
      return _isIOSResult = false;
    if (/iP(hone|od|ad)/.test(navigator.userAgent))
      return _isIOSResult = true;
    const mtp = navigator.maxTouchPoints;
    return _isIOSResult = navigator.platform === "MacIntel" && mtp !== undefined && mtp > 0;
  };
  var getRect = (element) => {
    const { offsetWidth, offsetHeight } = element;
    return { width: offsetWidth, height: offsetHeight };
  };
  var defaultKeyExtractor = (index) => index;
  var defaultRangeExtractor = (range) => {
    const start = Math.max(range.startIndex - range.overscan, 0);
    const end = Math.min(range.endIndex + range.overscan, range.count - 1);
    const len = end - start + 1;
    const arr = new Array(len);
    for (let i = 0;i < len; i++) {
      arr[i] = start + i;
    }
    return arr;
  };
  var observeElementRect = (instance, cb) => {
    const element = instance.scrollElement;
    if (!element) {
      return;
    }
    const targetWindow = instance.targetWindow;
    if (!targetWindow) {
      return;
    }
    const handler = (rect) => {
      const { width, height } = rect;
      cb({ width: Math.round(width), height: Math.round(height) });
    };
    handler(getRect(element));
    if (!targetWindow.ResizeObserver) {
      return () => {};
    }
    const observer = new targetWindow.ResizeObserver((entries) => {
      const run = () => {
        const entry = entries[0];
        if (entry == null ? undefined : entry.borderBoxSize) {
          const box = entry.borderBoxSize[0];
          if (box) {
            handler({ width: box.inlineSize, height: box.blockSize });
            return;
          }
        }
        handler(getRect(element));
      };
      instance.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
    });
    observer.observe(element, { box: "border-box" });
    return () => {
      observer.unobserve(element);
    };
  };
  var addEventListenerOptions = {
    passive: true
  };
  var supportsScrollend = typeof window == "undefined" ? true : ("onscrollend" in window);
  var observeOffset = (instance, cb, readOffset) => {
    const element = instance.scrollElement;
    if (!element) {
      return;
    }
    const targetWindow = instance.targetWindow;
    if (!targetWindow) {
      return;
    }
    const registerScrollendEvent = instance.options.useScrollendEvent && supportsScrollend;
    let offset = 0;
    const fallback = registerScrollendEvent ? null : debounce(targetWindow, () => cb(offset, false), instance.options.isScrollingResetDelay);
    const createHandler = (isScrolling) => () => {
      offset = readOffset(element);
      fallback == null || fallback();
      cb(offset, isScrolling);
    };
    const handler = createHandler(true);
    const endHandler = createHandler(false);
    element.addEventListener("scroll", handler, addEventListenerOptions);
    if (registerScrollendEvent) {
      element.addEventListener("scrollend", endHandler, addEventListenerOptions);
    }
    return () => {
      element.removeEventListener("scroll", handler);
      if (registerScrollendEvent) {
        element.removeEventListener("scrollend", endHandler);
      }
    };
  };
  var observeElementOffset = (instance, cb) => observeOffset(instance, cb, (el) => {
    const { horizontal, isRtl } = instance.options;
    return horizontal ? el.scrollLeft * (isRtl && -1 || 1) : el.scrollTop;
  });
  var measureElement = (element, entry, instance) => {
    if (instance.options.useCachedMeasurements) {
      const index = instance.indexFromElement(element);
      const key = instance.options.getItemKey(index);
      return instance.itemSizeCache.get(key) ?? instance.options.estimateSize(index);
    }
    if (entry == null ? undefined : entry.borderBoxSize) {
      const box = entry.borderBoxSize[0];
      if (box) {
        const size = Math.round(box[instance.options.horizontal ? "inlineSize" : "blockSize"]);
        return size;
      }
    }
    if (!entry) {
      const index = instance.indexFromElement(element);
      const key = instance.options.getItemKey(index);
      const cachedSize = instance.itemSizeCache.get(key);
      if (cachedSize !== undefined) {
        return cachedSize;
      }
    }
    return element[instance.options.horizontal ? "offsetWidth" : "offsetHeight"];
  };
  var scrollWithAdjustments = (offset, {
    adjustments = 0,
    behavior
  }, instance) => {
    var _a, _b;
    (_b = (_a = instance.scrollElement) == null ? undefined : _a.scrollTo) == null || _b.call(_a, {
      [instance.options.horizontal ? "left" : "top"]: offset + adjustments,
      behavior
    });
  };
  var elementScroll = scrollWithAdjustments;

  class Virtualizer {
    constructor(opts) {
      this.unsubs = [];
      this.scrollElement = null;
      this.targetWindow = null;
      this.isScrolling = false;
      this.scrollState = null;
      this.measurementsCache = [];
      this._flatMeasurements = null;
      this.itemSizeCache = /* @__PURE__ */ new Map;
      this.itemSizeCacheVersion = 0;
      this.laneAssignments = /* @__PURE__ */ new Map;
      this.pendingMin = null;
      this.prevLanes = undefined;
      this.lanesChangedFlag = false;
      this.lanesSettling = false;
      this.pendingScrollAnchor = null;
      this.scrollRect = null;
      this.scrollOffset = null;
      this.scrollDirection = null;
      this.scrollAdjustments = 0;
      this._iosDeferredAdjustment = 0;
      this._iosTouching = false;
      this._iosJustTouchEnded = false;
      this._iosTouchEndTimerId = null;
      this._intendedScrollOffset = null;
      this.elementsCache = /* @__PURE__ */ new Map;
      this.now = () => {
        var _a, _b, _c;
        return ((_c = (_b = (_a = this.targetWindow) == null ? undefined : _a.performance) == null ? undefined : _b.now) == null ? undefined : _c.call(_b)) ?? Date.now();
      };
      this.observer = /* @__PURE__ */ (() => {
        let _ro = null;
        const get = () => {
          if (_ro) {
            return _ro;
          }
          if (!this.targetWindow || !this.targetWindow.ResizeObserver) {
            return null;
          }
          return _ro = new this.targetWindow.ResizeObserver((entries) => {
            entries.forEach((entry) => {
              const run = () => {
                const node = entry.target;
                const index = this.indexFromElement(node);
                if (!node.isConnected) {
                  this.observer.unobserve(node);
                  for (const [cacheKey, cachedNode] of this.elementsCache) {
                    if (cachedNode === node) {
                      this.elementsCache.delete(cacheKey);
                      break;
                    }
                  }
                  return;
                }
                if (this.shouldMeasureDuringScroll(index)) {
                  this.resizeItem(index, this.options.measureElement(node, entry, this));
                }
              };
              this.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
            });
          });
        };
        return {
          disconnect: () => {
            var _a;
            (_a = get()) == null || _a.disconnect();
            _ro = null;
          },
          observe: (target) => {
            var _a;
            return (_a = get()) == null ? undefined : _a.observe(target, { box: "border-box" });
          },
          unobserve: (target) => {
            var _a;
            return (_a = get()) == null ? undefined : _a.unobserve(target);
          }
        };
      })();
      this.range = null;
      this.setOptions = (opts2) => {
        var _a, _b;
        const merged = {
          debug: false,
          initialOffset: 0,
          overscan: 1,
          paddingStart: 0,
          paddingEnd: 0,
          scrollPaddingStart: 0,
          scrollPaddingEnd: 0,
          horizontal: false,
          getItemKey: defaultKeyExtractor,
          rangeExtractor: defaultRangeExtractor,
          onChange: () => {},
          measureElement,
          initialRect: { width: 0, height: 0 },
          scrollMargin: 0,
          gap: 0,
          indexAttribute: "data-index",
          initialMeasurementsCache: [],
          lanes: 1,
          anchorTo: "start",
          followOnAppend: false,
          scrollEndThreshold: 1,
          isScrollingResetDelay: 150,
          enabled: true,
          isRtl: false,
          useScrollendEvent: false,
          useAnimationFrameWithResizeObserver: false,
          laneAssignmentMode: "estimate",
          useCachedMeasurements: false
        };
        for (const key in opts2) {
          const v = opts2[key];
          if (v !== undefined)
            merged[key] = v;
        }
        const prevOptions = this.options;
        let anchor = null;
        let followOnAppend = null;
        let edgeKeysChanged = false;
        if (prevOptions !== undefined && prevOptions.enabled && merged.enabled && merged.anchorTo === "end" && this.scrollElement !== null) {
          const prevCount = prevOptions.count;
          const nextCount = merged.count;
          const measurements = this.getMeasurements();
          const prevFirstKey = prevCount > 0 ? ((_a = measurements[0]) == null ? undefined : _a.key) ?? prevOptions.getItemKey(0) : null;
          const prevLastKey = prevCount > 0 ? ((_b = measurements[prevCount - 1]) == null ? undefined : _b.key) ?? prevOptions.getItemKey(prevCount - 1) : null;
          const didCountChange = nextCount !== prevCount;
          const didEdgeKeysChange = didCountChange || prevCount > 0 && nextCount > 0 && (merged.getItemKey(0) !== prevFirstKey || merged.getItemKey(nextCount - 1) !== prevLastKey);
          if (didEdgeKeysChange) {
            edgeKeysChanged = true;
            const item = prevCount > 0 ? this.getVirtualItemForOffset(this.getScrollOffset()) ?? measurements[0] : null;
            if (item) {
              anchor = [item.key, this.getScrollOffset() - item.start];
            }
            const behavior = merged.followOnAppend === true ? "auto" : merged.followOnAppend || null;
            if (behavior && nextCount > prevCount && this.isAtEnd(prevOptions.scrollEndThreshold) && (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)) {
              followOnAppend = behavior;
            }
          }
        }
        this.options = merged;
        if (edgeKeysChanged) {
          this.pendingMin = 0;
          this.itemSizeCacheVersion++;
        }
        let anchorResolved = false;
        let anchorDelta = 0;
        if (anchor && this.scrollOffset !== null) {
          const [anchorKey, anchorOffset] = anchor;
          const newMeasurements = this.getMeasurements();
          const { count, getItemKey } = this.options;
          let idx = 0;
          while (idx < count && getItemKey(idx) !== anchorKey) {
            idx++;
          }
          if (idx < count) {
            const anchorItem = newMeasurements[idx];
            if (anchorItem) {
              const newOffset = Math.max(0, anchorItem.start + anchorOffset);
              if (newOffset !== this.scrollOffset) {
                anchorDelta = newOffset - this.scrollOffset;
                this.scrollOffset = newOffset;
                anchorResolved = true;
              }
            }
          }
        }
        if (anchorResolved || followOnAppend) {
          this.pendingScrollAnchor = [
            anchorResolved ? anchor[0] : null,
            anchorResolved ? anchor[1] : 0,
            followOnAppend,
            anchorDelta
          ];
        }
      };
      this.notify = (sync) => {
        var _a, _b;
        (_b = (_a = this.options).onChange) == null || _b.call(_a, this, sync);
      };
      this.maybeNotify = memo(() => {
        this.calculateRange();
        return [
          this.isScrolling,
          this.range ? this.range.startIndex : null,
          this.range ? this.range.endIndex : null
        ];
      }, (isScrolling) => {
        this.notify(isScrolling);
      }, {
        key: "maybeNotify",
        debug: () => this.options.debug,
        initialDeps: [
          this.isScrolling,
          this.range ? this.range.startIndex : null,
          this.range ? this.range.endIndex : null
        ]
      });
      this.cleanup = () => {
        this.unsubs.filter(Boolean).forEach((d) => d());
        this.unsubs = [];
        this.observer.disconnect();
        if (this.rafId != null && this.targetWindow) {
          this.targetWindow.cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        this.scrollState = null;
        this._iosDeferredAdjustment = 0;
        this._iosTouching = false;
        this._iosJustTouchEnded = false;
        this.scrollElement = null;
        this.targetWindow = null;
      };
      this._didMount = () => {
        return () => {
          this.cleanup();
        };
      };
      this._willUpdate = () => {
        var _a;
        const scrollElement = this.options.enabled ? this.options.getScrollElement() : null;
        if (this.scrollElement !== scrollElement) {
          this.cleanup();
          if (!scrollElement) {
            this.maybeNotify();
            return;
          }
          this.scrollElement = scrollElement;
          if (this.scrollElement && "ownerDocument" in this.scrollElement) {
            this.targetWindow = this.scrollElement.ownerDocument.defaultView;
          } else {
            this.targetWindow = ((_a = this.scrollElement) == null ? undefined : _a.window) ?? null;
          }
          this.elementsCache.forEach((cached) => {
            this.observer.observe(cached);
          });
          this.unsubs.push(this.options.observeElementRect(this, (rect) => {
            this.scrollRect = rect;
            this.maybeNotify();
          }));
          this.unsubs.push(this.options.observeElementOffset(this, (offset, isScrolling) => {
            if (isScrolling && this._intendedScrollOffset === null && offset === this.scrollOffset) {
              return;
            }
            if (this._intendedScrollOffset !== null && Math.abs(offset - this._intendedScrollOffset) < 1.5) {
              offset = this._intendedScrollOffset;
            }
            this._intendedScrollOffset = null;
            this.scrollAdjustments = 0;
            const prevOffset = this.getScrollOffset();
            this.scrollDirection = isScrolling ? prevOffset === offset ? this.scrollDirection : prevOffset < offset ? "forward" : "backward" : null;
            this.scrollOffset = offset;
            this.isScrolling = isScrolling;
            this._flushIosDeferredIfReady();
            if (this.scrollState) {
              this.scheduleScrollReconcile();
            }
            this.maybeNotify();
          }));
          if ("addEventListener" in this.scrollElement) {
            const scrollEl = this.scrollElement;
            const onTouchStart = () => {
              this._iosTouching = true;
              this._iosJustTouchEnded = false;
              if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
                this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
                this._iosTouchEndTimerId = null;
              }
            };
            const onTouchEnd = () => {
              this._iosTouching = false;
              if (!isIOSWebKit() || this.targetWindow == null) {
                return;
              }
              this._iosJustTouchEnded = true;
              this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
                this._iosJustTouchEnded = false;
                this._iosTouchEndTimerId = null;
                this._flushIosDeferredIfReady();
              }, 150);
            };
            scrollEl.addEventListener("touchstart", onTouchStart, addEventListenerOptions);
            scrollEl.addEventListener("touchend", onTouchEnd, addEventListenerOptions);
            this.unsubs.push(() => {
              scrollEl.removeEventListener("touchstart", onTouchStart);
              scrollEl.removeEventListener("touchend", onTouchEnd);
              if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
                this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
                this._iosTouchEndTimerId = null;
              }
            });
          }
          this._scrollToOffset(this.getScrollOffset(), {
            adjustments: undefined,
            behavior: undefined
          });
        }
        const anchor = this.pendingScrollAnchor;
        this.pendingScrollAnchor = null;
        if (anchor && this.scrollElement && this.options.enabled) {
          const [key, _offset, followOnAppend, anchorDelta] = anchor;
          if (key !== null && !followOnAppend) {
            if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
              if (anchorDelta !== 0) {
                this._iosDeferredAdjustment += anchorDelta;
              }
            } else {
              this._scrollToOffset(this.getScrollOffset(), {
                adjustments: undefined,
                behavior: undefined
              });
            }
          }
          if (followOnAppend) {
            this.scrollToEnd({ behavior: followOnAppend });
          }
        }
      };
      this._flushIosDeferredIfReady = () => {
        if (this._iosDeferredAdjustment === 0)
          return;
        if (this.isScrolling)
          return;
        if (this._iosTouching)
          return;
        if (this._iosJustTouchEnded)
          return;
        const cur = this.getScrollOffset();
        const max = this.getMaxScrollOffset();
        if (cur < 0 || cur > max)
          return;
        if (this._iosDeferredAdjustment < 0 && cur >= max - 1) {
          this._iosDeferredAdjustment = 0;
          return;
        }
        const delta = this._iosDeferredAdjustment;
        this._iosDeferredAdjustment = 0;
        this._scrollToOffset(cur, {
          adjustments: this.scrollAdjustments += delta,
          behavior: undefined
        });
      };
      this.rafId = null;
      this.getSize = () => {
        if (!this.options.enabled) {
          this.scrollRect = null;
          return 0;
        }
        this.scrollRect = this.scrollRect ?? this.options.initialRect;
        return this.scrollRect[this.options.horizontal ? "width" : "height"];
      };
      this.getScrollOffset = () => {
        if (!this.options.enabled) {
          this.scrollOffset = null;
          return 0;
        }
        this.scrollOffset = this.scrollOffset ?? (typeof this.options.initialOffset === "function" ? this.options.initialOffset() : this.options.initialOffset);
        return this.scrollOffset;
      };
      this.getMeasurementOptions = memo(() => [
        this.options.count,
        this.options.paddingStart,
        this.options.scrollMargin,
        this.options.getItemKey,
        this.options.enabled,
        this.options.lanes,
        this.options.laneAssignmentMode,
        this.options.gap
      ], (count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap) => {
        const lanesChanged = this.prevLanes !== undefined && this.prevLanes !== lanes;
        if (lanesChanged) {
          this.lanesChangedFlag = true;
        }
        this.prevLanes = lanes;
        this.pendingMin = null;
        return {
          count,
          paddingStart,
          scrollMargin,
          getItemKey,
          enabled,
          lanes,
          laneAssignmentMode,
          gap
        };
      }, {
        key: false
      });
      this.getMeasurements = memo(() => [this.getMeasurementOptions(), this.itemSizeCacheVersion], ({
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
        enabled,
        lanes,
        laneAssignmentMode,
        gap
      }, _itemSizeCacheVersion) => {
        const itemSizeCache = this.itemSizeCache;
        if (!enabled) {
          this.measurementsCache = [];
          this.itemSizeCache.clear();
          this.laneAssignments.clear();
          return [];
        }
        if (this.laneAssignments.size > count) {
          for (const index of this.laneAssignments.keys()) {
            if (index >= count) {
              this.laneAssignments.delete(index);
            }
          }
        }
        if (this.lanesChangedFlag) {
          this.lanesChangedFlag = false;
          this.lanesSettling = true;
          this.measurementsCache = [];
          this.itemSizeCache.clear();
          this.laneAssignments.clear();
          this.pendingMin = null;
        }
        if (this.measurementsCache.length === 0 && !this.lanesSettling) {
          this.measurementsCache = this.options.initialMeasurementsCache;
          this.measurementsCache.forEach((item) => {
            this.itemSizeCache.set(item.key, item.size);
          });
        }
        const min = this.lanesSettling ? 0 : this.pendingMin ?? 0;
        this.pendingMin = null;
        if (this.lanesSettling && this.measurementsCache.length === count) {
          this.lanesSettling = false;
        }
        if (lanes === 1) {
          const need = count * 2;
          let flat = this._flatMeasurements;
          if (!flat || flat.length < need) {
            const next = new Float64Array(need);
            if (flat && min > 0)
              next.set(flat.subarray(0, min * 2));
            flat = next;
            this._flatMeasurements = flat;
          }
          let runningStart;
          if (min === 0) {
            runningStart = paddingStart + scrollMargin;
          } else {
            const prevIdx = min - 1;
            runningStart = flat[prevIdx * 2] + flat[prevIdx * 2 + 1] + gap;
          }
          for (let i = min;i < count; i++) {
            const key = getItemKey(i);
            const measuredSize = itemSizeCache.get(key);
            const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
            flat[i * 2] = runningStart;
            flat[i * 2 + 1] = size;
            runningStart += size + gap;
          }
          const view = createLazyMeasurementsView(count, flat, getItemKey);
          this.measurementsCache = view;
          return view;
        }
        const measurements = this.measurementsCache.slice(0, min);
        const laneLastIndex = new Array(lanes).fill(undefined);
        const laneEnds = new Float64Array(lanes);
        let filledLanes = 0;
        for (let m = 0;m < min; m++) {
          const item = measurements[m];
          if (item) {
            if (laneLastIndex[item.lane] === undefined)
              filledLanes++;
            laneLastIndex[item.lane] = m;
            laneEnds[item.lane] = item.end;
          }
        }
        for (let i = min;i < count; i++) {
          const key = getItemKey(i);
          const cachedLane = this.laneAssignments.get(i);
          let lane;
          let start;
          const shouldCacheLane = laneAssignmentMode === "estimate" || itemSizeCache.has(key);
          if (cachedLane !== undefined && this.options.lanes > 1) {
            lane = cachedLane;
            const prevIndex = laneLastIndex[lane];
            const prevInLane = prevIndex !== undefined ? measurements[prevIndex] : undefined;
            start = prevInLane ? prevInLane.end + gap : paddingStart + scrollMargin;
          } else if (filledLanes === lanes) {
            let bestLane = 0;
            let bestEnd = laneEnds[0];
            let bestIdx = laneLastIndex[0];
            for (let l = 1;l < lanes; l++) {
              const e = laneEnds[l];
              if (e < bestEnd || e === bestEnd && laneLastIndex[l] < bestIdx) {
                bestLane = l;
                bestEnd = e;
                bestIdx = laneLastIndex[l];
              }
            }
            lane = bestLane;
            start = bestEnd + gap;
            if (shouldCacheLane) {
              this.laneAssignments.set(i, lane);
            }
          } else {
            lane = i % this.options.lanes;
            start = paddingStart + scrollMargin;
            if (shouldCacheLane) {
              this.laneAssignments.set(i, lane);
            }
          }
          const measuredSize = itemSizeCache.get(key);
          const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
          const end = start + size;
          measurements[i] = {
            index: i,
            start,
            size,
            end,
            key,
            lane
          };
          if (laneLastIndex[lane] === undefined)
            filledLanes++;
          laneLastIndex[lane] = i;
          laneEnds[lane] = end;
        }
        this.measurementsCache = measurements;
        return measurements;
      }, {
        key: "getMeasurements",
        debug: () => this.options.debug
      });
      this.calculateRange = memo(() => [
        this.getMeasurements(),
        this.getSize(),
        this.getScrollOffset(),
        this.options.lanes
      ], (measurements, outerSize, scrollOffset, lanes) => {
        if (measurements.length === 0 || outerSize === 0) {
          this.range = null;
          return null;
        }
        this.range = calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, lanes === 1 && this._flatMeasurements != null ? this._flatMeasurements : null);
        return this.range;
      }, {
        key: "calculateRange",
        debug: () => this.options.debug
      });
      this.getVirtualIndexes = memo(() => {
        let startIndex = null;
        let endIndex = null;
        const range = this.calculateRange();
        if (range) {
          startIndex = range.startIndex;
          endIndex = range.endIndex;
        }
        this.maybeNotify.updateDeps([this.isScrolling, startIndex, endIndex]);
        return [
          this.options.rangeExtractor,
          this.options.overscan,
          this.options.count,
          startIndex,
          endIndex
        ];
      }, (rangeExtractor, overscan, count, startIndex, endIndex) => {
        return startIndex === null || endIndex === null ? [] : rangeExtractor({
          startIndex,
          endIndex,
          overscan,
          count
        });
      }, {
        key: "getVirtualIndexes",
        debug: () => this.options.debug
      });
      this.indexFromElement = (node) => {
        const attributeName = this.options.indexAttribute;
        const indexStr = node.getAttribute(attributeName);
        if (!indexStr) {
          console.warn(`Missing attribute name '${attributeName}={index}' on measured element.`);
          return -1;
        }
        return parseInt(indexStr, 10);
      };
      this.shouldMeasureDuringScroll = (index) => {
        var _a;
        if (!this.scrollState || this.scrollState.behavior !== "smooth") {
          return true;
        }
        const scrollIndex = this.scrollState.index ?? ((_a = this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)) == null ? undefined : _a.index);
        if (scrollIndex !== undefined && this.range) {
          const bufferSize = Math.max(this.options.overscan, Math.ceil((this.range.endIndex - this.range.startIndex) / 2));
          const minIndex = Math.max(0, scrollIndex - bufferSize);
          const maxIndex = Math.min(this.options.count - 1, scrollIndex + bufferSize);
          return index >= minIndex && index <= maxIndex;
        }
        return true;
      };
      this.measureElement = (node) => {
        if (!node) {
          this.elementsCache.forEach((cached, key2) => {
            if (!cached.isConnected) {
              this.observer.unobserve(cached);
              this.elementsCache.delete(key2);
            }
          });
          return;
        }
        const index = this.indexFromElement(node);
        const key = this.options.getItemKey(index);
        const prevNode = this.elementsCache.get(key);
        if (prevNode !== node) {
          if (prevNode) {
            this.observer.unobserve(prevNode);
          }
          this.observer.observe(node);
          this.elementsCache.set(key, node);
        }
        if ((!this.isScrolling || this.scrollState) && this.shouldMeasureDuringScroll(index)) {
          this.resizeItem(index, this.options.measureElement(node, undefined, this));
        }
      };
      this.resizeItem = (index, size) => {
        var _a, _b;
        if (index < 0 || index >= this.options.count)
          return;
        let cachedSize;
        let itemStart;
        let key;
        const flat = this._flatMeasurements;
        if (this.options.lanes === 1 && flat !== null) {
          key = this.options.getItemKey(index);
          itemStart = flat[index * 2];
          cachedSize = flat[index * 2 + 1];
        } else {
          const item = this.measurementsCache[index];
          if (!item)
            return;
          key = item.key;
          itemStart = item.start;
          cachedSize = item.size;
        }
        const itemSize = this.itemSizeCache.get(key) ?? cachedSize;
        const delta = size - itemSize;
        if (delta !== 0) {
          const wasAtEnd = this.options.anchorTo === "end" && ((_a = this.scrollState) == null ? undefined : _a.behavior) !== "smooth" && this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold;
          const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0;
          const scrollOffsetWithAdj = this.getScrollOffset() + this.scrollAdjustments;
          const isFirstMeasure = !this.itemSizeCache.has(key);
          const defaultShouldAdjust = isFirstMeasure ? itemStart < scrollOffsetWithAdj : itemStart + itemSize <= scrollOffsetWithAdj && this.scrollDirection !== "backward";
          const shouldAdjustScroll = ((_b = this.scrollState) == null ? undefined : _b.behavior) !== "smooth" && (this.shouldAdjustScrollPositionOnItemSizeChange !== undefined ? this.shouldAdjustScrollPositionOnItemSizeChange(this.measurementsCache[index] ?? {
            index,
            key,
            start: itemStart,
            size: cachedSize,
            end: itemStart + cachedSize,
            lane: 0
          }, delta, this) : defaultShouldAdjust);
          if (this.pendingMin === null || index < this.pendingMin) {
            this.pendingMin = index;
          }
          this.itemSizeCache.set(key, size);
          this.itemSizeCacheVersion++;
          let adjustedSync = false;
          if (wasAtEnd) {
            adjustedSync = this.applyScrollAdjustment(this.getTotalSize() - prevTotalSize);
          } else if (shouldAdjustScroll) {
            adjustedSync = this.applyScrollAdjustment(delta);
          }
          this.notify(adjustedSync);
        }
      };
      this.getVirtualItems = memo(() => [this.getVirtualIndexes(), this.getMeasurements()], (indexes, measurements) => {
        const virtualItems = [];
        for (let k = 0, len = indexes.length;k < len; k++) {
          const i = indexes[k];
          const measurement = measurements[i];
          virtualItems.push(measurement);
        }
        return virtualItems;
      }, {
        key: "getVirtualItems",
        debug: () => this.options.debug
      });
      this.getVirtualItemForOffset = (offset) => {
        const measurements = this.getMeasurements();
        if (measurements.length === 0) {
          return;
        }
        const flat = this._flatMeasurements;
        const useFlat = this.options.lanes === 1 && flat != null;
        const idx = findNearestBinarySearch(0, measurements.length - 1, useFlat ? (i) => flat[i * 2] : (i) => notUndefined(measurements[i]).start, offset);
        return notUndefined(measurements[idx]);
      };
      this.getMaxScrollOffset = () => {
        if (!this.scrollElement)
          return 0;
        if ("scrollHeight" in this.scrollElement) {
          return this.options.horizontal ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
        } else {
          const doc = this.scrollElement.document.documentElement;
          return this.options.horizontal ? doc.scrollWidth - this.scrollElement.innerWidth : doc.scrollHeight - this.scrollElement.innerHeight;
        }
      };
      this.getVirtualDistanceFromEnd = () => {
        return Math.max(this.getTotalSize() - this.getSize() - this.getScrollOffset(), 0);
      };
      this.getDistanceFromEnd = () => {
        return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0);
      };
      this.isAtEnd = (threshold = this.options.scrollEndThreshold) => {
        return this.getDistanceFromEnd() <= threshold;
      };
      this.getOffsetForAlignment = (toOffset, align, itemSize = 0) => {
        if (!this.scrollElement)
          return 0;
        const size = this.getSize();
        const scrollOffset = this.getScrollOffset();
        if (align === "auto") {
          align = toOffset >= scrollOffset + size ? "end" : "start";
        }
        if (align === "center") {
          toOffset += (itemSize - size) / 2;
        } else if (align === "end") {
          toOffset -= size;
        }
        const maxOffset = this.getMaxScrollOffset();
        return Math.max(Math.min(maxOffset, toOffset), 0);
      };
      this.getOffsetForIndex = (index, align = "auto") => {
        index = Math.max(0, Math.min(index, this.options.count - 1));
        const size = this.getSize();
        const scrollOffset = this.getScrollOffset();
        const item = this.measurementsCache[index];
        if (!item)
          return;
        if (align === "auto") {
          if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) {
            align = "end";
          } else if (item.start <= scrollOffset + this.options.scrollPaddingStart) {
            align = "start";
          } else {
            return [scrollOffset, align];
          }
        }
        if (align === "end" && index === this.options.count - 1) {
          return [this.getMaxScrollOffset(), align];
        }
        const toOffset = align === "end" ? item.end + this.options.scrollPaddingEnd : item.start - this.options.scrollPaddingStart;
        return [
          this.getOffsetForAlignment(toOffset, align, item.size),
          align
        ];
      };
      this.scrollToOffset = (toOffset, { align = "start", behavior = "auto" } = {}) => {
        this._iosDeferredAdjustment = 0;
        const offset = this.getOffsetForAlignment(toOffset, align);
        const now = this.now();
        this.scrollState = {
          index: null,
          align,
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: undefined, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollToIndex = (index, {
        align: initialAlign = "auto",
        behavior = "auto"
      } = {}) => {
        this._iosDeferredAdjustment = 0;
        index = Math.max(0, Math.min(index, this.options.count - 1));
        const offsetInfo = this.getOffsetForIndex(index, initialAlign);
        if (!offsetInfo) {
          return;
        }
        const [offset, align] = offsetInfo;
        const now = this.now();
        this.scrollState = {
          index,
          align,
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: undefined, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollBy = (delta, { behavior = "auto" } = {}) => {
        const offset = this.getScrollOffset() + delta;
        const now = this.now();
        this.scrollState = {
          index: null,
          align: "start",
          behavior,
          startedAt: now,
          lastTargetOffset: offset,
          stableFrames: 0
        };
        this._scrollToOffset(offset, { adjustments: undefined, behavior });
        this.scheduleScrollReconcile();
      };
      this.scrollToEnd = ({ behavior = "auto" } = {}) => {
        if (this.options.count > 0) {
          this.scrollToIndex(this.options.count - 1, {
            align: "end",
            behavior
          });
          return;
        }
        this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), {
          behavior
        });
      };
      this.getTotalSize = () => {
        var _a;
        const measurements = this.getMeasurements();
        let end;
        if (measurements.length === 0) {
          end = this.options.paddingStart;
        } else if (this.options.lanes === 1) {
          const lastIdx = measurements.length - 1;
          const flat = this._flatMeasurements;
          if (flat != null) {
            end = flat[lastIdx * 2] + flat[lastIdx * 2 + 1];
          } else {
            end = ((_a = measurements[lastIdx]) == null ? undefined : _a.end) ?? 0;
          }
        } else {
          const endByLane = Array(this.options.lanes).fill(null);
          let endIndex = measurements.length - 1;
          while (endIndex >= 0 && endByLane.some((val) => val === null)) {
            const item = measurements[endIndex];
            if (endByLane[item.lane] === null) {
              endByLane[item.lane] = item.end;
            }
            endIndex--;
          }
          end = Math.max(...endByLane.filter((val) => val !== null));
        }
        return Math.max(end - this.options.scrollMargin + this.options.paddingEnd, 0);
      };
      this.takeSnapshot = () => {
        const snapshot = [];
        if (this.itemSizeCache.size === 0)
          return snapshot;
        const m = this.getMeasurements();
        for (const item of m) {
          if (item && this.itemSizeCache.has(item.key)) {
            snapshot.push({
              index: item.index,
              key: item.key,
              start: item.start,
              size: item.size,
              end: item.end,
              lane: item.lane
            });
          }
        }
        return snapshot;
      };
      this._scrollToOffset = (offset, {
        adjustments,
        behavior
      }) => {
        this._intendedScrollOffset = offset + (adjustments ?? 0);
        this.options.scrollToFn(offset, { behavior, adjustments }, this);
      };
      this.measure = () => {
        this.pendingMin = null;
        this.itemSizeCache.clear();
        this.laneAssignments.clear();
        this.itemSizeCacheVersion++;
        this.notify(false);
      };
      this.setOptions(opts);
    }
    applyScrollAdjustment(delta, behavior) {
      if (delta === 0)
        return false;
      if (this.options.debug) {
        console.info("correction", delta);
      }
      if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
        this._iosDeferredAdjustment += delta;
        return false;
      } else {
        this._scrollToOffset(this.getScrollOffset(), {
          adjustments: this.scrollAdjustments += delta,
          behavior
        });
        if (this.scrollOffset !== null) {
          this.scrollOffset += this.scrollAdjustments;
          if (this.scrollOffset < 0)
            this.scrollOffset = 0;
          this.scrollAdjustments = 0;
        }
        return true;
      }
    }
    scheduleScrollReconcile() {
      if (!this.targetWindow) {
        this.scrollState = null;
        return;
      }
      if (this.rafId != null)
        return;
      this.rafId = this.targetWindow.requestAnimationFrame(() => {
        this.rafId = null;
        this.reconcileScroll();
      });
    }
    reconcileScroll() {
      if (!this.scrollState)
        return;
      const el = this.scrollElement;
      if (!el)
        return;
      const MAX_RECONCILE_MS = 5000;
      if (this.now() - this.scrollState.startedAt > MAX_RECONCILE_MS) {
        this.scrollState = null;
        return;
      }
      const offsetInfo = this.scrollState.index != null ? this.getOffsetForIndex(this.scrollState.index, this.scrollState.align) : undefined;
      const targetOffset = offsetInfo ? offsetInfo[0] : this.scrollState.lastTargetOffset;
      const STABLE_FRAMES = 1;
      const targetChanged = targetOffset !== this.scrollState.lastTargetOffset;
      if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
        this.scrollState.stableFrames++;
        if (this.scrollState.stableFrames >= STABLE_FRAMES) {
          if (this.getScrollOffset() !== targetOffset) {
            this._scrollToOffset(targetOffset, {
              adjustments: undefined,
              behavior: "auto"
            });
          }
          this.scrollState = null;
          return;
        }
      } else {
        this.scrollState.stableFrames = 0;
        if (targetChanged) {
          const viewport = this.getSize() || 600;
          const distance = Math.abs(targetOffset - this.getScrollOffset());
          const keepSmooth = this.scrollState.behavior === "smooth" && distance > viewport;
          this.scrollState.lastTargetOffset = targetOffset;
          if (!keepSmooth) {
            this.scrollState.behavior = "auto";
          }
          this._scrollToOffset(targetOffset, {
            adjustments: undefined,
            behavior: keepSmooth ? "smooth" : "auto"
          });
        }
      }
      this.scheduleScrollReconcile();
    }
  }
  var findNearestBinarySearch = (low, high, getCurrentValue, value) => {
    while (low <= high) {
      const middle = (low + high) / 2 | 0;
      const currentValue = getCurrentValue(middle);
      if (currentValue < value) {
        low = middle + 1;
      } else if (currentValue > value) {
        high = middle - 1;
      } else {
        return middle;
      }
    }
    if (low > 0) {
      return low - 1;
    } else {
      return 0;
    }
  };
  function findNearestBinarySearchFlat(flat, high, value) {
    let low = 0;
    while (low <= high) {
      const middle = (low + high) / 2 | 0;
      const currentValue = flat[middle * 2];
      if (currentValue < value) {
        low = middle + 1;
      } else if (currentValue > value) {
        high = middle - 1;
      } else {
        return middle;
      }
    }
    return low > 0 ? low - 1 : 0;
  }
  function calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, flat) {
    const lastIndex = measurements.length - 1;
    if (measurements.length <= lanes) {
      return { startIndex: 0, endIndex: lastIndex };
    }
    if (lanes === 1 && flat !== null) {
      const startIndex2 = findNearestBinarySearchFlat(flat, lastIndex, scrollOffset);
      let endIndex2 = startIndex2;
      const limit = scrollOffset + outerSize;
      while (endIndex2 < lastIndex && flat[endIndex2 * 2] + flat[endIndex2 * 2 + 1] < limit) {
        endIndex2++;
      }
      return { startIndex: startIndex2, endIndex: endIndex2 };
    }
    const getStart = (index) => measurements[index].start;
    let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset);
    let endIndex = startIndex;
    if (lanes === 1) {
      while (endIndex < lastIndex && measurements[endIndex].end < scrollOffset + outerSize) {
        endIndex++;
      }
    } else if (lanes > 1) {
      const endPerLane = Array(lanes).fill(0);
      while (endIndex < lastIndex && endPerLane.some((pos) => pos < scrollOffset + outerSize)) {
        const item = measurements[endIndex];
        endPerLane[item.lane] = item.end;
        endIndex++;
      }
      const startPerLane = Array(lanes).fill(scrollOffset + outerSize);
      while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
        const item = measurements[startIndex];
        startPerLane[item.lane] = item.start;
        startIndex--;
      }
      startIndex = Math.max(0, startIndex - startIndex % lanes);
      endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - endIndex % lanes));
    }
    return { startIndex, endIndex };
  }

  // scripts/lib/trace-site-inspector/trace-list.ts
  function mergeTraceRows(current, incoming, options) {
    const ordered = options.direction === "prepend" ? [...incoming, ...current] : [...current, ...incoming];
    const deduped = dedupeTraceRows(ordered);
    return retainTraceWindow(deduped, options.maxRows, options.direction, options.selectedKey ?? "");
  }
  function retainTraceWindow(rows, maxRows, direction, selectedKey = "") {
    const limit = Math.max(1, Math.floor(maxRows));
    if (rows.length <= limit)
      return rows;
    const window2 = direction === "append" ? rows.slice(-limit) : rows.slice(0, limit);
    if (direction === "history")
      return window2;
    if (!selectedKey || window2.some((row) => stableTraceKey(row) === selectedKey))
      return window2;
    const selectedIndex = rows.findIndex((row) => stableTraceKey(row) === selectedKey);
    if (selectedIndex < 0)
      return window2;
    const start = direction === "append" ? Math.min(selectedIndex, rows.length - limit) : Math.max(0, selectedIndex - limit + 1);
    return rows.slice(start, start + limit);
  }
  function shouldPrefetchTracePage(state) {
    if (state.fetching || !state.nextCursor || state.rowCount <= 0 || state.lastVirtualIndex === null)
      return false;
    const remainingRows = state.rowCount - state.lastVirtualIndex - 1;
    return remainingRows <= Math.max(0, state.threshold);
  }

  // scripts/lib/trace-site-inspector/table-formatters.ts
  var TOOL_LABELS = {
    "fs.apply_patch": "fs.patch",
    "fs.search": "files.search",
    get_steering: "steering",
    "review.run": "review",
    "tools.search": "search"
  };
  function isDefaultTraceTableRowVisible(row) {
    const tool = clean(row.name ?? row.traceName ?? row.tool);
    return tool !== "authentication.mcp" || isFailure(row);
  }
  function formatTraceTableRow(row) {
    const input = resolvedInput(row);
    const toolLabel = semanticToolLabel(row, input);
    const isError = isFailure(row);
    const inputLabel = summarizeInput(row, input, toolLabel);
    const outputLabel = summarizeOutput(row, input, toolLabel, isError);
    return {
      toolLabel,
      inputLabel,
      outputLabel,
      inputFull: valueText(row.rawResolvedInputJson ?? row.rawInputJson ?? row.inputObj ?? row.input) || inputLabel,
      outputFull: valueText(row.rawResultJson ?? row.outputObj ?? row.resultObj ?? row.output ?? row.summary) || outputLabel,
      isError,
      statusLabel: isError ? "error" : "success"
    };
  }
  function semanticToolLabel(row, input = resolvedInput(row)) {
    const tool = clean(row.name ?? row.traceName ?? row.tool) || "trace";
    if (isWorkpadActivity(row, input)) {
      if (tool === "fs.apply_patch" || tool === "fs.patch")
        return "workpad.patch";
      if (tool === "fs.read")
        return "workpad.read";
      if (tool === "fs.write")
        return "workpad.edit";
      const mode = clean(input?.mode) || summaryPrefix(row.input)?.mode || "view";
      return `workpad.${mode === "write" ? "edit" : mode.toLowerCase()}`;
    }
    if (tool === "code.call") {
      const language = clean(input?.language) || summaryPrefix(row.input)?.language || "code";
      const mode = clean(input?.mode) || summaryPrefix(row.input)?.mode || "call";
      return `${normalizeLanguage(language)}.${mode.toLowerCase()}`;
    }
    if (tool === "github") {
      const operation = clean(input?.operation);
      return operation ? `github.${operation}` : "github";
    }
    if (tool === "browser") {
      const action = clean(input?.action ?? input?.operation);
      return action ? `browser.${action}` : "browser";
    }
    return TOOL_LABELS[tool] ?? tool;
  }
  function traceFilterFacets(rows) {
    const toolCounts = new Map;
    const branchCounts = new Map;
    const statusCounts = new Map;
    for (const row of rows) {
      if (!isDefaultTraceTableRowVisible(row))
        continue;
      increment(branchCounts, branchName(row));
      increment(statusCounts, isFailure(row) ? "error" : "success");
      const labels = new Set([
        formatTraceTableRow(row).toolLabel,
        ...childTraceRecords(row).map((child) => formatTraceTableRow(child).toolLabel)
      ]);
      for (const label of labels)
        increment(toolCounts, label);
    }
    return {
      tools: sortedFacets(toolCounts),
      branches: sortedFacets(branchCounts),
      statuses: sortedFacets(statusCounts)
    };
  }
  function matchesTraceTableFilters(row, filters) {
    const branch = branchName(row);
    if (filters.branches.size && !filters.branches.has(branch))
      return false;
    const status = isFailure(row) ? "error" : "success";
    if (filters.statuses.size && !filters.statuses.has(status))
      return false;
    const records = [row, ...childTraceRecords(row)];
    if (filters.tools.size && !records.some((record) => filters.tools.has(formatTraceTableRow(record).toolLabel))) {
      return false;
    }
    const query = filters.query.trim().toLowerCase();
    if (!query)
      return true;
    return records.some((record) => {
      const formatted = formatTraceTableRow(record);
      return [
        formatted.toolLabel,
        formatted.inputLabel,
        formatted.outputLabel,
        branchName(record),
        clean(record.traceId ?? record.trace),
        clean(record.code)
      ].join(" ").toLowerCase().includes(query);
    });
  }
  function summarizeInput(row, input, toolLabel) {
    const tool = clean(row.name ?? row.traceName ?? row.tool);
    if (isWorkpadActivity(row, input)) {
      const action = toolLabel.split(".").at(-1) || "view";
      return `${action === "patch" ? "patch" : action} workpad.md`;
    }
    if (tool === "code.call") {
      const rawExisting = valueText(row.input);
      const existing = isSerializedStructure(rawExisting) ? "" : rawExisting;
      const stripped = stripCodePrefix(existing, input, toolLabel);
      const visibleInput = stripped || existing;
      if (stripped && stripped !== existing && !looksLikeSourceCode(stripped) && isUsefulDisplayValue(stripped)) {
        return normalizeSeparators(stripped);
      }
      const code = clean(input?.code);
      const codeSummary = summarizeCode(code, clean(input?.mode));
      const candidate = !visibleInput || visibleInput === code || looksLikeSourceCode(visibleInput) || !isUsefulDisplayValue(visibleInput) ? codeSummary : visibleInput;
      return isUsefulDisplayValue(candidate) ? normalizeSeparators(candidate) : "inspect source";
    }
    if (tool === "get_steering")
      return "workspace guidance";
    if (tool === "authentication.mcp" || tool === "authorization.mcp") {
      return summarizeMcpAuthentication(input, tool);
    }
    if (tool === "wait") {
      const seconds = numeric(input?.seconds);
      const reason = clean(input?.reason);
      const pr = clean(input?.pr);
      const subject = seconds > 0 ? `wait ${seconds}s` : pr ? `wait for PR #${pr}` : "wait";
      return [subject, reason].filter(Boolean).join(" · ");
    }
    if (tool === "status")
      return "workspace status";
    if (tool === "tools.search" || tool === "fs.search") {
      return clean(input?.query ?? input?.keyword ?? input?.pattern) || valueText(row.input);
    }
    if (tool === "fs.read") {
      return summarizePaths("read", input) || humanPayload(row.input, "read file");
    }
    if (tool === "fs.write") {
      return summarizePaths("write", input) || humanPayload(row.input, "write file");
    }
    if (tool === "fs.list") {
      return summarizePaths("list", input) || "list files";
    }
    if (tool === "fs.apply_patch") {
      const paths = patchPaths(input, row);
      return paths.length ? `patch ${paths.length} ${paths.length === 1 ? "file" : "files"} · ${paths.join(", ")}` : "patch files";
    }
    if (tool === "github") {
      const repo = clean(input?.repo);
      const pr = clean(input?.pr);
      const branch = clean(input?.branch ?? input?.head);
      const subject = pr ? `PR #${pr}` : branch || clean(input?.operation);
      return [subject, repo].filter(Boolean).join(" · ");
    }
    if (tool === "batch") {
      const steps = batchSteps(input, row);
      const labels = [
        ...new Set(steps.map((step) => clean(record(step)?.tool)).filter(Boolean))
      ];
      return steps.length ? `${steps.length} operations${labels.length ? ` · ${labels.join(", ")}` : ""}` : normalizeSeparators(valueText(row.input));
    }
    if (tool === "review.run") {
      return clean(input?.base ?? input?.branch) || "current changes";
    }
    if (tool === "aiReview" || tool === "prReview") {
      const pr = clean(input?.pr ?? input?.number);
      return pr ? `PR #${pr}` : "current pull request";
    }
    if (tool === "verify") {
      return clean(input?.base ?? input?.branch) || "current task";
    }
    if (tool.startsWith("task.")) {
      const command = stringArray(input?.command);
      if (command.length)
        return summarizeSpawnedCommand(command);
      return clean(input?.title ?? input?.branch ?? input?.stream ?? input?.message) || normalizeSeparators(valueText(row.input));
    }
    if (tool === "git.diff") {
      const base = clean(input?.base);
      const head = clean(input?.head ?? input?.branch);
      return [base, head].filter(Boolean).join("…") || "current changes";
    }
    if (tool.startsWith("browser")) {
      const target = clean(input?.url ?? input?.selector ?? input?.expression);
      if (target)
        return target;
      if (clean(input?.js)) {
        return tool.includes("test") ? "run browser test" : "evaluate page state";
      }
      const action = clean(input?.action);
      if (action)
        return action;
      return humanPayload(row.input, "browser request");
    }
    if (tool === "stream.context") {
      return clean(input?.area ?? input?.stream) || normalizeSeparators(valueText(row.input));
    }
    const summary = summarizeObject(input);
    const raw = valueText(row.input);
    return normalizeSeparators(summary || (isSerializedStructure(raw) ? "request details" : raw));
  }
  function summarizeOutput(row, input, toolLabel, isError) {
    const tool = clean(row.name ?? row.traceName ?? row.tool);
    if (isError) {
      const error = extractTraceError(row);
      if (tool.startsWith("browser"))
        return "browser evaluation failed";
      const detail = [
        error.detail,
        row.rawStderr ?? row.stderr,
        row.output ?? row.summary
      ].map((value) => humanPayload(value, "")).find(Boolean);
      return normalizeSeparators(humanErrorDetail(detail) || humanStatusCode(error.code || row.code) || "error");
    }
    if (tool === "get_steering")
      return "steering loaded";
    const result = resultRecord(row);
    const data = record(result?.data) ?? result;
    if (tool === "code.call") {
      const mode = toolLabel.split(".").at(-1);
      const changed = stringArray(data?.filesChanged ?? result?.filesChanged);
      if (changed.length) {
        const files = changed.map(fileName).filter(isUsefulDisplayValue);
        const countLabel = `changed ${changed.length} ${changed.length === 1 ? "file" : "files"}`;
        return files.length ? `${countLabel} · ${files.join(", ")}` : countLabel;
      }
      const testSummary = summarizeTests(clean(data?.stdout ?? result?.stdout ?? row.output));
      if (testSummary)
        return testSummary;
      if (mode === "read")
        return "read complete";
      if (mode === "edit")
        return "edit complete";
      if (mode === "verify")
        return "verification passed";
      return "completed";
    }
    if (tool === "fs.apply_patch") {
      const paths = patchPaths(input, row);
      return paths.length ? `patched ${paths.length} ${paths.length === 1 ? "file" : "files"} · ${paths.join(", ")}` : "patch applied";
    }
    if (tool === "verify")
      return "verification passed";
    if (tool === "review.run") {
      const summary = record(data?.summary ?? result?.summary);
      const issues = numeric(summary?.blockingIssues ?? summary?.yourIssues);
      return issues === 0 ? "review passed · 0 issues" : `review complete · ${issues} issues`;
    }
    if (tool === "task.start") {
      const branch = clean(data?.branch ?? result?.branch);
      return branch ? `created ${branch}` : "task started";
    }
    if (tool === "task.push") {
      const message = clean(data?.message ?? result?.message);
      return message ? `pushed · ${message}` : "pushed";
    }
    if (tool === "task.pr") {
      const stream = clean(data?.stream ?? result?.stream);
      const merged = data?.taskPrMerged === true || result?.taskPrMerged === true;
      return merged && stream ? `merged into ${stream}` : "pull request ready";
    }
    if (tool === "task.finish")
      return "task finished · worktree removed";
    if (tool === "github") {
      const summary = record(data?.summary ?? result?.summary);
      const state = clean(summary?.state);
      const number2 = clean(summary?.number);
      return [state.toLowerCase(), number2 ? `#${number2}` : ""].filter(Boolean).join(" · ") || "GitHub request complete";
    }
    if (tool === "batch") {
      const children = childTraceRecords(row);
      return children.length ? `${children.length} operations complete` : normalizeSeparators(valueText(row.output ?? row.summary) || "batch complete");
    }
    return normalizeSeparators(clean(data?.message ?? result?.message) || humanPayload(row.output ?? row.summary, "completed"));
  }
  function resolvedInput(row) {
    const parsed = parseMaybeJson(row.rawResolvedInputJson ?? row.rawInputJson ?? row.inputObj ?? row.input);
    return record(parsed) ?? record(row.input);
  }
  function resultRecord(row) {
    return record(parseMaybeJson(row.rawResultJson ?? row.outputObj ?? row.resultObj));
  }
  function batchSteps(input, row) {
    const parsed = parseMaybeJson(row.rawResolvedInputJson ?? row.rawInputJson ?? input);
    if (Array.isArray(parsed))
      return parsed;
    const source = record(parsed);
    return Array.isArray(source?.steps) ? source.steps : [];
  }
  function stripCodePrefix(summary, input, toolLabel) {
    const [labelLanguage, labelMode] = toolLabel.split(".");
    const language = clean(input?.language) || labelLanguage;
    const mode = clean(input?.mode) || labelMode;
    if (!summary)
      return "";
    return summary.replace(new RegExp(`^(?:${escapeRegExp(language)})[\\/.](?:${escapeRegExp(mode)})\\s*(?:[-–—·•]\\s*)?`, "i"), "").trim();
  }
  function summaryPrefix(value) {
    const match = valueText(value).match(/^([a-z0-9_+-]+)[/.]([a-z0-9_+-]+)/i);
    return match ? { language: match[1], mode: match[2] } : null;
  }
  function summarizeCode(code, mode) {
    if (!code)
      return mode || "";
    const patchFiles = [
      ...new Set([...code.matchAll(/\*\*\* (?:Update|Add|Delete) File: ([^\n\\]+)/g)].map((match) => fileName(match[1].trim())))
    ];
    if (patchFiles.length) {
      return `edit ${patchFiles.length} ${patchFiles.length === 1 ? "file" : "files"} · ${patchFiles.join(", ")}`;
    }
    const assignedWrite = code.match(/const\s+([a-zA-Z_$][\w$]*)\s*=\s*['"]([^'"]+)['"][\s\S]{0,800}?Bun\.write\(\s*\1\b/);
    const directWrite = code.match(/Bun\.write\(\s*['"]([^'"]+)['"]/);
    const writePath = assignedWrite?.[2] ?? directWrite?.[1];
    if (writePath)
      return `edit ${fileName(writePath)}`;
    const file = code.match(/(?:Bun\.file|readFileSync|readFile)\(\s*['"]([^'"]+)['"]/);
    if (file) {
      return `${mode === "edit" ? "edit" : "read"} ${fileName(file[1])}`;
    }
    const command = spawnedCommand(code);
    if (command.length)
      return summarizeSpawnedCommand(command);
    const test = code.match(/(?:vitest|jest|test)\s+(?:run\s+)?([^'"\n;]+)/i);
    if (test)
      return `test ${test[1].trim()}`;
    if (/matchAll?[\s\S]{0,180}(?:fail|error|test)/i.test(code)) {
      return "inspect test failures";
    }
    if (/\b(?:readFile|Bun\.file|\.text\(\))\b/.test(code)) {
      return "inspect file contents";
    }
    if (/\b(?:writeFile|Bun\.write|applyPatch)\b/.test(code)) {
      return "edit files";
    }
    if (mode === "verify")
      return "run verification";
    if (mode === "edit")
      return "edit source";
    if (mode === "read")
      return "inspect source";
    return "run code";
  }
  function isWorkpadActivity(row, input) {
    const values = [
      row.input,
      row.summary,
      row.rawInputJson,
      row.rawResolvedInputJson,
      input?.path,
      input?.file,
      input?.paths,
      input?.files,
      input?.patch,
      input?.content,
      input?.code
    ];
    return values.some((value) => /\bworkpad\.md\b/i.test(valueText(value)));
  }
  function spawnedCommand(code) {
    const array = code.match(/Bun\.spawn(?:Sync)?\(\s*\[([\s\S]{0,2400}?)\]\s*(?:,|\))/)?.[1];
    if (!array)
      return [];
    return [...array.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)].map((match) => match[1] ?? match[2] ?? "").map((value) => value.replace(/\\(["'\\])/g, "$1").replace(/\\[nrt]/g, " ").trim()).filter(Boolean);
  }
  function summarizeSpawnedCommand(command) {
    const runnerIndex = command.findIndex((part) => /^(?:vitest|jest|mocha)$/.test(fileName(part)));
    if (runnerIndex >= 0) {
      const target = command.slice(runnerIndex + 1).find((part) => part !== "run" && !part.startsWith("-"));
      return target ? `test ${fileName(target)}` : `test ${fileName(command[runnerIndex])}`;
    }
    if (command[0] === "bun" && command[1] && /\.[cm]?[jt]s$/.test(command[1])) {
      return `run ${fileName(command[1])}`;
    }
    if (command[0] === "bunx" && command[1] === "prettier")
      return "format files";
    if (command[0] === "git") {
      return `git ${command.slice(1, 4).join(" ")}`.trim();
    }
    if (command[0] === "rg") {
      const query = command.slice(1).find((part) => !part.startsWith("-"));
      return query ? `search ${query}` : "search files";
    }
    return `run ${command.slice(0, 4).map(fileName).join(" ")}`;
  }
  function summarizeTests(output) {
    const failed = output.match(/(?:Tests?|test)\s+(\d+)\s+failed/i);
    if (failed)
      return `${failed[1]} tests failed`;
    const passed = output.match(/(?:Tests?|test)\s+(\d+)\s+passed/i);
    if (passed)
      return `${passed[1]} tests passed`;
    return "";
  }
  function summarizePaths(verb, input) {
    if (!input)
      return "";
    const paths = stringArray(input.paths ?? input.files);
    const single = clean(input.path ?? input.file);
    if (single)
      paths.unshift(single);
    const unique = [...new Set(paths)].map(fileName).filter(isUsefulDisplayValue);
    if (!unique.length)
      return "";
    if (unique.length === 1)
      return `${verb} ${unique[0]}`;
    return `${verb} ${unique.length} files · ${unique.join(", ")}`;
  }
  function patchPaths(input, row) {
    const patch = clean(input?.patch ?? input?.content ?? row.input);
    return [
      ...new Set([...patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm)].map((match) => fileName(match[1].trim())))
    ];
  }
  function summarizeMcpAuthentication(input, tool) {
    const mode = authModeLabel(clean(input?.authMode));
    const route = clean(input?.route);
    const scope = clean(input?.requiredScope);
    const prefix = tool === "authorization.mcp" && !mode ? "MCP authorization" : mode;
    return [prefix, route, scope].filter(Boolean).join(" · ") || "MCP authentication";
  }
  function authModeLabel(value) {
    if (!value)
      return "";
    if (value.toLowerCase() === "oauth")
      return "OAuth";
    return value.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
  }
  function summarizeObject(input) {
    if (!input)
      return "";
    const route = clean(input.route);
    const scope = clean(input.requiredScope);
    if (route || scope)
      return [route, scope].filter(Boolean).join(" · ");
    const repo = clean(input.repo);
    const pullRequest = clean(input.pr ?? input.number);
    if (repo && pullRequest)
      return `PR #${pullRequest} · ${repo}`;
    for (const key of [
      "query",
      "path",
      "branch",
      "title",
      "operation",
      "action",
      "message",
      "url",
      "selector",
      "keyword",
      "pattern",
      "repo",
      "tool",
      "target",
      "provider"
    ]) {
      const value = clean(input[key]);
      if (value)
        return value;
    }
    return "";
  }
  function normalizeSeparators(value) {
    return value.replace(/\s+(?:-|–|—)\s+/g, " · ").replace(/\s*·\s*/g, " · ").replace(/\s+/g, " ").trim();
  }
  function humanPayload(value, fallback) {
    const text = valueText(value);
    return !isUsefulDisplayValue(text) || isSerializedStructure(text) ? fallback : text;
  }
  function isUsefulDisplayValue(value) {
    const text = value.trim();
    return Boolean(text) && !/\[REDACTED(?:_[A-Z_]+)?(?::[^\]]+)?\]/.test(text);
  }
  function humanStatusCode(value) {
    return clean(value).replaceAll("_", " ").toLowerCase();
  }
  function humanErrorDetail(value) {
    const text = clean(value).replace(/^error:\s*/i, "");
    const script = text.match(/^Script not found ["']([^"']+)["']$/i);
    return script ? `script not found · ${script[1]}` : text;
  }
  function isSerializedStructure(value) {
    const trimmed = value.trim();
    if (!trimmed || !"[{".includes(trimmed[0] ?? ""))
      return false;
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return /^\{\s*"[^"\\]+"\s*:/.test(trimmed);
    }
  }
  function looksLikeSourceCode(value) {
    return /^(?:const|let|var|await|return|import|export|function|async)\b/.test(value) || /\b(?:Bun|Promise|JSON)\./.test(value) || value.includes("*** Begin Patch");
  }
  function valueText(value) {
    if (typeof value === "string")
      return value.trim();
    if (value === null || value === undefined)
      return "";
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  function record(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }
  function stringArray(value) {
    return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
  }
  function fileName(value) {
    return value.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? value;
  }
  function normalizeLanguage(value) {
    return value.toLowerCase() === "javascript" ? "js" : value.toLowerCase();
  }
  function increment(map, value) {
    if (!value)
      return;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  function sortedFacets(map) {
    return [...map].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  function numeric(value) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // scripts/lib/trace-site-inspector/virtual-list-browser.ts
  var MAX_RETAINED_ROWS = 1e5;
  var PREFETCH_THRESHOLD = 25;
  var ESTIMATED_ROW_HEIGHT = 44;
  var OVERSCAN = 12;
  var TRACE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  var NO_FILTER_MATCH = "__trace-none__";
  var FILTER_PREVIEW_COUNT = 10;
  var filters = {
    query: "",
    branches: new Set,
    tools: new Set,
    statuses: new Set
  };
  var expandedFilterKinds = new Set;
  var filterSearch = "";
  var filterPanelOpen = false;
  var fontPreferenceInitialized = false;
  var hoverOpenTimer = 0;
  var hoverCloseTimer = 0;
  var hoverTarget = null;
  var currentFacets = {
    tools: [],
    branches: [],
    statuses: []
  };

  class TraceVirtualListController {
    target;
    rows;
    visibleRows = [];
    filteredRows = [];
    items = [];
    nextCursor;
    lastRequestedCursor = null;
    fetching = false;
    ownedMap = new Map;
    rootKeys = new Set;
    firstFilteredPosition = 0;
    lastMutation = "initial";
    mountedCount = 0;
    range = "empty";
    virtualizer;
    unmount;
    constructor(target, rows, nextCursor) {
      this.target = target;
      this.rows = mergeTraceRows([], rows, {
        direction: "append",
        maxRows: MAX_RETAINED_ROWS,
        selectedKey: currentSelectedRootKey()
      });
      this.nextCursor = nextCursor;
      this.target.scroller.dataset.traceVirtualList = "active";
      this.target.content.dataset.traceVirtualContent = "";
      this.target.content.replaceChildren();
      this.refreshItems();
      this.virtualizer = new Virtualizer(this.virtualizerOptions());
      this.unmount = this.virtualizer._didMount();
      this.virtualizer._willUpdate();
      this.replaceOwnedMap();
      this.render(this.virtualizer);
    }
    isMountedOn(target) {
      return this.target.scroller === target.scroller && this.target.content === target.content && this.target.content.isConnected;
    }
    destroy() {
      this.unmount();
      this.target.scroller.removeAttribute("data-trace-virtual-list");
      this.target.content.removeAttribute("data-trace-virtual-content");
    }
    reassertOwnership() {
      if (traceWindow().__traceRowsByTraceId === this.ownedMap)
        return;
      traceWindow().__traceRowsByTraceId = this.ownedMap;
    }
    syncFilters() {
      this.refreshItems();
      this.commitItems(true);
    }
    appendPage(rows, nextCursor) {
      this.nextCursor = nextCursor;
      this.lastRequestedCursor = null;
      this.fetching = false;
      this.setRows(rows, "history");
    }
    prependRows(rows) {
      const incoming = dedupeTraceRows(rows).filter((row) => !isBatchChild(row));
      if (!incoming.length)
        return;
      if (this.canIncrementallyPrepend(incoming)) {
        this.prependUniqueRows(incoming);
        return;
      }
      this.lastMutation = "rebuild";
      this.setRows(incoming, "prepend");
    }
    replaceRows(rows, nextCursor = this.nextCursor) {
      this.nextCursor = nextCursor;
      this.lastRequestedCursor = null;
      this.fetching = false;
      this.rows = mergeTraceRows([], rows, {
        direction: "append",
        maxRows: MAX_RETAINED_ROWS,
        selectedKey: currentSelectedRootKey()
      });
      this.lastMutation = "replace";
      this.refreshItems();
      this.commitItems(false);
    }
    setNextCursor(nextCursor) {
      if (nextCursor !== this.nextCursor)
        this.lastRequestedCursor = null;
      this.nextCursor = nextCursor;
      this.updateDiagnostics();
      this.maybeRequestNextPage(this.lastVisibleRootIndex());
    }
    scrollToKey(key) {
      const index = this.items.findIndex((item) => item.traceKey === key);
      if (index >= 0)
        this.virtualizer.scrollToIndex(index, { align: "auto" });
    }
    scrollToTop() {
      this.target.scroller.scrollTo({ top: 0, behavior: "smooth" });
    }
    diagnostics() {
      return {
        retained: this.rows.length,
        filtered: this.filteredRows.length,
        items: this.items.length,
        mounted: this.mountedCount,
        range: this.range,
        nextCursor: this.nextCursor,
        lastMutation: this.lastMutation
      };
    }
    select(key) {
      const target = traceWindow();
      const row = this.ownedMap.get(key) ?? [...this.ownedMap.values()].find((candidate) => stableTraceKey(candidate) === key);
      if (!row)
        return;
      inspectorStore.dispatch({ type: "select", key, row });
      target.__traceSelectedKey = key;
      const shell = document.querySelector(".trxShell");
      shell?.classList.remove("closed");
      shell?.classList.add("detail-open");
      const hash = `trace=${encodeURIComponent(key)}`;
      if (location.hash.slice(1) !== hash) {
        try {
          history.replaceState(null, "", `${location.pathname}${location.search}#${hash}`);
        } catch {
          location.hash = hash;
        }
      }
      for (const row2 of this.target.content.querySelectorAll(".trxRow")) {
        const active = row2.dataset.traceKey === key;
        row2.classList.toggle("selected", active);
        row2.setAttribute("aria-selected", String(active));
      }
      document.dispatchEvent(new CustomEvent("trace:selection-change", { detail: { key } }));
    }
    clearSelection() {
      inspectorStore.dispatch({ type: "clear-selection" });
      traceWindow().__traceSelectedKey = "";
      for (const row of this.target.content.querySelectorAll(".trxRow")) {
        row.classList.remove("selected");
        row.setAttribute("aria-selected", "false");
      }
      document.dispatchEvent(new CustomEvent("trace:selection-change", { detail: { key: "" } }));
    }
    setRows(rows, direction) {
      const previousHeight = this.target.scroller.scrollHeight;
      const previousTop = this.target.scroller.scrollTop;
      this.rows = mergeTraceRows(this.rows, rows, {
        direction,
        maxRows: MAX_RETAINED_ROWS,
        selectedKey: currentSelectedRootKey()
      });
      this.lastMutation = direction === "history" ? "history" : "rebuild";
      this.refreshItems();
      this.commitItems(false);
      if (direction === "prepend" && previousTop > 0) {
        this.target.scroller.scrollTop = previousTop + Math.max(0, this.target.scroller.scrollHeight - previousHeight);
      }
    }
    refreshItems() {
      this.visibleRows = this.rows.filter(isDefaultTraceTableRowVisible);
      this.filteredRows = this.visibleRows.filter(matchesCurrentFilters);
      this.firstFilteredPosition = 0;
      this.items = flattenTraceItems(this.filteredRows, 0);
    }
    commitItems(resetScroll) {
      this.replaceOwnedMap();
      this.virtualizer.setOptions(this.virtualizerOptions());
      this.virtualizer._willUpdate();
      this.virtualizer.measure();
      if (resetScroll)
        this.virtualizer.scrollToOffset(0);
      this.render(this.virtualizer);
    }
    replaceOwnedMap() {
      this.ownedMap = traceMapForRows(this.visibleRows);
      this.rootKeys = traceRootKeys(this.rows);
      currentFacets = traceFilterFacets(this.visibleRows);
      ensureTraceTableControls();
      renderTraceFilterPanel();
      traceWindow().__traceRowsByTraceId = this.ownedMap;
      inspectorStore.dispatch({
        type: "rows-replaced",
        rows: dedupeTraceRows(this.ownedMap.values())
      });
    }
    canIncrementallyPrepend(rows) {
      if (this.rows.length + rows.length > MAX_RETAINED_ROWS)
        return false;
      return rows.every((row) => {
        const key = stableTraceKey(row);
        return Boolean(key && !this.rootKeys.has(key));
      });
    }
    prependUniqueRows(rows) {
      const previousHeight = this.target.scroller.scrollHeight;
      const previousTop = this.target.scroller.scrollTop;
      const visibleIncoming = rows.filter(isDefaultTraceTableRowVisible);
      const matchingRows = visibleIncoming.filter(matchesCurrentFilters);
      const firstPosition = this.firstFilteredPosition - matchingRows.length;
      this.rows = [...rows, ...this.rows];
      this.visibleRows = [...visibleIncoming, ...this.visibleRows];
      this.filteredRows = [...matchingRows, ...this.filteredRows];
      this.items = [
        ...flattenTraceItems(matchingRows, firstPosition),
        ...this.items
      ];
      this.firstFilteredPosition = firstPosition;
      for (const row of rows)
        this.rootKeys.add(stableTraceKey(row));
      addTraceRowsToMap(this.ownedMap, visibleIncoming);
      currentFacets = mergeTraceFilterFacets(currentFacets, traceFilterFacets(visibleIncoming));
      ensureTraceTableControls();
      renderTraceFilterPanel();
      traceWindow().__traceRowsByTraceId = this.ownedMap;
      inspectorStore.dispatch({ type: "rows-added", rows: visibleIncoming });
      this.lastMutation = "live-incremental";
      this.virtualizer.setOptions(this.virtualizerOptions());
      this.virtualizer._willUpdate();
      this.virtualizer.measure();
      this.render(this.virtualizer);
      if (previousTop > 0) {
        this.target.scroller.scrollTop = previousTop + Math.max(0, this.target.scroller.scrollHeight - previousHeight);
      }
    }
    virtualizerOptions() {
      return {
        count: this.items.length,
        getScrollElement: () => this.target.scroller,
        estimateSize: () => ESTIMATED_ROW_HEIGHT,
        getItemKey: (index) => this.items[index]?.key ?? index,
        overscan: OVERSCAN,
        scrollMargin: this.target.content.offsetTop,
        observeElementRect,
        observeElementOffset,
        scrollToFn: elementScroll,
        onChange: (instance) => this.render(instance)
      };
    }
    render(instance) {
      const virtualItems = instance.getVirtualItems();
      const fragment = document.createDocumentFragment();
      const selectedKey = currentSelectedKey();
      const scrollMargin = instance.options.scrollMargin ?? 0;
      for (const virtualItem of virtualItems) {
        const item = this.items[virtualItem.index];
        if (!item)
          continue;
        fragment.append(createTraceRow(item, virtualItem, selectedKey, scrollMargin));
      }
      this.target.content.style.height = `${Math.max(0, Math.ceil(instance.getTotalSize() - scrollMargin))}px`;
      this.target.content.replaceChildren(fragment);
      this.mountedCount = virtualItems.length;
      const first = virtualItems.at(0)?.index;
      const last = virtualItems.at(-1)?.index;
      this.range = first === undefined || last === undefined ? "empty" : `${first}-${last}`;
      this.updateDiagnostics();
      this.updateFooter(this.firstVisibleRootIndex(virtualItems));
      this.maybeRequestNextPage(this.lastVisibleRootIndex(virtualItems));
    }
    updateDiagnostics() {
      this.target.scroller.dataset.traceRetained = String(this.rows.length);
      this.target.scroller.dataset.traceTotal = String(this.visibleRows.length);
      this.target.scroller.dataset.traceFiltered = String(this.filteredRows.length);
      this.target.scroller.dataset.traceItems = String(this.items.length);
      this.target.scroller.dataset.traceMounted = String(this.mountedCount);
      this.target.scroller.dataset.traceRange = this.range;
      this.target.scroller.dataset.traceNextCursor = this.nextCursor ?? "";
    }
    updateFooter(firstVisibleRootIndex) {
      const footer = this.target.scroller.closest(".trxTablePane")?.querySelector(".trxFooter");
      if (!footer)
        return;
      prepareTraceFooter(footer);
      footer.dataset.traceVirtualFooter = "";
      const count = footer.querySelector("[data-trace-count]");
      if (count)
        count.textContent = String(this.visibleRows.length);
      const scrollTop = footer.querySelector("[data-trace-scroll-top]");
      if (scrollTop) {
        scrollTop.hidden = firstVisibleRootIndex === null || firstVisibleRootIndex < 100;
      }
    }
    firstVisibleRootIndex(virtualItems = this.virtualizer.getVirtualItems()) {
      const scrollTop = this.target.scroller.scrollTop;
      const visible = virtualItems.find((item) => item.end > scrollTop) ?? virtualItems.at(0);
      const position = visible ? this.items[visible.index]?.rootPosition : undefined;
      return position === undefined ? null : position - this.firstFilteredPosition;
    }
    lastVisibleRootIndex(virtualItems = this.virtualizer.getVirtualItems()) {
      const itemIndex = virtualItems.at(-1)?.index;
      const position = itemIndex === undefined ? undefined : this.items[itemIndex]?.rootPosition;
      return position === undefined ? null : position - this.firstFilteredPosition;
    }
    maybeRequestNextPage(lastVirtualIndex) {
      if (this.nextCursor === this.lastRequestedCursor || !shouldPrefetchTracePage({
        lastVirtualIndex,
        rowCount: this.filteredRows.length,
        threshold: PREFETCH_THRESHOLD,
        nextCursor: this.nextCursor,
        fetching: this.fetching
      }))
        return;
      const cursor = this.nextCursor;
      if (!cursor)
        return;
      this.lastRequestedCursor = cursor;
      this.fetching = true;
      this.target.scroller.dataset.tracePrefetch = "requested";
      const event = new CustomEvent("trace:prefetch-request", {
        cancelable: true,
        detail: {
          cursor,
          rowCount: this.visibleRows.length,
          lastVirtualIndex: lastVirtualIndex ?? -1,
          accept: (rows, nextCursor) => this.appendPage(rows, nextCursor),
          fail: () => {
            this.fetching = false;
            this.lastRequestedCursor = null;
            this.target.scroller.dataset.tracePrefetch = "failed";
          }
        }
      });
      document.dispatchEvent(event);
      queueMicrotask(() => {
        if (!this.fetching)
          return;
        this.fetching = false;
        this.target.scroller.dataset.tracePrefetch = event.defaultPrevented ? "handled" : "unhandled";
      });
    }
  }
  function flattenTraceItems(rows, startRootPosition = 0) {
    const items = [];
    rows.forEach((row, index) => {
      const rootPosition = startRootPosition + index;
      const traceKey = stableTraceKey(row);
      items.push({
        key: `${traceKey}::trace`,
        traceKey,
        rootPosition,
        row,
        child: null
      });
      for (const child of childTraceRecords(row)) {
        items.push({
          key: `${traceKey}::${child.__tracePath}`,
          traceKey: stableTraceKey(child),
          rootPosition,
          row,
          child
        });
      }
    });
    return items;
  }
  function createTraceRow(item, virtualItem, selectedKey, scrollMargin) {
    const button = document.createElement("button");
    button.className = item.child ? `trxRow trxNestedRow depth-${item.child.__traceDepth}` : "trxRow";
    button.type = "button";
    button.dataset.traceKey = item.traceKey;
    button.dataset.rowKey = item.key;
    button.dataset.virtualIndex = String(virtualItem.index);
    if (item.child)
      button.dataset.operationPath = item.child.__tracePath;
    const formatted = formatTraceTableRow(item.child ?? item.row);
    button.classList.toggle("is-error", formatted.isError);
    button.setAttribute("aria-selected", String(item.traceKey === selectedKey));
    button.classList.toggle("selected", item.traceKey === selectedKey);
    button.style.transform = `translateY(${Math.round(virtualItem.start - scrollMargin)}px)`;
    if (item.child)
      appendChildCells(button, item.row, item.child);
    else
      appendRootCells(button, item.row);
    return button;
  }
  function appendRootCells(button, row) {
    const branch = clean(row.branch ?? row.taskSession) || "no-branch";
    const formatted = formatTraceTableRow(row);
    const status = formatted.statusLabel;
    const sourceTool = clean(row.name ?? row.traceName ?? row.tool) || "trace";
    button.style.setProperty("--branch-color", branchColor(branch));
    appendCell(button, "", "", (cell) => {
      const check = document.createElement("span");
      check.className = "trxCheck";
      cell.append(check);
    });
    appendCell(button, "trxStart mono", formatTraceTime(row));
    appendCell(button, "trxToolCell", "", (cell) => {
      setTraceTooltip(cell, `${formatted.toolLabel} · stored as ${sourceTool}`);
      const icon = document.createElement("span");
      icon.className = `trxToolIcon ${status}`;
      icon.textContent = "✤";
      const name = document.createElement("span");
      name.className = "trxToolName";
      name.textContent = formatted.toolLabel;
      cell.append(icon, name);
    });
    appendCell(button, "trxLatency", formatDuration(row.durationMs, row.latency));
    appendCell(button, "trxTokens", formatCompact(totalTokens(row)));
    appendCell(button, "trxBranch", stripTaskPrefix(branch), (cell) => {
      setTraceTooltip(cell, branch);
      cell.style.setProperty("--branch-color", branchColor(branch));
    });
    appendCell(button, "trxJson trxInputCell", formatted.inputLabel, (cell) => {
      setTraceTooltip(cell, formatted.inputFull || formatted.inputLabel);
    });
    appendCell(button, "trxJson trxOutputCell", formatted.outputLabel, (cell) => setTraceTooltip(cell, formatted.outputFull || formatted.outputLabel));
    appendCell(button, "trxJson trxTraceCell", itemTraceId(row));
    appendCell(button, "", "", (cell) => {
      const badge = document.createElement("span");
      badge.className = `trxStatus ${status}`;
      badge.textContent = status;
      cell.append(badge);
    });
    appendCell(button, "trxCost", clean(row.costLabel) || `$${number(row.cost).toFixed(4)}`);
  }
  function appendChildCells(button, parent, child) {
    const branch = clean(parent.branch ?? parent.taskSession) || "no-branch";
    const formatted = formatTraceTableRow(child);
    const status = formatted.statusLabel;
    const sourceTool = clean(child.tool ?? child.name ?? child.label) || "child";
    button.style.setProperty("--depth", String(child.__traceDepth));
    button.style.setProperty("--branch-color", branchColor(branch));
    appendCell(button, "trxTreeCell", "");
    appendCell(button, "trxStart mono", "");
    appendCell(button, "trxToolCell trxNestedToolCell", "", (cell) => {
      const connector = document.createElement("span");
      connector.className = "trxNestedConnector";
      connector.setAttribute("aria-hidden", "true");
      connector.textContent = "->";
      const name = document.createElement("span");
      name.className = "trxToolName";
      name.textContent = formatted.toolLabel;
      setTraceTooltip(cell, `${formatted.toolLabel} · batch step stored as ${sourceTool}`);
      cell.append(connector, name);
    });
    appendCell(button, "trxLatency", formatDuration(child.durationMs, child.latency));
    appendCell(button, "trxTokens", formatCompact(totalTokens(child)));
    appendCell(button, "trxBranch", stripTaskPrefix(branch));
    appendCell(button, "trxJson trxInputCell", formatted.inputLabel, (cell) => {
      setTraceTooltip(cell, formatted.inputFull || formatted.inputLabel);
    });
    appendCell(button, "trxJson trxOutputCell", formatted.outputLabel, (cell) => setTraceTooltip(cell, formatted.outputFull || formatted.outputLabel));
    appendCell(button, "trxJson trxTraceCell", clean(child.traceId));
    appendCell(button, "", "", (cell) => {
      const badge = document.createElement("span");
      badge.className = `trxStatus ${status}`;
      badge.textContent = status;
      cell.append(badge);
    });
    appendCell(button, "trxCost", clean(child.costLabel) || "—");
  }
  function appendCell(row, className, text, decorate) {
    const cell = document.createElement("div");
    if (className)
      cell.className = className;
    if (text)
      cell.textContent = text;
    decorate?.(cell);
    row.append(cell);
  }
  function setTraceTooltip(cell, value) {
    const text = value.trim();
    if (!text)
      return;
    cell.dataset.traceTooltip = text;
  }
  function ensureTraceTableControls() {
    if (!fontPreferenceInitialized) {
      document.documentElement.classList.add("trace-system-font");
      fontPreferenceInitialized = true;
    }
    const pane = document.querySelector(".trxTablePane");
    if (!pane)
      return;
    let panel = pane.querySelector(".trxFilterPanel");
    if (!panel) {
      panel = document.createElement("aside");
      panel.className = "trxFilterPanel";
      panel.setAttribute("aria-label", "Trace filters");
      panel.innerHTML = `<header class="trxFilterHeader"><div><span>Filters</span><strong>Trace view</strong></div><div class="trxFilterHeaderActions"><button type="button" data-trace-font-toggle aria-label="Use original trace font" aria-pressed="true">Aa</button><button type="button" data-trace-filter-close aria-label="Close filters">×</button></div></header><label class="trxFilterSearch"><span aria-hidden="true"><svg viewBox="0 0 16 16" width="13" height="13"><circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" stroke-width="1.5"></circle><path d="m10.2 10.2 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg></span><input type="search" data-filter-search placeholder="Search filter values" aria-label="Search filter values"></label><div class="trxFilterContent" data-trace-filter-content></div><footer><button type="button" data-clear-filters>Clear filters</button></footer>`;
      pane.append(panel);
    }
    panel.hidden = !filterPanelOpen;
    pane.classList.toggle("trace-filters-open", filterPanelOpen);
    const fontButton = panel.querySelector("[data-trace-font-toggle]");
    if (fontButton) {
      const systemFont = document.documentElement.classList.contains("trace-system-font");
      fontButton.setAttribute("aria-pressed", String(systemFont));
      fontButton.setAttribute("aria-label", systemFont ? "Use original trace font" : "Use system font");
      fontButton.title = fontButton.getAttribute("aria-label") ?? "";
    }
  }
  function renderTraceFilterPanel() {
    const panel = document.querySelector(".trxFilterPanel");
    const content = panel?.querySelector("[data-trace-filter-content]");
    if (!panel || !content)
      return;
    const fragment = document.createDocumentFragment();
    fragment.append(createFilterSection("tools", "Tools", currentFacets.tools), createFilterSection("branches", "Branches", currentFacets.branches), createFilterSection("statuses", "Status", currentFacets.statuses));
    content.replaceChildren(fragment);
    const input = panel.querySelector("[data-filter-search]");
    if (input && input.value !== filterSearch)
      input.value = filterSearch;
  }
  function createFilterSection(kind, title, facets) {
    const section = document.createElement("section");
    section.className = "trxFilterSection";
    section.dataset.filterSection = kind;
    const heading = document.createElement("h3");
    heading.textContent = title;
    section.append(heading);
    const query = filterSearch.trim().toLowerCase();
    const matching = query ? facets.filter((facet) => facet.value.toLowerCase().includes(query)) : facets;
    const expanded = expandedFilterKinds.has(kind) || Boolean(query);
    const visible = expanded ? matching : matching.slice(0, FILTER_PREVIEW_COUNT);
    const selected = filterSet(kind);
    const allSelected = selected.size === 0;
    const list = document.createElement("div");
    list.className = "trxFilterValues";
    for (const facet of visible) {
      const row = document.createElement("div");
      row.className = "trxFilterValue";
      row.dataset.traceFilterValue = facet.value;
      row.dataset.traceFilterKind = kind;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.tabIndex = -1;
      checkbox.checked = allSelected || selected.has(facet.value);
      checkbox.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = facet.value;
      const count = document.createElement("small");
      count.textContent = String(facet.count);
      const only = document.createElement("button");
      only.type = "button";
      only.textContent = "Only";
      only.dataset.traceFilterOnly = facet.value;
      only.dataset.traceFilterKind = kind;
      only.setAttribute("aria-label", `Only show ${facet.value}`);
      row.append(checkbox, label, only, count);
      list.append(row);
    }
    section.append(list);
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "trxFilterEmpty";
      empty.textContent = "No matching values";
      section.append(empty);
    }
    if (!query && matching.length > FILTER_PREVIEW_COUNT) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "trxFilterMore";
      more.dataset.traceFilterMore = kind;
      more.textContent = expanded ? "Show fewer" : `Show ${matching.length - FILTER_PREVIEW_COUNT} more`;
      section.append(more);
    }
    return section;
  }
  function filterSet(kind) {
    return filters[kind];
  }
  function toggleFilterValue(kind, value) {
    const selected = filterSet(kind);
    const available = currentFacets[kind].map((facet) => facet.value);
    if (selected.size === 0) {
      for (const facetValue of available)
        selected.add(facetValue);
      selected.delete(value);
    } else if (selected.has(NO_FILTER_MATCH)) {
      selected.clear();
      selected.add(value);
    } else if (selected.has(value)) {
      selected.delete(value);
    } else {
      selected.add(value);
    }
    if (selected.size === 0)
      selected.add(NO_FILTER_MATCH);
    if (available.length && available.every((facetValue) => selected.has(facetValue))) {
      selected.clear();
    }
  }
  function showOnlyFilterValue(kind, value) {
    const selected = filterSet(kind);
    selected.clear();
    selected.add(value);
  }
  function matchesCurrentFilters(row) {
    return matchesTraceTableFilters(row, filters);
  }
  function formatCompact(value) {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed))
      return "0";
    if (Math.abs(parsed) >= 1e6)
      return `${(parsed / 1e6).toFixed(2)}M`;
    if (Math.abs(parsed) >= 1000)
      return `${(parsed / 1000).toFixed(1)}K`;
    return String(Math.round(parsed));
  }
  function formatTraceTime(row) {
    const raw = clean(row.displayTime ?? row.time ?? row.startTime);
    if (!raw)
      return "—";
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw))
      return raw;
    if (/^\d{2}:\d{2}$/.test(raw))
      return `${raw}:00`;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()))
      return raw;
    const parts = TRACE_TIME_FORMATTER.formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value ?? "--";
    const minute = parts.find((part) => part.type === "minute")?.value ?? "--";
    const second = parts.find((part) => part.type === "second")?.value ?? "--";
    return `${hour === "24" ? "00" : hour}:${minute}:${second}`;
  }
  function formatDuration(value, fallback) {
    const duration = Number(value ?? Number.NaN);
    if (!Number.isFinite(duration))
      return clean(fallback) || "—";
    if (duration >= 60000)
      return `${(duration / 60000).toFixed(1)}m`;
    if (duration >= 1000)
      return `${(duration / 1000).toFixed(2)}s`;
    return `${Math.round(duration)}ms`;
  }
  function itemTraceId(row) {
    return clean(row.traceId ?? row.trace ?? stableTraceKey(row));
  }
  function stripTaskPrefix(value) {
    return value.replace(/^task\//, "");
  }
  function branchColor(value) {
    if (!value || value === "no-branch")
      return "";
    const palette = ["#c87958", "#b88b4a", "#8fa17a", "#b06f8f", "#7f9b9a"];
    let hash = 0;
    for (const character of value)
      hash = hash * 31 + character.charCodeAt(0) >>> 0;
    return palette[hash % palette.length] ?? palette[0];
  }
  function traceWindow() {
    return window;
  }
  function currentSelectedKey() {
    return inspectorStore.getSnapshot().selectedKey;
  }
  function prepareTraceFooter(footer) {
    if (footer.dataset.traceFooterPrepared === "true")
      return;
    footer.replaceChildren();
    const filtersButton = document.createElement("button");
    filtersButton.type = "button";
    filtersButton.dataset.showFilters = "";
    filtersButton.textContent = "filters";
    const count = document.createElement("span");
    count.className = "trxTraceTotal";
    const value = document.createElement("b");
    value.dataset.traceCount = "";
    value.textContent = "0";
    count.append(value, " traces");
    const scrollTop = document.createElement("button");
    scrollTop.type = "button";
    scrollTop.dataset.traceScrollTop = "";
    scrollTop.textContent = "Scroll to top";
    scrollTop.setAttribute("aria-label", "Scroll trace history to top");
    scrollTop.hidden = true;
    footer.append(filtersButton, count, scrollTop);
    footer.dataset.traceFooterPrepared = "true";
  }
  function currentSelectedRootKey() {
    const key = currentSelectedKey();
    if (!key)
      return "";
    const selected = traceWindow().__traceRowsByTraceId?.get(key);
    return selected ? traceParentKey(selected) : key;
  }
  function initialRows() {
    const map = traceWindow().__traceRowsByTraceId;
    if (map instanceof Map)
      return dedupeTraceRows(map.values()).filter((row) => !isBatchChild(row));
    return dedupeTraceRows(seedPayload().rows ?? []);
  }
  function initialCursor(rows) {
    const meta = seedPayload().meta;
    if (meta && Object.hasOwn(meta, "nextCursor")) {
      const value = meta.nextCursor;
      return deriveTraceHistoryCursor(rows, typeof value === "string" ? value : null);
    }
    return deriveTraceHistoryCursor(rows);
  }
  function seedPayload() {
    const seed = document.getElementById("trace-seed-data");
    if (!seed?.textContent)
      return {};
    try {
      return JSON.parse(seed.textContent);
    } catch {
      return {};
    }
  }
  function traceMapForRows(rows) {
    const map = new Map;
    addTraceRowsToMap(map, rows);
    return map;
  }
  function addTraceRowsToMap(map, rows) {
    for (const row of rows) {
      const stableKey = stableTraceKey(row);
      if (stableKey)
        map.set(stableKey, row);
      const traceId = clean(row.traceId ?? row.trace);
      if (traceId)
        map.set(traceId, row);
      for (const child of childTraceRecords(row)) {
        const childKey = stableTraceKey(child);
        if (childKey)
          map.set(childKey, child);
        const childTraceId = clean(child.traceId ?? child.trace);
        if (childTraceId && !map.has(childTraceId))
          map.set(childTraceId, child);
      }
    }
  }
  function traceRootKeys(rows) {
    return new Set([...rows].map(stableTraceKey).filter((key) => Boolean(key)));
  }
  function mergeTraceFilterFacets(current, incoming) {
    return {
      tools: mergeFacetList(current.tools, incoming.tools),
      branches: mergeFacetList(current.branches, incoming.branches),
      statuses: mergeFacetList(current.statuses, incoming.statuses)
    };
  }
  function mergeFacetList(current, incoming) {
    const counts = new Map(current.map(({ value, count }) => [value, count]));
    for (const { value, count } of incoming) {
      counts.set(value, (counts.get(value) ?? 0) + count);
    }
    return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  function findTraceListTarget() {
    const explicit = document.querySelector("[data-trace-virtual-list]");
    if (explicit) {
      let content2 = explicit.querySelector("[data-trace-virtual-content]");
      if (!content2) {
        content2 = document.createElement("div");
        explicit.append(content2);
      }
      return { scroller: explicit, content: content2 };
    }
    const content = document.querySelector("[data-trace-rows]");
    const scroller = content?.closest(".trxTableScroll");
    return content && scroller ? { scroller, content } : null;
  }
  function resetFilters() {
    filters.query = "";
    filters.branches.clear();
    filters.tools.clear();
    filters.statuses.clear();
    filterSearch = "";
    expandedFilterKinds.clear();
    for (const input of document.querySelectorAll("[data-search], [data-filter-search]")) {
      input.value = "";
    }
  }
  function filterKind(value) {
    return value === "tools" || value === "branches" || value === "statuses" ? value : null;
  }
  function ensureTraceHoverCard() {
    let card = document.querySelector(".trxHoverCard");
    if (card)
      return card;
    card = document.createElement("div");
    card.className = "trxHoverCard";
    card.id = "trace-hover-detail";
    card.setAttribute("role", "tooltip");
    card.hidden = true;
    document.body.append(card);
    return card;
  }
  function showTraceHoverCard(target) {
    const text = target.dataset.traceTooltip;
    if (!text)
      return;
    const card = ensureTraceHoverCard();
    card.textContent = text;
    hoverTarget = target;
    target.setAttribute("aria-describedby", card.id);
    card.hidden = false;
    const rect = target.getBoundingClientRect();
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - card.offsetWidth - 12));
    const below = rect.bottom + 8;
    const top = below + card.offsetHeight < window.innerHeight - 12 ? below : Math.max(12, rect.top - card.offsetHeight - 8);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }
  function hideTraceHoverCard() {
    const card = document.querySelector(".trxHoverCard");
    if (card)
      card.hidden = true;
    hoverTarget?.removeAttribute("aria-describedby");
    hoverTarget = null;
  }
  function scheduleTraceHoverOpen(target) {
    window.clearTimeout(hoverOpenTimer);
    window.clearTimeout(hoverCloseTimer);
    if (hoverTarget === target && !ensureTraceHoverCard().hidden)
      return;
    hoverOpenTimer = window.setTimeout(() => showTraceHoverCard(target), 1000);
  }
  function scheduleTraceHoverClose() {
    window.clearTimeout(hoverOpenTimer);
    window.clearTimeout(hoverCloseTimer);
    hoverCloseTimer = window.setTimeout(hideTraceHoverCard, 180);
  }
  function installTraceVirtualList() {
    let controller = null;
    let pendingReplacement = null;
    let scheduled = false;
    const sync = () => {
      scheduled = false;
      const target = findTraceListTarget();
      if (!target)
        return;
      if (!controller?.isMountedOn(target)) {
        controller?.destroy();
        const rows = initialRows();
        controller = new TraceVirtualListController(target, rows, initialCursor(rows));
      } else {
        controller.reassertOwnership();
      }
      if (pendingReplacement) {
        controller.replaceRows(pendingReplacement.rows, pendingReplacement.nextCursor);
        pendingReplacement = null;
      }
    };
    const scheduleSync = () => {
      if (scheduled)
        return;
      scheduled = true;
      requestAnimationFrame(sync);
    };
    const observer = new MutationObserver(scheduleSync);
    const observerRoot = document.querySelector(".trxShell, #tbmLiveTraceModal") ?? document.documentElement;
    observer.observe(observerRoot, {
      childList: true,
      subtree: true
    });
    const handlePointerOver = (event) => {
      if (event.target.closest(".trxHoverCard")) {
        window.clearTimeout(hoverCloseTimer);
        return;
      }
      const target = event.target.closest("[data-trace-tooltip]");
      if (target)
        scheduleTraceHoverOpen(target);
    };
    const handlePointerOut = (event) => {
      const card = event.target.closest(".trxHoverCard");
      if (card) {
        const related2 = event.relatedTarget;
        if (related2 instanceof Node && card.contains(related2))
          return;
        scheduleTraceHoverClose();
        return;
      }
      const target = event.target.closest("[data-trace-tooltip]");
      if (!target)
        return;
      const related = event.relatedTarget;
      if (related instanceof Node && target.contains(related))
        return;
      if (related instanceof Element && related.closest(".trxHoverCard"))
        return;
      scheduleTraceHoverClose();
    };
    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement))
        return;
      if (target.matches("[data-filter-search]")) {
        filterSearch = target.value;
        renderTraceFilterPanel();
        return;
      }
      if (!target.matches("[data-search]"))
        return;
      filters.query = target.value.trim().toLowerCase();
      controller?.syncFilters();
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("[data-show-filters], [data-trace-filter-toggle]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        filterPanelOpen = !filterPanelOpen;
        ensureTraceTableControls();
        renderTraceFilterPanel();
        return;
      }
      if (target.closest("[data-trace-filter-close]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        filterPanelOpen = false;
        ensureTraceTableControls();
        return;
      }
      if (target.closest("[data-trace-font-toggle]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        document.documentElement.classList.toggle("trace-system-font");
        ensureTraceTableControls();
        return;
      }
      const only = target.closest("[data-trace-filter-only]");
      const filterValue = target.closest("[data-trace-filter-value]");
      const more = target.closest("[data-trace-filter-more]");
      if (only) {
        const kind = filterKind(only.dataset.traceFilterKind);
        const value = only.dataset.traceFilterOnly;
        if (kind && value)
          showOnlyFilterValue(kind, value);
        event.preventDefault();
        event.stopImmediatePropagation();
        renderTraceFilterPanel();
        controller?.syncFilters();
        return;
      }
      if (filterValue) {
        const kind = filterKind(filterValue.dataset.traceFilterKind);
        const value = filterValue.dataset.traceFilterValue;
        if (kind && value)
          toggleFilterValue(kind, value);
        event.preventDefault();
        event.stopImmediatePropagation();
        renderTraceFilterPanel();
        controller?.syncFilters();
        return;
      }
      if (more) {
        const kind = filterKind(more.dataset.traceFilterMore);
        if (kind) {
          if (expandedFilterKinds.has(kind))
            expandedFilterKinds.delete(kind);
          else
            expandedFilterKinds.add(kind);
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        renderTraceFilterPanel();
        return;
      }
      const branch = target.closest("[data-filter-branch]");
      const tool = target.closest("[data-filter-tool]");
      const status = target.closest("[data-filter-status]");
      if (branch?.dataset.filterBranch)
        showOnlyFilterValue("branches", branch.dataset.filterBranch);
      if (tool?.dataset.filterTool)
        showOnlyFilterValue("tools", tool.dataset.filterTool);
      if (status?.dataset.filterStatus)
        showOnlyFilterValue("statuses", status.dataset.filterStatus);
      if (target.closest("[data-clear-filters], [data-cockpit-page]")) {
        resetFilters();
        renderTraceFilterPanel();
      }
      if (target.closest("[data-trace-scroll-top]")) {
        event.preventDefault();
        controller?.scrollToTop();
        return;
      }
      if (branch || tool || status || target.closest("[data-clear-filters]")) {
        queueMicrotask(() => controller?.syncFilters());
      }
      const row = target.closest(".trxRow");
      if (row?.dataset.traceKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        controller?.select(row.dataset.traceKey);
        return;
      }
      if (target.closest("[data-ti-back]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        inspectorStore.dispatch({ type: "close" });
        return;
      }
    }, true);
    traceWindow().__traceVirtualList = {
      appendPage: (rows, nextCursor) => controller?.appendPage(rows, nextCursor),
      prependRows: (rows) => controller?.prependRows(rows),
      replaceRows: (rows, nextCursor) => {
        if (controller)
          controller.replaceRows(rows, nextCursor);
        else
          pendingReplacement = { rows, nextCursor };
      },
      setNextCursor: (nextCursor) => controller?.setNextCursor(nextCursor),
      scrollToKey: (key) => controller?.scrollToKey(key),
      scrollToTop: () => controller?.scrollToTop(),
      select: (key) => controller?.select(key),
      diagnostics: () => controller?.diagnostics() ?? null
    };
    const interval = window.setInterval(scheduleSync, 2000);
    scheduleSync();
    return () => {
      window.clearInterval(interval);
      observer.disconnect();
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.querySelector(".trxHoverCard")?.remove();
      controller?.destroy();
      delete traceWindow().__traceVirtualList;
    };
  }

  // scripts/lib/trace-site-inspector/browser.ts
  var rendering = false;
  var scheduled = false;
  var callSearchFrame = 0;
  var liveCursor = "";
  var livePollInFlight = false;
  var livePollTimer = 0;
  var INSPECTOR_WIDTH_KEY = "consuelo.trace-inspector.width";
  var TRACE_CLOCK_FORMATTER = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function formatCompact2(value) {
    const number2 = Number(value ?? 0);
    if (!Number.isFinite(number2))
      return "0";
    if (Math.abs(number2) >= 1e6)
      return `${(number2 / 1e6).toFixed(2)}M`;
    if (Math.abs(number2) >= 1000)
      return `${(number2 / 1000).toFixed(1)}K`;
    return String(Math.round(number2));
  }
  function formatDuration2(value) {
    const duration = Number(value ?? 0);
    if (!Number.isFinite(duration))
      return "—";
    if (duration >= 60000)
      return `${(duration / 60000).toFixed(1)}m`;
    if (duration >= 1000)
      return `${(duration / 1000).toFixed(2)}s`;
    return `${Math.round(duration)}ms`;
  }
  function updateTraceClock() {
    const node = document.querySelector("[data-trace-clock]");
    if (!node)
      return;
    const parts = TRACE_CLOCK_FORMATTER.formatToParts(new Date);
    const hour = parts.find((part) => part.type === "hour")?.value ?? "--";
    const minute = parts.find((part) => part.type === "minute")?.value ?? "--";
    node.textContent = `${hour === "24" ? "00" : hour}:${minute}`;
  }
  function installTraceClock() {
    updateTraceClock();
    window.setInterval(updateTraceClock, 15000);
  }
  function traceMap() {
    const current = window.__traceRowsByTraceId;
    if (current instanceof Map)
      return current;
    const fallback = new Map;
    const seed = document.getElementById("trace-seed-data");
    if (seed?.textContent) {
      try {
        const payload = JSON.parse(seed.textContent);
        for (const row of payload.rows ?? []) {
          addRowToMap(fallback, row);
          for (const child of childTraceRecords(row))
            addRowToMap(fallback, child);
        }
      } catch {}
    }
    return fallback;
  }
  function addRowToMap(map, row) {
    const key = stableTraceKey(row);
    if (key)
      map.set(key, row);
    const traceId = clean(row.traceId ?? row.trace);
    if (traceId && !map.has(traceId))
      map.set(traceId, row);
  }
  function allRows() {
    return dedupeTraceRows(traceMap().values()).filter((row) => !isBatchChild(row));
  }
  function resetInitialTraceSurface() {
    const target = window;
    target.__traceSelectedKey = "";
    const traceSurface = document.getElementById("tbmLiveTraceModal");
    traceSurface?.style.setProperty("display", "block", "important");
    traceSurface?.setAttribute("aria-hidden", "false");
    document.querySelector(":scope > body > .screen")?.remove();
    document.querySelector(".trxShell > .trxToolbar")?.remove();
    for (const row of document.querySelectorAll('.trxRow.selected, .trxRow.isSelected, .trxRow[aria-selected="true"], .lfStep.active')) {
      row.classList.remove("selected", "isSelected", "active");
      row.setAttribute("aria-selected", "false");
    }
    if (new URLSearchParams(location.hash.slice(1)).has("trace")) {
      try {
        history.replaceState(null, "", `${location.pathname}${location.search}`);
      } catch {
        location.hash = "";
      }
    }
  }
  function syncRowsFromMap() {
    inspectorStore.dispatch({
      type: "rows-replaced",
      rows: dedupeTraceRows(traceMap().values())
    });
  }
  function rowSummary(row) {
    return clean(row.summary ?? row.output ?? row.input) || "No summary recorded for this trace.";
  }
  function statusLabel(row) {
    return isFailure(row) ? "error" : clean(row.status) || "success";
  }
  function fact(label, value) {
    return `<div class="tiFact"><span>${escapeHtml(label)}</span><b>${escapeHtml(value ?? "—")}</b></div>`;
  }
  function flattenValue(value, path = "", depth = 0, output = []) {
    if (output.length >= 300)
      return output;
    const parsed = typeof value === "string" ? parseMaybeJson(value) : value;
    if (Array.isArray(parsed)) {
      if (!parsed.length)
        output.push({ path: path || "value", value: [], depth });
      for (const [index, item] of parsed.entries())
        flattenValue(item, path ? `${path}.${index}` : String(index), depth + 1, output);
      return output;
    }
    if (parsed && typeof parsed === "object") {
      const entries = Object.entries(parsed);
      if (!entries.length)
        output.push({ path: path || "value", value: {}, depth });
      for (const [key, item] of entries)
        flattenValue(item, path ? `${path}.${key}` : key, depth + 1, output);
      return output;
    }
    output.push({ path: path || "value", value: parsed, depth });
    return output;
  }
  function valueType(value) {
    if (value === null || value === undefined)
      return "null";
    if (typeof value === "boolean")
      return "boolean";
    if (typeof value === "number")
      return "number";
    return "string";
  }
  function valueMarkup(value) {
    if (value === null || value === undefined)
      return '<em class="tiValue tiValue-null">null</em>';
    if (Array.isArray(value))
      return '<em class="tiValue tiValue-null">empty array</em>';
    if (typeof value === "object")
      return '<em class="tiValue tiValue-null">empty object</em>';
    const valueText2 = String(value);
    const className = `tiValue tiValue-${valueType(value)}`;
    return valueText2.includes(`
`) || valueText2.length > 180 ? `<pre class="${className}">${escapeHtml(valueText2)}</pre>` : `<code class="${className}">${escapeHtml(valueText2)}</code>`;
  }
  function structuredTable(value) {
    const rows = flattenValue(value);
    if (!rows.length)
      return '<p class="tiEmptyValue">No value recorded.</p>';
    return `<div class="tiDataTable"><div class="tiDataHead"><span>Path</span><span>Value</span></div>
    ${rows.map((entry) => `<div class="tiDataRow">
          <code class="tiDataPath" style="--ti-depth:${entry.depth}">${escapeHtml(entry.path)}</code>
          <div class="tiDataValue">${valueMarkup(entry.value)}</div>
        </div>`).join("")}
    ${rows.length >= 300 ? '<p class="tiDataLimit">Preview limited to 300 values.</p>' : ""}
  </div>`;
  }
  function sectionMarkup(section) {
    const emptyError = section.id === "error" && section.value === null;
    return `<section class="tiSection tone-${section.tone}" data-ti-section="${section.id}">
    <header><h3>${escapeHtml(section.title)}</h3><button type="button" data-ti-copy aria-label="Copy ${escapeHtml(section.title)}">Copy</button></header>
    <div class="tiSectionBody">${emptyError ? '<p class="tiEmptyValue">No error recorded.</p>' : structuredTable(section.value)}</div>
  </section>`;
  }
  function summaryMarkup(row, branch) {
    const failed = isFailure(row);
    const insight = failed ? extractTraceError(row) : null;
    return `<section class="tiSummaryHero ${failed ? "is-error" : ""}">
    <div>
      <span class="tiSummaryStatus">${escapeHtml(failed ? "Actionable failure" : "Completed")}</span>
      <h2>${escapeHtml(row.name ?? row.traceName ?? row.tool ?? "trace")}</h2>
      <p>${escapeHtml(insight?.detail || rowSummary(row))}</p>
    </div>
    <section class="tiFactsGrid" aria-label="Selected call metrics">
      ${fact("Status", statusLabel(row))}
      ${fact("Code", clean(row.code) || "OK")}
      ${fact("Latency", clean(row.latency) || formatDuration2(row.durationMs))}
      ${fact("Tokens", formatCompact2(totalTokens(row)))}
      ${fact("Branch calls", branch.calls)}
      ${fact("Failures", branch.failures)}
    </section>
  </section>`;
  }
  function jsonMarkup(row) {
    let value = "";
    try {
      value = JSON.stringify(row, null, 2);
    } catch {
      value = String(row);
    }
    return `<section class="tiSection tiJsonSection" data-ti-section="json">
    <header><h3>Raw trace JSON</h3><button type="button" data-ti-copy>Copy</button></header>
    <div class="tiSectionBody"><pre class="tiRawJson">${escapeHtml(value)}</pre></div>
  </section>`;
  }
  function workpadMarkup(row) {
    return `<section class="tiSection tiWorkpadSection tone-success" data-ti-section="workpad">
    <header><h3>Workpad</h3><button type="button" data-ti-copy aria-label="Copy workpad">Copy</button></header>
    <div class="tiSectionBody"><pre class="tiWorkpadValue">${escapeHtml(workpadTraceValue(row))}</pre></div>
  </section>`;
  }
  function peerTime(row) {
    const value = clean(row.displayTime ?? row.time ?? row.startTime);
    if (!value)
      return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value.slice(-15) : date.toLocaleTimeString([], { hour12: false });
  }
  function branchPeers(branch, selected, query) {
    const selectedId = stableTraceKey(selected);
    const calls = branch.peers.flatMap((peer) => [
      peer,
      ...childTraceRecords(peer)
    ]);
    const filtered = filterInspectorCalls(calls, query);
    if (!filtered.length)
      return '<div class="tiEmptyCompact">No calls match this search.</div>';
    return filtered.map((peer) => {
      const key = stableTraceKey(peer);
      const status = statusLabel(peer);
      const child = isBatchChild(peer);
      const formatted = formatTraceTableRow(peer);
      return `<button class="tiPeer ${child ? "tiPeerChild" : ""} ${key === selectedId ? "active" : ""}" type="button" data-trace-key="${escapeHtml(key)}">
        <span class="tiPeerStatus ${status === "error" ? "error" : "success"}" aria-label="${escapeHtml(status)}"></span>
        <span class="tiPeerMain"><b>${escapeHtml(formatted.toolLabel)}</b><small>${escapeHtml(peerTime(peer))}</small></span>
        <span class="tiPeerTokens">${escapeHtml(formatCompact2(totalTokens(peer)))} tok</span>
        <span class="tiPeerDuration">${escapeHtml(clean(peer.latency) || formatDuration2(peer.durationMs))}</span>
      </button>`;
    }).join("");
  }
  function branchPeersSignature(branch, selected, query) {
    return [
      stableTraceKey(selected),
      query,
      ...branch.peers.flatMap((peer) => [
        stableTraceKey(peer),
        peer.status,
        peer.code,
        peer.durationMs,
        totalTokens(peer),
        ...childTraceRecords(peer).flatMap((child) => [
          stableTraceKey(child),
          child.status,
          child.code,
          child.durationMs,
          totalTokens(child)
        ])
      ])
    ].join(":");
  }
  function headerMetricsMarkup(branch) {
    const breadcrumb = normalizeBranchBreadcrumb(branch.branch);
    const metric = (label, value) => `<span class="tiHeaderMetric"><small>${escapeHtml(label)}</small><b>${escapeHtml(value)}</b></span>`;
    return [
      metric("Branch", breadcrumb.label),
      metric("Total", `${formatCompact2(branch.totalTokens)} tok`),
      metric("Input", formatCompact2(branch.inputTokens)),
      metric("Output", formatCompact2(branch.outputTokens)),
      metric("Failures", String(branch.failures)),
      metric("Call time", formatDuration2(branch.durationMs))
    ].join("");
  }
  function headerMetricsSignature(branch) {
    return [
      branch.branch,
      branch.totalTokens,
      branch.inputTokens,
      branch.outputTokens,
      branch.failures,
      branch.durationMs
    ].join(":");
  }
  function searchIconMarkup() {
    return '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" stroke-width="1.5"></circle><path d="m10.2 10.2 3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>';
  }
  function selectedContentMarkup(row, branch) {
    const state = inspectorStore.getSnapshot();
    if (state.displayMode === "json")
      return jsonMarkup(row);
    if (state.displayMode === "workpad")
      return workpadMarkup(row);
    return `${summaryMarkup(row, branch)}${inspectorSections(row).map(sectionMarkup).join("")}`;
  }
  function selectedContentSignature(row) {
    return inspectorContentSignature(row, inspectorStore.getSnapshot().displayMode);
  }
  function inspectorMarkup(row) {
    const state = inspectorStore.getSnapshot();
    const key = stableTraceKey(row);
    const branch = branchSummary(allRows(), row);
    const content = selectedContentMarkup(row, branch);
    const workpad = isWorkpadTrace(row);
    return `<div class="tiInspector ${state.callRailCollapsed ? "is-call-rail-collapsed" : ""}" data-ti-trace-key="${escapeHtml(key)}" data-ti-display-mode="${state.displayMode}">
    <header class="tiToolbar">
      <div class="tiToolbarIdentity">
        <div class="tiHeaderMetrics" aria-label="Branch metrics" data-ti-metrics-signature="${escapeHtml(headerMetricsSignature(branch))}">${headerMetricsMarkup(branch)}</div>
        <div class="tiSelectedMeta"><strong>${escapeHtml(row.name ?? row.traceName ?? row.tool ?? "trace")}</strong><span class="tiStatusDot ${statusLabel(row)}"></span><span>${escapeHtml(statusLabel(row))}</span><span>${escapeHtml(clean(row.latency) || formatDuration2(row.durationMs))}</span><span>${escapeHtml(formatCompact2(totalTokens(row)))} tok</span></div>
      </div>
      <div class="tiToolbarActions">
        <div class="tiModeSwitch" role="group" aria-label="Trace display mode">
          <button type="button" data-ti-mode="formatted" class="${state.displayMode === "formatted" ? "active" : ""}">Formatted</button>
          <button type="button" data-ti-mode="json" class="${state.displayMode === "json" ? "active" : ""}">JSON</button>
          ${workpad ? `<button type="button" data-ti-mode="workpad" class="${state.displayMode === "workpad" ? "active" : ""}">Workpad</button>` : ""}
        </div>
        <button type="button" class="tiIconButton" data-ti-call-rail aria-label="${state.callRailCollapsed ? "Expand tool calls" : "Collapse tool calls"}" title="${state.callRailCollapsed ? "Expand tool calls" : "Collapse tool calls"}">☰</button>
        <button type="button" class="tiIconButton" data-ti-fullscreen aria-label="${state.layout === "fullscreen" ? "Exit full screen" : "Full screen"}" title="${state.layout === "fullscreen" ? "Exit full screen" : "Full screen"}">${state.layout === "fullscreen" ? "↙" : "↗"}</button>
        <button type="button" class="tiIconButton tiCloseButton" data-ti-close aria-label="Close trace inspector" title="Close">×</button>
      </div>
    </header>
    <div class="tiInspectorBody">
      <aside class="tiSidebar" aria-label="Branch calls">
        <section class="tiCallRail">
          <label class="tiCallSearch"><span>${searchIconMarkup()}</span><input type="search" data-ti-call-search value="${escapeHtml(state.callQuery)}" placeholder="Search tool calls" aria-label="Search tool calls"></label>
          <div class="tiPeerList" aria-label="Tool calls" data-ti-peer-signature="${escapeHtml(branchPeersSignature(branch, row, state.callQuery))}">${branchPeers(branch, row, state.callQuery)}</div>
        </section>
      </aside>
      <main class="tiPreview" aria-label="Trace details">
        <div class="tiContent">${content}</div>
      </main>
    </div>
  </div>`;
  }
  function applyLayout() {
    const state = inspectorStore.getSnapshot();
    const shell = document.querySelector(".trxShell");
    const rail = document.querySelector(".trxRail");
    if (!shell || !rail)
      return;
    const body = rail.parentElement;
    const availableWidth = body?.clientWidth ?? shell.clientWidth;
    const maxWidth = Math.max(420, availableWidth - 8);
    const inspectorWidth = Math.min(state.width, maxWidth);
    const tableWidth = Math.max(0, availableWidth - inspectorWidth - 8);
    shell.style.setProperty("--ti-inspector-width", `${inspectorWidth}px`);
    const open = Boolean(state.selectedKey) && state.layout !== "collapsed";
    body?.style.setProperty("grid-template-columns", open ? `${Math.floor(tableWidth)}px 8px minmax(420px, ${inspectorWidth}px)` : "minmax(0, 1fr)", "important");
    shell.classList.toggle("ti-inspector-open", open);
    shell.classList.toggle("ti-inspector-fullscreen", open && state.layout === "fullscreen");
    shell.classList.toggle("closed", !open);
    shell.classList.toggle("detail-open", open);
    rail.setAttribute("aria-hidden", String(!open));
    ensureDivider();
  }
  function ensureDivider() {
    const rail = document.querySelector(".trxRail");
    const parent = rail?.parentElement;
    if (!rail || !parent)
      return;
    let divider = parent.querySelector(':scope > .tiDivider[data-ti-installed="true"]');
    if (!divider) {
      divider = document.createElement("button");
      divider.className = "trxResizer tiDivider";
      divider.setAttribute("type", "button");
      divider.setAttribute("aria-label", "Resize or collapse trace inspector");
      divider.setAttribute("title", "Drag to resize · click to close");
      const retiredDivider = parent.querySelector(":scope > .tiDivider, :scope > .trxResizer");
      if (retiredDivider)
        retiredDivider.replaceWith(divider);
      else
        parent.insertBefore(divider, rail);
    }
    if (divider.dataset.tiInstalled === "true")
      return;
    divider.dataset.tiInstalled = "true";
    divider.addEventListener("click", (event) => event.preventDefault());
    divider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0)
        return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = inspectorStore.getSnapshot().width;
      const availableWidth = parent.clientWidth;
      const maxWidth = Math.max(420, availableWidth - 8);
      let moved = false;
      let pendingWidth = startWidth;
      let resizeFrame = 0;
      divider?.setPointerCapture(event.pointerId);
      document.documentElement.classList.add("ti-is-resizing");
      const move = (moveEvent) => {
        const delta = startX - moveEvent.clientX;
        if (Math.abs(delta) > 4)
          moved = true;
        if (moved) {
          pendingWidth = Math.min(startWidth + delta, maxWidth);
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            inspectorStore.dispatch({ type: "resize", width: pendingWidth });
          });
        }
      };
      const up = (upEvent) => {
        divider?.releasePointerCapture(upEvent.pointerId);
        divider?.removeEventListener("pointermove", move);
        divider?.removeEventListener("pointerup", up);
        divider?.removeEventListener("pointercancel", up);
        document.documentElement.classList.remove("ti-is-resizing");
        if (!moved) {
          inspectorStore.dispatch({ type: "toggle-collapse" });
        } else {
          cancelAnimationFrame(resizeFrame);
          inspectorStore.dispatch({ type: "resize", width: pendingWidth });
          persistInspectorWidth(inspectorStore.getSnapshot().width);
        }
      };
      divider?.addEventListener("pointermove", move);
      divider?.addEventListener("pointerup", up);
      divider?.addEventListener("pointercancel", up);
    });
  }
  function persistInspectorWidth(width) {
    try {
      localStorage.setItem(INSPECTOR_WIDTH_KEY, String(Math.round(width)));
    } catch {}
  }
  function hydrateInspectorWidth() {
    try {
      const width = Number(localStorage.getItem(INSPECTOR_WIDTH_KEY));
      if (Number.isFinite(width) && width >= 420) {
        inspectorStore.dispatch({ type: "resize", width });
      }
    } catch {}
  }
  function render() {
    if (rendering)
      return;
    const inspector = document.querySelector("[data-inspector]");
    if (!inspector)
      return;
    let state = inspectorStore.getSnapshot();
    if (!state.selectedRow) {
      syncRowsFromMap();
      state = inspectorStore.getSnapshot();
      if (!state.selectedRow)
        return;
    }
    const row = state.selectedRow;
    const signature = [state.selectedKey, state.displayMode].join(":");
    const existing = inspector.querySelector(".tiInspector");
    if (existing?.dataset.tiTraceKey === state.selectedKey && existing.dataset.tiDisplayMode === state.displayMode) {
      const branch = branchSummary(allRows(), row);
      existing.classList.toggle("is-call-rail-collapsed", state.callRailCollapsed);
      const metrics = existing.querySelector(".tiHeaderMetrics");
      const metricsSignature = headerMetricsSignature(branch);
      if (metrics && metrics.dataset.tiMetricsSignature !== metricsSignature) {
        metrics.innerHTML = headerMetricsMarkup(branch);
        metrics.dataset.tiMetricsSignature = metricsSignature;
      }
      const peers = existing.querySelector(".tiPeerList");
      const peerSignature = branchPeersSignature(branch, row, state.callQuery);
      if (peers && peers.dataset.tiPeerSignature !== peerSignature) {
        peers.innerHTML = branchPeers(branch, row, state.callQuery);
        peers.dataset.tiPeerSignature = peerSignature;
      }
      const search = existing.querySelector("[data-ti-call-search]");
      if (search && document.activeElement !== search)
        search.value = state.callQuery;
      const contentSignature = selectedContentSignature(row);
      if (existing.dataset.tiContentSignature !== contentSignature) {
        const content = existing.querySelector(".tiContent");
        if (content)
          content.innerHTML = selectedContentMarkup(row, branch);
        existing.dataset.tiContentSignature = contentSignature;
      }
      const fullscreen = existing.querySelector("[data-ti-fullscreen]");
      if (fullscreen) {
        const active = state.layout === "fullscreen";
        fullscreen.textContent = active ? "↙" : "↗";
        fullscreen.title = active ? "Exit full screen" : "Full screen";
        fullscreen.setAttribute("aria-label", fullscreen.title);
      }
      const railToggle = existing.querySelector("[data-ti-call-rail]");
      if (railToggle) {
        railToggle.setAttribute("aria-label", state.callRailCollapsed ? "Expand tool calls" : "Collapse tool calls");
      }
      inspector.dataset.tiSignature = signature;
      applyLayout();
      return;
    }
    const panelScroll = inspector.querySelector(".tiPreview")?.scrollTop ?? 0;
    const callScroll = inspector.querySelector(".tiPeerList")?.scrollTop ?? 0;
    const searchFocused = document.activeElement instanceof HTMLInputElement && document.activeElement.matches("[data-ti-call-search]");
    const cursor = searchFocused && document.activeElement instanceof HTMLInputElement ? document.activeElement.selectionStart : null;
    rendering = true;
    try {
      inspector.innerHTML = inspectorMarkup(row);
      inspector.dataset.tiSignature = signature;
      const mounted = inspector.querySelector(".tiInspector");
      if (mounted)
        mounted.dataset.tiContentSignature = selectedContentSignature(row);
      const panel = inspector.querySelector(".tiPreview");
      const calls = inspector.querySelector(".tiPeerList");
      if (panel)
        panel.scrollTop = panelScroll;
      if (calls)
        calls.scrollTop = callScroll;
      if (searchFocused) {
        const input = inspector.querySelector("[data-ti-call-search]");
        input?.focus({ preventScroll: true });
        if (input && cursor !== null)
          input.setSelectionRange(cursor, cursor);
      }
    } finally {
      rendering = false;
    }
    applyLayout();
  }
  function scheduleRender() {
    if (scheduled)
      return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncRowsFromMap();
      render();
      applyLayout();
    });
  }
  async function pollLiveRows() {
    if (livePollInFlight || document.visibilityState === "hidden")
      return;
    const transport = window.__consueloTraceHistoryTransport;
    if (!transport)
      return;
    if (!liveCursor)
      liveCursor = deriveTraceLiveCursor(allRows());
    livePollInFlight = true;
    try {
      const page = parseTraceLiveResponse(await transport.fetchJson(traceLiveUrl(liveCursor)));
      if (page.rows.length) {
        window.__traceVirtualList?.prependRows(page.rows);
      }
      if (page.nextCursor)
        liveCursor = page.nextCursor;
    } catch {} finally {
      livePollInFlight = false;
    }
  }
  async function hydrateLiveSnapshot() {
    const transport = window.__consueloTraceHistoryTransport;
    if (!transport)
      return;
    try {
      const payload = await transport.fetchJson("/trace-burn-intelligence/live-traces.json");
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload.rows) ? payload.rows : Array.isArray(payload.traces) ? payload.traces : [];
      if (!rows.length)
        return;
      window.__traceVirtualList?.replaceRows(rows, deriveTraceHistoryCursor(rows));
      liveCursor = deriveTraceLiveCursor(rows);
    } catch {}
  }
  function installLivePolling() {
    const refresh = () => void pollLiveRows();
    window.clearInterval(livePollTimer);
    hydrateLiveSnapshot().finally(() => {
      if (!liveCursor)
        liveCursor = deriveTraceLiveCursor(allRows());
      livePollTimer = window.setInterval(refresh, 1000);
      window.addEventListener("focus", refresh);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible")
          refresh();
      });
      refresh();
    });
  }
  document.addEventListener("click", async (event) => {
    const target = event.target;
    const peer = target.closest(".tiPeer[data-trace-key]");
    if (peer?.dataset.traceKey) {
      event.preventDefault();
      event.stopPropagation();
      window.__traceVirtualList?.select(peer.dataset.traceKey);
      return;
    }
    const mode = target.closest("[data-ti-mode]");
    if (mode?.dataset.tiMode === "formatted" || mode?.dataset.tiMode === "json" || mode?.dataset.tiMode === "workpad") {
      event.preventDefault();
      event.stopPropagation();
      inspectorStore.dispatch({
        type: "set-display-mode",
        mode: mode.dataset.tiMode
      });
      return;
    }
    if (target.closest("[data-ti-call-rail]")) {
      event.preventDefault();
      event.stopPropagation();
      inspectorStore.dispatch({ type: "toggle-call-rail" });
      return;
    }
    if (target.closest("[data-ti-fullscreen]")) {
      event.preventDefault();
      event.stopPropagation();
      inspectorStore.dispatch({ type: "toggle-fullscreen" });
      return;
    }
    if (target.closest("[data-ti-close], [data-ti-back]")) {
      event.preventDefault();
      event.stopPropagation();
      inspectorStore.dispatch({ type: "close" });
      return;
    }
    const copy = target.closest("[data-ti-copy]");
    if (copy) {
      event.preventDefault();
      event.stopPropagation();
      const copyText = copy.closest(".tiSection")?.querySelector(".tiSectionBody")?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(copyText);
        copy.textContent = "Copied";
        window.setTimeout(() => {
          copy.textContent = "Copy";
        }, 1200);
      } catch {
        copy.textContent = "Copy failed";
      }
    }
  });
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches("[data-ti-call-search]")) {
      inspectorStore.dispatch({ type: "set-call-query", query: target.value });
      cancelAnimationFrame(callSearchFrame);
      callSearchFrame = requestAnimationFrame(render);
    }
  });
  var observer = new MutationObserver((mutations) => {
    if (rendering)
      return;
    if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-inspector] .tiInspector")))
      return;
    scheduleRender();
  });
  var observerRoot = document.querySelector(".trxShell, #tbmLiveTraceModal") ?? document.documentElement;
  observer.observe(observerRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "aria-selected"]
  });
  inspectorStore.subscribe((state) => {
    window.__traceSelectedKey = state.selectedKey;
    scheduleRender();
    applyLayout();
  });
  resetInitialTraceSurface();
  syncRowsFromMap();
  installTracePaginationTransport();
  installTraceVirtualList();
  hydrateInspectorWidth();
  installTraceClock();
  installLivePolling();
  document.addEventListener("trace:selection-change", scheduleRender);
  window.addEventListener("resize", applyLayout);
  window.setInterval(scheduleRender, 2000);
  applyLayout();
  scheduleRender();
})();
