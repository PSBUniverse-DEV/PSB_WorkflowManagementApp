/**
 * Workflow — Data Layer (client-safe utilities)
 *
 * Model helpers, batch state management, and shared orchestration
 * for the workflow configuration pages.
 */

import {
  createWorkflowAction,
  updateWorkflowAction,
  deactivateWorkflowAction,
  hardDeleteWorkflowAction,
  createWorkflowStageAction,
  updateWorkflowStageAction,
  deactivateWorkflowStageAction,
  hardDeleteWorkflowStageAction,
  saveWorkflowOrderAction,
} from "./workflow.actions.js";

// ─── ID / TEXT HELPERS ─────────────────────────────────────

export function isSameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base", numeric: true });
}

export function removeObjectKey(obj, key) {
  const k = String(key ?? "");
  const next = {};
  Object.entries(obj || {}).forEach(([k2, v]) => { if (k2 !== k) next[k2] = v; });
  return next;
}

export function mergeUpdatePatch(prev, patch) {
  const merged = { ...(prev || {}) };
  Object.entries(patch || {}).forEach(([k, v]) => { if (v !== undefined) merged[k] = v; });
  return merged;
}

export function appendUniqueId(list, value) {
  const v = String(value ?? "");
  if (!v) return Array.isArray(list) ? [...list] : [];
  const arr = Array.isArray(list) ? list : [];
  if (arr.some((e) => isSameId(e, v))) return [...arr];
  return [...arr, v];
}

// ─── BOOLEAN HELPERS ───────────────────────────────────────

export function isActiveBool(record) {
  if (record?.is_active === false || record?.is_active === 0) return false;
  const text = String(record?.is_active ?? "").trim().toLowerCase();
  return !(text === "false" || text === "0" || text === "f" || text === "n" || text === "no");
}

// ─── TEMP ID HELPERS ───────────────────────────────────────

export const EMPTY_DIALOG = { kind: null, target: null, nextIsActive: null };
export const TEMP_WORKFLOW_PREFIX = "tmp-wf-";
export const TEMP_STAGE_PREFIX = "tmp-wfs-";

export function createTempId(prefix) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isTempWorkflowId(v) { return String(v ?? "").startsWith(TEMP_WORKFLOW_PREFIX); }
export function isTempStageId(v) { return String(v ?? "").startsWith(TEMP_STAGE_PREFIX); }

export function createEmptyBatchState() {
  return {
    wfCreates: [], wfUpdates: {}, wfDeactivations: [], wfHardDeletes: [],
    stageCreates: [], stageUpdates: {}, stageDeactivations: [], stageHardDeletes: [],
  };
}

// ─── ORDER HELPERS ─────────────────────────────────────────

const ORDER_FIELD_CANDIDATES = ["display_order", "wf_order", "sort_order", "order_no", "stage_order"];

export function getDisplayOrder(record, fallback = 0) {
  const candidates = ORDER_FIELD_CANDIDATES.map((k) => record?.[k]).filter((v) => v !== undefined);
  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

export function buildOrderSignature(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => String(r?.wf_id || "")).join("|");
}

// ─── ROW MAPPERS ───────────────────────────────────────────

export function mapWorkflowRow(wf, index) {
  return {
    ...wf,
    id: wf?.wf_id ?? `wf-${index}`,
    wf_name: wf?.wf_name || "Unknown",
    wf_description: wf?.wf_description || "--",
    comp_id: wf?.comp_id ?? null,
    dept_id: wf?.dept_id ?? null,
    sectin_id: wf?.sectin_id ?? null,
    display_order: getDisplayOrder(wf, index + 1),
    is_active_bool: isActiveBool(wf),
  };
}

export function mapWorkflowStageRow(stage, index) {
  return {
    ...stage,
    id: stage?.wfs_id ?? `wfs-${index}`,
    stage_name: stage?.stage_name || "Unknown",
    stage_description: stage?.stage_description || "--",
    stage_order: getDisplayOrder(stage, index + 1),
    stagetype_id: stage?.stagetype_id ?? null,
    orgrole_id: stage?.orgrole_id ?? null,
    wf_id: stage?.wf_id ?? null,
    is_active_bool: isActiveBool(stage),
  };
}

// ─── BATCH MARKERS ─────────────────────────────────────────

export function batchMarker(batchState) {
  if (batchState === "hardDeleted") return { text: "Deleted", cls: "psb-batch-marker psb-batch-marker-deleted" };
  if (batchState === "deleted") return { text: "Deactivated", cls: "psb-batch-marker psb-batch-marker-deleted" };
  if (batchState === "created") return { text: "New", cls: "psb-batch-marker psb-batch-marker-new" };
  if (batchState === "updated") return { text: "Edited", cls: "psb-batch-marker psb-batch-marker-edited" };
  return { text: "", cls: "" };
}

// ─── BATCH SAVE ORCHESTRATION ──────────────────────────────

export async function executeWorkflowBatchSave(pendingBatch, orderedWorkflows) {
  const wfIdMap = new Map();
  const deactivatedWfSet = new Set(
    [...(pendingBatch.wfDeactivations || []), ...(pendingBatch.wfHardDeletes || [])].map((id) => String(id ?? "")),
  );
  const deactivatedStageSet = new Set(
    [...(pendingBatch.stageDeactivations || []), ...(pendingBatch.stageHardDeletes || [])].map((id) => String(id ?? "")),
  );

  for (const entry of pendingBatch.wfCreates || []) {
    const created = await createWorkflowAction(entry.payload);
    const id = created?.wf_id;
    if (id == null || id === "") throw new Error("Created workflow response is invalid.");
    wfIdMap.set(String(entry.tempId), id);
  }

  for (const [wfId, updates] of Object.entries(pendingBatch.wfUpdates || {})) {
    if (deactivatedWfSet.has(String(wfId)) || !Object.keys(updates || {}).length) continue;
    const resolved = wfIdMap.get(String(wfId)) ?? wfId;
    await updateWorkflowAction(resolved, updates);
  }

  for (const entry of pendingBatch.stageCreates || []) {
    const draftWfId = entry?.payload?.wf_id;
    const resolved = wfIdMap.get(String(draftWfId ?? "")) ?? draftWfId;
    if (!resolved || deactivatedWfSet.has(String(resolved))) continue;
    await createWorkflowStageAction({ ...entry.payload, wf_id: resolved });
  }

  for (const [stageId, updates] of Object.entries(pendingBatch.stageUpdates || {})) {
    if (deactivatedStageSet.has(String(stageId)) || !Object.keys(updates || {}).length) continue;
    await updateWorkflowStageAction(stageId, updates);
  }

  for (const stageId of pendingBatch.stageDeactivations || []) {
    if (isTempStageId(stageId)) continue;
    await deactivateWorkflowStageAction(stageId);
  }

  for (const wfId of pendingBatch.wfDeactivations || []) {
    if (isTempWorkflowId(wfId)) continue;
    await deactivateWorkflowAction(wfId);
  }

  for (const stageId of pendingBatch.stageHardDeletes || []) {
    if (isTempStageId(stageId)) continue;
    await hardDeleteWorkflowStageAction(stageId);
  }

  for (const wfId of pendingBatch.wfHardDeletes || []) {
    if (isTempWorkflowId(wfId)) continue;
    await hardDeleteWorkflowAction(wfId);
  }

  const orderedPersistedWfIds = orderedWorkflows
    .map((wf) => wf?.wf_id)
    .map((id) => wfIdMap.get(String(id ?? "")) ?? id)
    .filter((id) => id != null && id !== "")
    .filter((id) => !deactivatedWfSet.has(String(id)))
    .filter((id) => !isTempWorkflowId(id));

  if (orderedPersistedWfIds.length > 0) {
    await saveWorkflowOrderAction(orderedPersistedWfIds);
  }

  return { wfIdMap, deactivatedWfSet, orderedPersistedWfIds };
}

// ─── REFERENCE TABLE BATCH SAVE ────────────────────────────

export async function executeReferenceBatchSave(pendingBatch, options) {
  const {
    createAction,
    updateAction,
    deactivateAction,
    hardDeleteAction,
    idMapKey = "id",
    idField = "id",
  } = options || {};

  const idMap = new Map();
  const deactivatedSet = new Set(
    [...(pendingBatch.deactivations || []), ...(pendingBatch.hardDeletes || [])].map((id) => String(id ?? "")),
  );

  for (const entry of pendingBatch.creates || []) {
    const created = await createAction(entry.payload);
    const id = created?.[idField];
    if (id == null || id === "") throw new Error("Created record response is invalid.");
    idMap.set(String(entry.tempId), id);
  }

  for (const [id, updates] of Object.entries(pendingBatch.updates || {})) {
    if (deactivatedSet.has(String(id)) || !Object.keys(updates || {}).length) continue;
    const resolved = idMap.get(String(id)) ?? id;
    await updateAction(resolved, updates);
  }

  for (const id of pendingBatch.deactivations || []) {
    if (String(id ?? "").startsWith("tmp-")) continue;
    await deactivateAction(id);
  }

  for (const id of pendingBatch.hardDeletes || []) {
    if (String(id ?? "").startsWith("tmp-")) continue;
    await hardDeleteAction(id);
  }

  return { [idMapKey]: idMap, deactivatedSet };
}
