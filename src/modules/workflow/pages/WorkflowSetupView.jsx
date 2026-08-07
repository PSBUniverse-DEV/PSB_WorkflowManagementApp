"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, InlineEditCell, Input, Modal, StatusBadge, TableZ, toastError, toastSuccess } from "@/shared/components/ui";
import WorkflowSideNav from "../components/WorkflowSideNav";
import {
  isSameId, compareText, buildOrderSignature,
  mapWorkflowRow, mapWorkflowStageRow, removeObjectKey, mergeUpdatePatch, appendUniqueId,
  EMPTY_DIALOG, TEMP_WORKFLOW_PREFIX, TEMP_STAGE_PREFIX, createTempId,
  isTempWorkflowId, isTempStageId, createEmptyBatchState, executeWorkflowBatchSave,
  batchMarker,
} from "../data/workflow.data.js";

// ─── HOOK: useWorkflowSetup ────────────────────────────────

function useWorkflowSetup({ workflows = [], stages = [], stageTypes = [], orgRoles = [], initialSelectedWfId = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const seedWorkflows = useMemo(
    () => (Array.isArray(workflows) ? workflows : [])
      .map((wf, i) => mapWorkflowRow(wf, i))
      .sort((a, b) => { const d = Number(a.display_order || 0) - Number(b.display_order || 0); return d !== 0 ? d : compareText(a.wf_name, b.wf_name); }),
    [workflows],
  );

  const seedStages = useMemo(() => (Array.isArray(stages) ? stages : []).map((s, i) => mapWorkflowStageRow(s, i)), [stages]);

  const stageTypeOptions = useMemo(() => (Array.isArray(stageTypes) ? stageTypes : []), [stageTypes]);
  const orgRoleOptions = useMemo(() => (Array.isArray(orgRoles) ? orgRoles : []), [orgRoles]);

  const [orderedWorkflows, setOrderedWorkflows] = useState(seedWorkflows);
  const [allStages, setAllStages] = useState(seedStages);
  const [persistedOrderSig, setPersistedOrderSig] = useState(buildOrderSignature(seedWorkflows));
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isMutatingAction, setIsMutatingAction] = useState(false);
  const [pendingBatch, setPendingBatch] = useState(createEmptyBatchState());
  const [dialog, setDialog] = useState(EMPTY_DIALOG);
  const [workflowDraft, setWorkflowDraft] = useState({ name: "", desc: "" });
  const [stageDraft, setStageDraft] = useState({ name: "", desc: "", stagetypeId: "", orgroleId: "" });
  const [editingWfId, setEditingWfId] = useState(null);
  const [editingStageId, setEditingStageId] = useState(null);
  const [expandedWfId, setExpandedWfId] = useState(null);
  const batchActiveRef = useRef(false);

  useEffect(() => {
    if (batchActiveRef.current) return;
    setOrderedWorkflows(seedWorkflows); setAllStages(seedStages);
    setPersistedOrderSig(buildOrderSignature(seedWorkflows));
    setIsSavingOrder(false); setIsMutatingAction(false);
    setPendingBatch(createEmptyBatchState()); setDialog(EMPTY_DIALOG);
    setWorkflowDraft({ name: "", desc: "" }); setStageDraft({ name: "", desc: "", stagetypeId: "", orgroleId: "" });
    setEditingWfId(null); setEditingStageId(null);
  }, [seedWorkflows, seedStages]);

  const currentOrderSig = useMemo(() => {
    const excluded = new Set([
      ...(pendingBatch.wfCreates || []).map((e) => String(e?.tempId ?? "")),
      ...(pendingBatch.wfDeactivations || []).map((id) => String(id ?? "")),
      ...(pendingBatch.wfHardDeletes || []).map((id) => String(id ?? "")),
    ]);
    return buildOrderSignature(orderedWorkflows.filter((r) => !excluded.has(String(r?.wf_id ?? ""))));
  }, [orderedWorkflows, pendingBatch.wfCreates, pendingBatch.wfDeactivations, pendingBatch.wfHardDeletes]);

  const persistedOrderSigFiltered = useMemo(() => {
    const excluded = new Set([
      ...(pendingBatch.wfDeactivations || []).map((id) => String(id ?? "")),
      ...(pendingBatch.wfHardDeletes || []).map((id) => String(id ?? "")),
    ]);
    const persistedRows = seedWorkflows.filter((r) => !excluded.has(String(r?.wf_id ?? "")));
    return buildOrderSignature(persistedRows);
  }, [seedWorkflows, pendingBatch.wfDeactivations, pendingBatch.wfHardDeletes]);

  const hasOrderChanges = persistedOrderSigFiltered !== currentOrderSig;

  const pendingSummary = useMemo(() => {
    const wA = pendingBatch.wfCreates.length;
    const wE = Object.entries(pendingBatch.wfUpdates || {}).filter(([id, patch]) => {
      const seed = seedWorkflows.find((w) => isSameId(w?.wf_id, id));
      if (!seed) return true;
      return Object.entries(patch || {}).some(([k, v]) => String(v ?? "") !== String(seed[k] ?? ""));
    }).length;
    const wD = pendingBatch.wfDeactivations.length, wH = (pendingBatch.wfHardDeletes || []).length;
    const sA = pendingBatch.stageCreates.length;
    const sE = Object.entries(pendingBatch.stageUpdates || {}).filter(([id, patch]) => {
      const seed = seedStages.find((s) => isSameId(s?.wfs_id, id));
      if (!seed) return true;
      return Object.entries(patch || {}).some(([k, v]) => String(v ?? "") !== String(seed[k] ?? ""));
    }).length;
    const sD = pendingBatch.stageDeactivations.length, sH = (pendingBatch.stageHardDeletes || []).length;
    const oC = hasOrderChanges ? 1 : 0;
    return { workflowAdded: wA, workflowEdited: wE, workflowDeactivated: wD, workflowHardDeleted: wH, stageAdded: sA, stageEdited: sE, stageDeactivated: sD, stageHardDeleted: sH, rowOrderChanged: oC, total: wA + wE + wD + wH + sA + sE + sD + sH + oC };
  }, [hasOrderChanges, pendingBatch, seedWorkflows, seedStages]);

  const hasPendingChanges = pendingSummary.total > 0;
  useEffect(() => { batchActiveRef.current = hasPendingChanges; }, [hasPendingChanges]);

  const pendingDeactivatedWfIds = useMemo(() => new Set((pendingBatch.wfDeactivations || []).map((id) => String(id ?? ""))), [pendingBatch.wfDeactivations]);
  const pendingDeactivatedStageIds = useMemo(() => new Set((pendingBatch.stageDeactivations || []).map((id) => String(id ?? ""))), [pendingBatch.stageDeactivations]);
  const pendingHardDeletedWfIds = useMemo(() => new Set((pendingBatch.wfHardDeletes || []).map((id) => String(id ?? ""))), [pendingBatch.wfHardDeletes]);
  const pendingHardDeletedStageIds = useMemo(() => new Set((pendingBatch.stageHardDeletes || []).map((id) => String(id ?? ""))), [pendingBatch.stageHardDeletes]);

  const selectedWfId = useMemo(() => {
    const fromQuery = searchParams?.get("wf");
    if (fromQuery !== null && fromQuery !== undefined && fromQuery !== "") {
      const asNumber = Number(fromQuery);
      return Number.isFinite(asNumber) ? asNumber : String(fromQuery);
    }
    if (initialSelectedWfId != null && initialSelectedWfId !== "") return initialSelectedWfId;
    return orderedWorkflows[0]?.wf_id ?? null;
  }, [initialSelectedWfId, orderedWorkflows, searchParams]);

  const selectedWf = useMemo(() => orderedWorkflows.find((w) => isSameId(w?.wf_id, selectedWfId)) ?? orderedWorkflows[0] ?? null, [orderedWorkflows, selectedWfId]);
  const isSelectedWfPendingDeactivation = useMemo(() => pendingDeactivatedWfIds.has(String(selectedWf?.wf_id ?? "")), [pendingDeactivatedWfIds, selectedWf?.wf_id]);
  const selectedWfStages = useMemo(() => allStages.filter((s) => isSameId(s?.wf_id, selectedWf?.wf_id)).sort((a, b) => { const d = Number(a.stage_order || 0) - Number(b.stage_order || 0); return d !== 0 ? d : compareText(a.stage_name, b.stage_name); }), [allStages, selectedWf?.wf_id]);

  const decoratedWorkflows = useMemo(() => {
    const cIds = new Set((pendingBatch.wfCreates || []).map((e) => String(e?.tempId ?? "")));
    const uIds = new Set(Object.entries(pendingBatch.wfUpdates || {}).filter(([id, patch]) => {
      const seed = seedWorkflows.find((w) => isSameId(w?.wf_id, id));
      if (!seed) return true;
      return Object.entries(patch || {}).some(([k, v]) => String(v ?? "") !== String(seed[k] ?? ""));
    }).map(([id]) => id));
    const dIds = new Set((pendingBatch.wfDeactivations || []).map((e) => String(e ?? "")));
    const hIds = new Set((pendingBatch.wfHardDeletes || []).map((e) => String(e ?? "")));
    return orderedWorkflows.map((row) => {
      const id = String(row?.wf_id ?? "");
      if (hIds.has(id)) return { ...row, __batchState: "hardDeleted" };
      if (dIds.has(id)) return { ...row, __batchState: "deleted" };
      if (cIds.has(id)) return { ...row, __batchState: "created" };
      if (uIds.has(id)) return { ...row, __batchState: "updated" };
      return { ...row, __batchState: "none" };
    });
  }, [orderedWorkflows, pendingBatch.wfCreates, pendingBatch.wfDeactivations, pendingBatch.wfHardDeletes, pendingBatch.wfUpdates, seedWorkflows]);

  const decoratedSelectedWfStages = useMemo(() => {
    const cIds = new Set((pendingBatch.stageCreates || []).map((e) => String(e?.tempId ?? "")));
    const uIds = new Set(Object.entries(pendingBatch.stageUpdates || {}).filter(([id, patch]) => {
      const seed = seedStages.find((s) => isSameId(s?.wfs_id, id));
      if (!seed) return true;
      return Object.entries(patch || {}).some(([k, v]) => String(v ?? "") !== String(seed[k] ?? ""));
    }).map(([id]) => id));
    const dIds = new Set((pendingBatch.stageDeactivations || []).map((e) => String(e ?? "")));
    const hIds = new Set((pendingBatch.stageHardDeletes || []).map((e) => String(e ?? "")));
    return selectedWfStages.map((row) => {
      const id = String(row?.wfs_id ?? "");
      if (hIds.has(id)) return { ...row, __batchState: "hardDeleted" };
      if (dIds.has(id)) return { ...row, __batchState: "deleted" };
      if (cIds.has(id)) return { ...row, __batchState: "created" };
      if (uIds.has(id)) return { ...row, __batchState: "updated" };
      return { ...row, __batchState: "none" };
    });
  }, [pendingBatch.stageCreates, pendingBatch.stageDeactivations, pendingBatch.stageHardDeletes, pendingBatch.stageUpdates, seedStages, selectedWfStages]);

  const updateSelectedWfInQuery = useCallback((wfId) => {
    const p = new URLSearchParams(searchParams?.toString() || "");
    if (wfId == null || wfId === "") p.delete("wf"); else p.set("wf", String(wfId));
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleWorkflowRowClick = useCallback((row) => {
    const wfId = row?.wf_id;
    setExpandedWfId((prev) => isSameId(prev, wfId) ? null : wfId);
    updateSelectedWfInQuery(wfId);
  }, [updateSelectedWfInQuery]);

  const handleWorkflowReorder = useCallback((next) => {
    if (isSavingOrder || isMutatingAction) return;
    setOrderedWorkflows((Array.isArray(next) ? next : []).map((r, i) => ({ ...r, display_order: i + 1 })));
  }, [isMutatingAction, isSavingOrder]);

  const handleCancelOrderChanges = useCallback(() => {
    if (isSavingOrder || isMutatingAction) return;
    batchActiveRef.current = false;
    setOrderedWorkflows(seedWorkflows); setAllStages(seedStages);
    setPendingBatch(createEmptyBatchState()); setPersistedOrderSig(buildOrderSignature(seedWorkflows));
    setDialog(EMPTY_DIALOG); setWorkflowDraft({ name: "", desc: "" }); setStageDraft({ name: "", desc: "", stagetypeId: "", orgroleId: "" });
    setEditingWfId(null); setEditingStageId(null);
    updateSelectedWfInQuery(seedWorkflows[0]?.wf_id ?? null);
  }, [isMutatingAction, isSavingOrder, seedWorkflows, seedStages, updateSelectedWfInQuery]);

  const handleSaveOrderChanges = useCallback(async () => {
    if (!hasPendingChanges || isSavingOrder || isMutatingAction) return;
    setIsSavingOrder(true); setIsMutatingAction(true);
    try {
      const { wfIdMap, deactivatedWfSet, orderedPersistedWfIds } = await executeWorkflowBatchSave(pendingBatch, orderedWorkflows);
      setPersistedOrderSig(currentOrderSig); setPendingBatch(createEmptyBatchState());
      batchActiveRef.current = false;
      const selKey = String(selectedWf?.wf_id ?? "");
      const selResolved = wfIdMap.get(selKey) ?? selectedWf?.wf_id ?? null;
      const nextSel = selResolved && !deactivatedWfSet.has(String(selResolved)) ? selResolved : (orderedPersistedWfIds[0] ?? null);
      updateSelectedWfInQuery(nextSel);
      router.refresh();
      toastSuccess(`Saved ${pendingSummary.total} batched change(s).`, "Save Batch");
    } catch (error) {
      toastError(error?.message || "Failed to save batched changes.");
    } finally { setIsMutatingAction(false); setIsSavingOrder(false); setEditingWfId(null); setEditingStageId(null); }
  }, [currentOrderSig, hasPendingChanges, isMutatingAction, isSavingOrder, orderedWorkflows, pendingBatch, pendingSummary.total, router, selectedWf?.wf_id, updateSelectedWfInQuery]);

  const closeDialog = useCallback(() => { if (!isMutatingAction) setDialog(EMPTY_DIALOG); }, [isMutatingAction]);

  // ── Workflow dialog actions ──

  const openEditWorkflowDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    setWorkflowDraft({ name: String(row?.wf_name || ""), desc: String(row?.wf_description || "") });
    setDialog({ kind: "edit-workflow", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingOrder]);

  const openToggleWorkflowDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    const wfId = String(row?.wf_id ?? "");
    if (pendingDeactivatedWfIds.has(wfId)) {
      const linkedStageIds = allStages.filter((s) => isSameId(s?.wf_id, wfId)).map((s) => String(s?.wfs_id ?? ""));
      setPendingBatch((prev) => ({ ...prev, wfDeactivations: (prev.wfDeactivations || []).filter((id) => !isSameId(id, wfId)), stageDeactivations: (prev.stageDeactivations || []).filter((id) => !linkedStageIds.some((ls) => isSameId(ls, id))) }));
      toastSuccess("Workflow deactivation un-staged.", "Batching");
      return;
    }
    setDialog({ kind: "toggle-workflow", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [allStages, isMutatingAction, isSavingOrder, pendingDeactivatedWfIds]);

  const openDeactivateWorkflowDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    setDialog({ kind: "deactivate-workflow", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingOrder]);

  const stageHardDeleteWorkflow = useCallback((row) => {
    const wfId = String(row?.wf_id ?? "");
    if (!wfId || isSavingOrder || isMutatingAction) return;
    const linkedStageIds = allStages.filter((s) => isSameId(s?.wf_id, wfId)).map((s) => String(s?.wfs_id ?? ""));
    if (isTempWorkflowId(wfId)) {
      const nextWfs = orderedWorkflows.filter((w) => !isSameId(w?.wf_id, wfId)).map((w, i) => ({ ...w, display_order: i + 1 }));
      setOrderedWorkflows(nextWfs);
      setAllStages((prev) => prev.filter((s) => !isSameId(s?.wf_id, wfId)));
      setPendingBatch((prev) => ({ ...prev, wfCreates: prev.wfCreates.filter((e) => !isSameId(e?.tempId, wfId)), wfUpdates: removeObjectKey(prev.wfUpdates, wfId), stageCreates: prev.stageCreates.filter((e) => !isSameId(e?.payload?.wf_id, wfId)), stageUpdates: linkedStageIds.reduce((m, id) => removeObjectKey(m, id), prev.stageUpdates), stageDeactivations: (prev.stageDeactivations || []).filter((id) => !linkedStageIds.some((ls) => isSameId(ls, id))), stageHardDeletes: (prev.stageHardDeletes || []).filter((id) => !linkedStageIds.some((ls) => isSameId(ls, id))) }));
      if (isSameId(selectedWf?.wf_id, wfId)) updateSelectedWfInQuery(nextWfs[0]?.wf_id ?? null);
      toastSuccess("Staged workflow removed.", "Batching");
      return;
    }
    setPendingBatch((prev) => ({ ...prev, wfUpdates: removeObjectKey(prev.wfUpdates, wfId), wfDeactivations: (prev.wfDeactivations || []).filter((id) => !isSameId(id, wfId)), wfHardDeletes: appendUniqueId(prev.wfHardDeletes || [], wfId), stageCreates: prev.stageCreates.filter((e) => !isSameId(e?.payload?.wf_id, wfId)), stageUpdates: linkedStageIds.reduce((m, id) => removeObjectKey(m, id), prev.stageUpdates), stageDeactivations: (prev.stageDeactivations || []).filter((id) => !linkedStageIds.some((ls) => isSameId(ls, id))), stageHardDeletes: linkedStageIds.reduce((ids, id) => isTempStageId(id) ? ids : appendUniqueId(ids, id), (prev.stageHardDeletes || []).filter((id) => !linkedStageIds.some((ls) => isSameId(ls, id)))) }));
    toastSuccess("Workflow deletion staged for Save Batch.", "Batching");
  }, [allStages, isMutatingAction, isSavingOrder, orderedWorkflows, selectedWf?.wf_id, updateSelectedWfInQuery]);

  const unstageHardDeleteWorkflow = useCallback((row) => {
    const wfId = String(row?.wf_id ?? "");
    if (!wfId || isSavingOrder || isMutatingAction) return;
    const linkedStageIds = allStages.filter((s) => isSameId(s?.wf_id, wfId)).map((s) => String(s?.wfs_id ?? ""));
    setPendingBatch((prev) => ({ ...prev, wfHardDeletes: (prev.wfHardDeletes || []).filter((id) => !isSameId(id, wfId)), stageHardDeletes: (prev.stageHardDeletes || []).filter((id) => !linkedStageIds.some((ls) => isSameId(ls, id))) }));
    toastSuccess("Workflow deletion un-staged.", "Batching");
  }, [allStages, isMutatingAction, isSavingOrder]);

  const openAddWorkflowDialog = useCallback(() => {
    if (isSavingOrder || isMutatingAction) return;
    setWorkflowDraft({ name: "", desc: "" });
    setDialog({ kind: "add-workflow", target: null, nextIsActive: true });
  }, [isMutatingAction, isSavingOrder]);

  const submitAddWorkflow = useCallback(() => {
    const wfName = String(workflowDraft.name || "").trim();
    if (!wfName) { toastError("Workflow name is required."); return; }
    const wfDesc = String(workflowDraft.desc || "").trim();
    const tempWfId = createTempId(TEMP_WORKFLOW_PREFIX);
    setOrderedWorkflows((prev) => [...prev, mapWorkflowRow({ wf_id: tempWfId, wf_name: wfName, wf_description: wfDesc || null, is_active: true, display_order: prev.length + 1 }, prev.length)]);
    setPendingBatch((prev) => ({ ...prev, wfCreates: [...prev.wfCreates, { tempId: tempWfId, payload: { wf_name: wfName, wf_description: wfDesc || null, is_active: true } }] }));
    updateSelectedWfInQuery(tempWfId);
    setDialog(EMPTY_DIALOG); setWorkflowDraft({ name: "", desc: "" });
    toastSuccess("Workflow staged for Save Batch.", "Batching");
  }, [workflowDraft, updateSelectedWfInQuery]);

  const submitEditWorkflow = useCallback(() => {
    const row = dialog?.target;
    if (!row?.wf_id) { toastError("Invalid workflow."); return; }
    const wfName = String(workflowDraft.name || "").trim();
    if (!wfName) { toastError("Workflow name is required."); return; }
    const wfDesc = String(workflowDraft.desc || "").trim();
    const wfId = row.wf_id;
    setOrderedWorkflows((prev) => prev.map((w, i) => isSameId(w?.wf_id, wfId) ? mapWorkflowRow({ ...w, wf_name: wfName, wf_description: wfDesc || null }, i) : w));
    setPendingBatch((prev) => {
      if (isTempWorkflowId(wfId)) return { ...prev, wfCreates: prev.wfCreates.map((e) => isSameId(e?.tempId, wfId) ? { ...e, payload: { ...e.payload, wf_name: wfName, wf_description: wfDesc || null } } : e), wfUpdates: removeObjectKey(prev.wfUpdates, wfId) };
      return { ...prev, wfUpdates: { ...prev.wfUpdates, [String(wfId)]: mergeUpdatePatch(prev.wfUpdates?.[String(wfId)], { wf_name: wfName, wf_description: wfDesc || null }) } };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Workflow update staged for Save Batch.", "Batching");
  }, [workflowDraft, dialog]);

  const submitToggleWorkflow = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.wf_id) { toastError("Invalid workflow."); return; }
    const wfId = row.wf_id;
    setOrderedWorkflows((prev) => prev.map((w, i) => isSameId(w?.wf_id, wfId) ? mapWorkflowRow({ ...w, is_active: nextIsActive }, i) : w));
    setPendingBatch((prev) => {
      if (isTempWorkflowId(wfId)) return { ...prev, wfCreates: prev.wfCreates.map((e) => isSameId(e?.tempId, wfId) ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e), wfUpdates: removeObjectKey(prev.wfUpdates, wfId) };
      return { ...prev, wfUpdates: { ...prev.wfUpdates, [String(wfId)]: mergeUpdatePatch(prev.wfUpdates?.[String(wfId)], { is_active: nextIsActive }) } };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess(`Workflow ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog]);

  const submitDeactivateWorkflow = useCallback(() => {
    const row = dialog?.target;
    if (!row?.wf_id) { toastError("Invalid workflow."); return; }
    const wfId = row.wf_id;
    const linkedStageIds = allStages.filter((s) => isSameId(s?.wf_id, wfId)).map((s) => String(s?.wfs_id ?? ""));
    if (isTempWorkflowId(wfId)) {
      const nextWfs = orderedWorkflows.filter((w) => !isSameId(w?.wf_id, wfId)).map((w, i) => ({ ...w, display_order: i + 1 }));
      setOrderedWorkflows(nextWfs); setAllStages((prev) => prev.filter((s) => !isSameId(s?.wf_id, wfId)));
      setPendingBatch((prev) => ({ ...prev, wfCreates: prev.wfCreates.filter((e) => !isSameId(e?.tempId, wfId)), wfUpdates: removeObjectKey(prev.wfUpdates, wfId), wfDeactivations: (prev.wfDeactivations || []).filter((id) => !isSameId(id, wfId)), stageCreates: prev.stageCreates.filter((e) => !isSameId(e?.payload?.wf_id, wfId)), stageUpdates: linkedStageIds.reduce((m, id) => removeObjectKey(m, id), prev.stageUpdates), stageDeactivations: (prev.stageDeactivations || []).filter((id) => !linkedStageIds.some((ls) => isSameId(ls, id))) }));
      if (isSameId(selectedWf?.wf_id, wfId)) updateSelectedWfInQuery(nextWfs[0]?.wf_id ?? null);
      setDialog(EMPTY_DIALOG);
      toastSuccess("Workflow deactivation staged for Save Batch.", "Batching");
      return;
    }
    setPendingBatch((prev) => {
      const nextStageDeactivations = linkedStageIds.reduce((ids, id) => appendUniqueId(ids, id), prev.stageDeactivations || []);
      return { ...prev, wfUpdates: removeObjectKey(prev.wfUpdates, wfId), wfDeactivations: appendUniqueId(prev.wfDeactivations, wfId), stageCreates: prev.stageCreates.filter((e) => !isSameId(e?.payload?.wf_id, wfId)), stageUpdates: linkedStageIds.reduce((m, id) => removeObjectKey(m, id), prev.stageUpdates), stageDeactivations: nextStageDeactivations };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Workflow deactivation staged for Save Batch.", "Batching");
  }, [allStages, dialog, orderedWorkflows, selectedWf?.wf_id, updateSelectedWfInQuery]);

  // ── Stage dialog actions ──

  const openEditStageDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    setStageDraft({
      name: String(row?.stage_name || ""),
      desc: String(row?.stage_description || ""),
      stagetypeId: String(row?.stagetype_id ?? ""),
      orgroleId: String(row?.orgrole_id ?? ""),
    });
    setDialog({ kind: "edit-stage", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingOrder]);

  const openToggleStageDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    const stageId = String(row?.wfs_id ?? "");
    if (pendingDeactivatedStageIds.has(stageId)) {
      setPendingBatch((prev) => ({ ...prev, stageDeactivations: (prev.stageDeactivations || []).filter((id) => !isSameId(id, stageId)) }));
      toastSuccess("Stage deactivation un-staged.", "Batching");
      return;
    }
    setDialog({ kind: "toggle-stage", target: row, nextIsActive: !Boolean(row?.is_active_bool) });
  }, [isMutatingAction, isSavingOrder, pendingDeactivatedStageIds]);

  const openDeactivateStageDialog = useCallback((row) => {
    if (isSavingOrder || isMutatingAction) return;
    setDialog({ kind: "deactivate-stage", target: row, nextIsActive: null });
  }, [isMutatingAction, isSavingOrder]);

  const stageHardDeleteStage = useCallback((row) => {
    const stageId = String(row?.wfs_id ?? "");
    if (!stageId || isSavingOrder || isMutatingAction) return;
    if (isTempStageId(stageId)) {
      setAllStages((prev) => prev.filter((s) => !isSameId(s?.wfs_id, stageId)));
      setPendingBatch((prev) => ({ ...prev, stageCreates: prev.stageCreates.filter((e) => !isSameId(e?.tempId, stageId)), stageUpdates: removeObjectKey(prev.stageUpdates, stageId) }));
      toastSuccess("Staged stage removed.", "Batching");
      return;
    }
    setPendingBatch((prev) => ({ ...prev, stageDeactivations: (prev.stageDeactivations || []).filter((id) => !isSameId(id, stageId)), stageUpdates: removeObjectKey(prev.stageUpdates, stageId), stageHardDeletes: appendUniqueId(prev.stageHardDeletes || [], stageId) }));
    toastSuccess("Stage deletion staged for Save Batch.", "Batching");
  }, [isMutatingAction, isSavingOrder]);

  const unstageHardDeleteStage = useCallback((row) => {
    const stageId = String(row?.wfs_id ?? "");
    if (!stageId || isSavingOrder || isMutatingAction) return;
    setPendingBatch((prev) => ({ ...prev, stageHardDeletes: (prev.stageHardDeletes || []).filter((id) => !isSameId(id, stageId)) }));
    toastSuccess("Stage deletion un-staged.", "Batching");
  }, [isMutatingAction, isSavingOrder]);

  const openAddStageDialog = useCallback(() => {
    if (isSavingOrder || isMutatingAction) return;
    if (!selectedWf?.wf_id) { toastError("Select a workflow before adding a stage."); return; }
    if (isSelectedWfPendingDeactivation) { toastError("Selected workflow is staged for deactivation. Save or cancel batch before adding a stage."); return; }
    setStageDraft({ name: "", desc: "", stagetypeId: "", orgroleId: "" });
    setDialog({ kind: "add-stage", target: { wf_id: selectedWf.wf_id, wf_name: selectedWf.wf_name }, nextIsActive: true });
  }, [isMutatingAction, isSavingOrder, isSelectedWfPendingDeactivation, selectedWf]);

  const submitEditStage = useCallback(() => {
    const row = dialog?.target;
    if (!row?.wfs_id) { toastError("Invalid stage."); return; }
    const stageName = String(stageDraft.name || "").trim();
    if (!stageName) { toastError("Stage name is required."); return; }
    const stageDesc = String(stageDraft.desc || "").trim();
    const stagetypeId = stageDraft.stagetypeId || null;
    const orgroleId = stageDraft.orgroleId || null;
    const stageId = row.wfs_id;
    setAllStages((prev) => prev.map((s, i) => isSameId(s?.wfs_id, stageId) ? mapWorkflowStageRow({ ...s, stage_name: stageName, stage_description: stageDesc || null, stagetype_id: stagetypeId, orgrole_id: orgroleId }, i) : s));
    setPendingBatch((prev) => {
      if (isTempStageId(stageId)) {
        return { ...prev, stageCreates: prev.stageCreates.map((e) => isSameId(e?.tempId, stageId) ? { ...e, payload: { ...e.payload, stage_name: stageName, stage_description: stageDesc || null, stagetype_id: stagetypeId, orgrole_id: orgroleId } } : e), stageUpdates: removeObjectKey(prev.stageUpdates, stageId) };
      }
      return { ...prev, stageUpdates: { ...prev.stageUpdates, [String(stageId)]: mergeUpdatePatch(prev.stageUpdates?.[String(stageId)], { stage_name: stageName, stage_description: stageDesc || null, stagetype_id: stagetypeId, orgrole_id: orgroleId }) } };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess("Stage update staged for Save Batch.", "Batching");
  }, [stageDraft, dialog]);

  const submitToggleStage = useCallback(() => {
    const row = dialog?.target;
    const nextIsActive = Boolean(dialog?.nextIsActive);
    if (!row?.wfs_id) { toastError("Invalid stage."); return; }
    const stageId = row.wfs_id;
    setAllStages((prev) => prev.map((s, i) => isSameId(s?.wfs_id, stageId) ? mapWorkflowStageRow({ ...s, is_active: nextIsActive }, i) : s));
    setPendingBatch((prev) => {
      if (isTempStageId(stageId)) {
        return { ...prev, stageCreates: prev.stageCreates.map((e) => isSameId(e?.tempId, stageId) ? { ...e, payload: { ...e.payload, is_active: nextIsActive } } : e), stageUpdates: removeObjectKey(prev.stageUpdates, stageId) };
      }
      return { ...prev, stageUpdates: { ...prev.stageUpdates, [String(stageId)]: mergeUpdatePatch(prev.stageUpdates?.[String(stageId)], { is_active: nextIsActive }) } };
    });
    setDialog(EMPTY_DIALOG);
    toastSuccess(`Stage ${nextIsActive ? "enable" : "disable"} staged for Save Batch.`, "Batching");
  }, [dialog]);

  const submitDeactivateStage = useCallback(() => {
    const row = dialog?.target;
    if (!row?.wfs_id) { toastError("Invalid stage."); return; }
    const stageId = row.wfs_id;
    if (isTempStageId(stageId)) {
      setAllStages((items) => items.filter((s) => !isSameId(s?.wfs_id, stageId)));
      setPendingBatch((prev) => ({ ...prev, stageCreates: prev.stageCreates.filter((e) => !isSameId(e?.tempId, stageId)), stageUpdates: removeObjectKey(prev.stageUpdates, stageId) }));
      setDialog(EMPTY_DIALOG);
      toastSuccess("Staged stage removed.", "Batching");
      return;
    }
    setPendingBatch((prev) => ({ ...prev, stageDeactivations: appendUniqueId(prev.stageDeactivations, stageId) }));
    setDialog(EMPTY_DIALOG);
    toastSuccess("Stage deactivation staged for Save Batch.", "Batching");
  }, [dialog]);

  const submitAddStage = useCallback(() => {
    const target = dialog?.target;
    if (!target?.wf_id) { toastError("Select a workflow before adding a stage."); return; }
    const stageName = String(stageDraft.name || "").trim();
    if (!stageName) { toastError("Stage name is required."); return; }
    const stageDesc = String(stageDraft.desc || "").trim();
    const stagetypeId = stageDraft.stagetypeId || null;
    const orgroleId = stageDraft.orgroleId || null;
    const tempStageId = createTempId(TEMP_STAGE_PREFIX);
    setAllStages((prev) => [...prev, mapWorkflowStageRow({ wfs_id: tempStageId, wf_id: target.wf_id, stage_name: stageName, stage_description: stageDesc || null, stagetype_id: stagetypeId, orgrole_id: orgroleId, is_active: true, stage_order: selectedWfStages.length + 1 }, prev.length)]);
    setPendingBatch((prev) => ({ ...prev, stageCreates: [...prev.stageCreates, { tempId: tempStageId, payload: { wf_id: target.wf_id, stage_name: stageName, stage_description: stageDesc || null, stagetype_id: stagetypeId, orgrole_id: orgroleId, is_active: true } }] }));
    setDialog(EMPTY_DIALOG);
    setStageDraft({ name: "", desc: "", stagetypeId: "", orgroleId: "" });
    toastSuccess("Stage staged for Save Batch.", "Batching");
  }, [stageDraft, dialog, selectedWfStages.length]);

  // ── Inline editing ──

  const startEditingWf = useCallback((row) => { if (isSavingOrder || isMutatingAction) return; const id = String(row?.wf_id ?? ""); setEditingWfId((prev) => prev === id ? null : id); }, [isMutatingAction, isSavingOrder]);
  const stopEditingWf = useCallback(() => { setEditingWfId(null); }, []);
  const startEditingStage = useCallback((row) => { if (isSavingOrder || isMutatingAction) return; const id = String(row?.wfs_id ?? ""); setEditingStageId((prev) => prev === id ? null : id); }, [isMutatingAction, isSavingOrder]);
  const stopEditingStage = useCallback(() => { setEditingStageId(null); }, []);

  const handleInlineEditWorkflow = useCallback((row, key, value) => {
    const wfId = row?.wf_id;
    if (!wfId || isSavingOrder || isMutatingAction) return;
    setOrderedWorkflows((prev) => prev.map((w, i) => isSameId(w?.wf_id, wfId) ? mapWorkflowRow({ ...w, [key]: value || null }, i) : w));
    setPendingBatch((prev) => {
      if (isTempWorkflowId(wfId)) return { ...prev, wfCreates: prev.wfCreates.map((e) => isSameId(e?.tempId, wfId) ? { ...e, payload: { ...e.payload, [key]: value || null } } : e) };
      return { ...prev, wfUpdates: { ...prev.wfUpdates, [String(wfId)]: mergeUpdatePatch(prev.wfUpdates?.[String(wfId)], { [key]: value || null }) } };
    });
  }, [isMutatingAction, isSavingOrder]);

  const handleInlineEditStage = useCallback((row, key, value) => {
    const stageId = row?.wfs_id;
    if (!stageId || isSavingOrder || isMutatingAction) return;
    setAllStages((prev) => prev.map((s, i) => isSameId(s?.wfs_id, stageId) ? mapWorkflowStageRow({ ...s, [key]: value || null }, i) : s));
    setPendingBatch((prev) => {
      if (isTempStageId(stageId)) return { ...prev, stageCreates: prev.stageCreates.map((e) => isSameId(e?.tempId, stageId) ? { ...e, payload: { ...e.payload, [key]: value || null } } : e) };
      return { ...prev, stageUpdates: { ...prev.stageUpdates, [String(stageId)]: mergeUpdatePatch(prev.stageUpdates?.[String(stageId)], { [key]: value || null }) } };
    });
  }, [isMutatingAction, isSavingOrder]);

  return {
    decoratedWorkflows, decoratedSelectedWfStages, dialog, workflowDraft, stageDraft,
    isSavingOrder, isMutatingAction, pendingSummary, hasPendingChanges,
    pendingDeactivatedWfIds, pendingDeactivatedStageIds, pendingHardDeletedWfIds, pendingHardDeletedStageIds,
    selectedWf, isSelectedWfPendingDeactivation, expandedWfId,
    stageTypeOptions, orgRoleOptions,
    setDialog, setWorkflowDraft, setStageDraft,
    handleWorkflowRowClick, handleWorkflowReorder, handleCancelOrderChanges, handleSaveOrderChanges,
    closeDialog,
    openEditWorkflowDialog, openToggleWorkflowDialog, openDeactivateWorkflowDialog,
    stageHardDeleteWorkflow, unstageHardDeleteWorkflow, openAddWorkflowDialog,
    submitAddWorkflow, submitEditWorkflow, submitToggleWorkflow, submitDeactivateWorkflow,
    openEditStageDialog, openToggleStageDialog, openDeactivateStageDialog,
    stageHardDeleteStage, unstageHardDeleteStage, openAddStageDialog,
    submitEditStage, submitToggleStage, submitDeactivateStage, submitAddStage,
    handleInlineEditWorkflow, handleInlineEditStage,
    editingWfId, startEditingWf, stopEditingWf, editingStageId, startEditingStage, stopEditingStage,
  };
}

// ─── SUB-COMPONENTS ────────────────────────────────────────

// ── Header ──

function WorkflowHeader({ hasPendingChanges, pendingSummary, isSavingOrder, isMutatingAction, handleSaveOrderChanges, handleCancelOrderChanges, openAddWorkflowDialog }) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <div>
        <h1 className="h3 mb-1">Workflow Configuration</h1>
        <p className="text-muted mb-0">Manage workflows, stages, and workflow configuration tables.</p>
      </div>
      <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
        <span className={`small ${hasPendingChanges ? "text-warning-emphasis fw-semibold" : "text-muted"}`}>
          {isMutatingAction || isSavingOrder ? "Saving batch..." : hasPendingChanges ? `${pendingSummary.total} staged change(s)` : "No changes"}
        </span>
        {hasPendingChanges ? (
          <>
            {pendingSummary.workflowAdded + pendingSummary.stageAdded > 0 ? <span className="psb-batch-chip psb-batch-chip-added">+{pendingSummary.workflowAdded + pendingSummary.stageAdded} Added</span> : null}
            {pendingSummary.workflowEdited + pendingSummary.stageEdited > 0 ? <span className="psb-batch-chip psb-batch-chip-edited">~{pendingSummary.workflowEdited + pendingSummary.stageEdited} Edited</span> : null}
            {pendingSummary.workflowDeactivated + pendingSummary.stageDeactivated > 0 ? <span className="psb-batch-chip psb-batch-chip-deleted">-{pendingSummary.workflowDeactivated + pendingSummary.stageDeactivated} Deactivated</span> : null}
            {pendingSummary.rowOrderChanged > 0 ? <span className="psb-batch-chip psb-batch-chip-order">Reordered</span> : null}
          </>
        ) : null}
        <Button type="button" size="sm" variant="primary" loading={isSavingOrder} disabled={!hasPendingChanges || isSavingOrder || isMutatingAction} onClick={handleSaveOrderChanges}>Save Batch</Button>
        <Button type="button" size="sm" variant="ghost" disabled={!hasPendingChanges || isSavingOrder || isMutatingAction} onClick={handleCancelOrderChanges}>Cancel Batch</Button>
        <Button type="button" size="sm" variant="success" disabled={isSavingOrder || isMutatingAction} onClick={openAddWorkflowDialog}>+ Add Workflow</Button>
      </div>
    </div>
  );
}

// ── Workflow Table (master) with Stage detail (nested) ──

function WorkflowTable({
  decoratedWorkflows, decoratedSelectedWfStages, selectedWf, expandedWfId, isSavingOrder, isMutatingAction,
  pendingDeactivatedWfIds, pendingDeactivatedStageIds,
  handleWorkflowRowClick, handleWorkflowReorder,
  editingWfId, onStartEditingWf, onStopEditingWf, onInlineEditWf,
  openToggleWorkflowDialog, openDeactivateWorkflowDialog, stageHardDeleteWorkflow, onUndoBatchActionWf,
  openAddStageDialog,
  // stage props
  editingStageId, onStartEditingStage, onStopEditingStage, onInlineEditStage,
  openEditStageDialog, openToggleStageDialog, openDeactivateStageDialog, stageHardDeleteStage, onUndoBatchActionStage,
  stageTypeOptions, orgRoleOptions,
}) {
  const columns = useMemo(() => [
    { key: "wf_id", label: "WF ID", width: "10%", sortable: true, render: (row) => <span className="text-muted small">{row?.wf_id ?? "--"}</span> },
    { key: "wf_name", label: "Workflow Name", width: "24%", sortable: true, render: (row) => {
      const m = batchMarker(row?.__batchState || ""); const isEditing = String(row?.wf_id ?? "") === String(editingWfId ?? ""); const editDisabled = !isEditing || isSavingOrder || isMutatingAction; const isSelected = isSameId(row?.wf_id, selectedWf?.wf_id);
      return (<span className={isSelected ? "fw-semibold text-primary" : ""}><InlineEditCell value={row?.wf_name || ""} onCommit={(val) => onInlineEditWf?.(row, "wf_name", val)} onCancel={onStopEditingWf} disabled={editDisabled} />{m.text ? <span className={m.cls}>{m.text}</span> : null}</span>);
    }},
    { key: "wf_description", label: "Description", width: "38%", sortable: true, render: (row) => {
      const isEditing = String(row?.wf_id ?? "") === String(editingWfId ?? ""); const editDisabled = !isEditing || isSavingOrder || isMutatingAction;
      return <InlineEditCell value={row?.wf_description || ""} onCommit={(val) => onInlineEditWf?.(row, "wf_description", val)} onCancel={onStopEditingWf} disabled={editDisabled} />;
    }},
    { key: "display_order", label: "Order", width: "10%", sortable: true, align: "center", render: (row) => <span className="text-muted small">{row?.display_order ?? "--"}</span> },
    { key: "is_active_bool", label: "Active", width: "12%", sortable: true, align: "center", render: (row) => <StatusBadge status={row?.is_active_bool ? "active" : "inactive"} /> },
  ], [editingWfId, isMutatingAction, isSavingOrder, onInlineEditWf, onStopEditingWf, selectedWf?.wf_id]);

  const actions = useMemo(() => [
    { key: "edit-workflow", label: "Edit", type: "secondary", icon: "pen", visible: (r) => String(r?.wf_id ?? "") !== String(editingWfId ?? ""), disabled: () => isSavingOrder || isMutatingAction, onClick: (r) => onStartEditingWf(r) },
    { key: "cancel-edit-workflow", label: "Cancel", type: "secondary", icon: "xmark", visible: (r) => String(r?.wf_id ?? "") === String(editingWfId ?? ""), onClick: () => onStopEditingWf() },
    { key: "add-stage", label: "+ Add Stage", type: "success", icon: "plus", visible: (r) => String(r?.wf_id ?? "") !== String(editingWfId ?? ""), disabled: () => isSavingOrder || isMutatingAction, onClick: () => openAddStageDialog() },
    { key: "restore-workflow", label: "Restore", type: "secondary", icon: "rotate-left", visible: (r) => (!Boolean(r?.is_active_bool) || pendingDeactivatedWfIds.has(String(r?.wf_id ?? ""))) && String(r?.wf_id ?? "") !== String(editingWfId ?? ""), disabled: () => isSavingOrder || isMutatingAction, onClick: (r) => openToggleWorkflowDialog(r) },
    { key: "deactivate-workflow", label: "Deactivate", type: "secondary", icon: "ban", visible: (r) => Boolean(r?.is_active_bool) && !pendingDeactivatedWfIds.has(String(r?.wf_id ?? "")) && String(r?.wf_id ?? "") !== String(editingWfId ?? ""), disabled: () => isSavingOrder || isMutatingAction, onClick: (r) => openDeactivateWorkflowDialog(r) },
    { key: "delete-workflow", label: "Delete", type: "danger", icon: "trash", visible: (r) => String(r?.wf_id ?? "") !== String(editingWfId ?? ""), confirm: true, confirmMessage: (r) => `Permanently delete ${r?.wf_name || "this workflow"}? This action cannot be undone.`, disabled: () => isSavingOrder || isMutatingAction, onClick: (r) => stageHardDeleteWorkflow(r) },
  ], [editingWfId, isMutatingAction, isSavingOrder, onStartEditingWf, onStopEditingWf, openAddStageDialog, openDeactivateWorkflowDialog, openToggleWorkflowDialog, pendingDeactivatedWfIds, stageHardDeleteWorkflow]);

  // ── Stage columns for nested detail ──
  const stageColumns = useMemo(() => [
    { key: "stage_name", label: "Stage Name", width: "22%", sortable: true, render: (row) => {
      const m = batchMarker(row?.__batchState || ""); const isEditing = String(row?.wfs_id ?? "") === String(editingStageId ?? ""); const editDisabled = !isEditing || isSavingOrder || isMutatingAction;
      return (<span><InlineEditCell value={row?.stage_name || ""} onCommit={(val) => onInlineEditStage?.(row, "stage_name", val)} onCancel={onStopEditingStage} disabled={editDisabled} />{m.text ? <span className={m.cls}>{m.text}</span> : null}</span>);
    }},
    { key: "stage_description", label: "Description", width: "28%", sortable: true, render: (row) => {
      const isEditing = String(row?.wfs_id ?? "") === String(editingStageId ?? ""); const editDisabled = !isEditing || isSavingOrder || isMutatingAction;
      return <InlineEditCell value={row?.stage_description || ""} onCommit={(val) => onInlineEditStage?.(row, "stage_description", val)} onCancel={onStopEditingStage} disabled={editDisabled} />;
    }},
    { key: "stagetype_id", label: "Stage Type", width: "16%", sortable: true, render: (row) => {
      const stageType = stageTypeOptions.find((st) => isSameId(st?.stagetype_id, row?.stagetype_id));
      return <span className="small">{stageType?.stagetype_name || row?.stagetype_id || "--"}</span>;
    }},
    { key: "orgrole_id", label: "Org Role", width: "16%", sortable: true, render: (row) => {
      const orgRole = orgRoleOptions.find((or) => isSameId(or?.orgrole_id, row?.orgrole_id));
      return <span className="small">{orgRole?.name || row?.orgrole_id || "--"}</span>;
    }},
    { key: "stage_order", label: "Order", width: "8%", sortable: true, align: "center", render: (row) => <span className="text-muted small">{row?.stage_order ?? "--"}</span> },
    { key: "is_active_bool", label: "Active", width: "10%", sortable: true, align: "center", render: (row) => <StatusBadge status={row?.is_active_bool ? "active" : "inactive"} /> },
  ], [editingStageId, isMutatingAction, isSavingOrder, onInlineEditStage, onStopEditingStage, stageTypeOptions, orgRoleOptions]);

  const stageActions = useMemo(() => [
    { key: "edit-stage", label: "Edit", type: "secondary", icon: "pen", visible: (r) => String(r?.wfs_id ?? "") !== String(editingStageId ?? ""), disabled: () => isSavingOrder || isMutatingAction, onClick: (r) => openEditStageDialog(r) },
    { key: "cancel-edit-stage", label: "Cancel", type: "secondary", icon: "xmark", visible: (r) => String(r?.wfs_id ?? "") === String(editingStageId ?? ""), onClick: () => onStopEditingStage() },
    { key: "restore-stage", label: "Restore", type: "secondary", icon: "rotate-left", visible: (r) => (!Boolean(r?.is_active_bool) || pendingDeactivatedStageIds.has(String(r?.wfs_id ?? ""))) && String(r?.wfs_id ?? "") !== String(editingStageId ?? ""), disabled: () => isSavingOrder || isMutatingAction, onClick: (r) => openToggleStageDialog(r) },
    { key: "deactivate-stage", label: "Deactivate", type: "secondary", icon: "ban", visible: (r) => Boolean(r?.is_active_bool) && !pendingDeactivatedStageIds.has(String(r?.wfs_id ?? "")) && String(r?.wfs_id ?? "") !== String(editingStageId ?? ""), disabled: () => isSavingOrder || isMutatingAction, onClick: (r) => openDeactivateStageDialog(r) },
    { key: "delete-stage", label: "Delete", type: "danger", icon: "trash", visible: (r) => String(r?.wfs_id ?? "") !== String(editingStageId ?? ""), confirm: true, confirmMessage: (r) => `Permanently delete ${r?.stage_name || "this stage"}? This action cannot be undone.`, disabled: () => isSavingOrder || isMutatingAction, onClick: (r) => stageHardDeleteStage(r) },
  ], [editingStageId, isMutatingAction, isSavingOrder, onStartEditingStage, onStopEditingStage, openDeactivateStageDialog, openToggleStageDialog, pendingDeactivatedStageIds, stageHardDeleteStage]);

  const renderWfDetail = useCallback(() => {
    if (!selectedWf) return null;
    return (
      <div>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h6 className="mb-0 small fw-semibold">Stages for: {selectedWf.wf_name}</h6>
        </div>
        <TableZ columns={stageColumns} data={decoratedSelectedWfStages} rowIdKey="wfs_id"
          actions={stageActions} hideFooter hideSearch
          emptyMessage="No stages assigned to this workflow."
          onUndoBatchAction={onUndoBatchActionStage} />
      </div>
    );
  }, [decoratedSelectedWfStages, onUndoBatchActionStage, stageActions, stageColumns, selectedWf]);

  return (
    <TableZ columns={columns} data={decoratedWorkflows} rowIdKey="wf_id"
      selectedRowId={expandedWfId} onRowClick={handleWorkflowRowClick}
      actions={actions} hideFooter
      draggable={!isSavingOrder && !isMutatingAction} onReorder={handleWorkflowReorder}
      renderDetail={renderWfDetail}
      emptyMessage="No workflows found."
      onUndoBatchAction={onUndoBatchActionWf} />
  );
}

// ── Dialog ──

function WorkflowDialog({
  dialog, workflowDraft, stageDraft, isMutatingAction,
  setWorkflowDraft, setStageDraft, closeDialog,
  submitAddWorkflow, submitEditWorkflow, submitToggleWorkflow, submitDeactivateWorkflow,
  submitEditStage, submitToggleStage, submitDeactivateStage, submitAddStage,
  stageTypeOptions, orgRoleOptions, selectedWf,
}) {
  const kind = dialog?.kind;
  const dialogTitle = useMemo(() => {
    const titles = {
      "add-workflow": "Add Workflow", "edit-workflow": "Edit Workflow",
      "toggle-workflow": `${dialog?.nextIsActive ? "Enable" : "Disable"} Workflow`,
      "deactivate-workflow": "Deactivate Workflow",
      "edit-stage": "Edit Stage", "toggle-stage": `${dialog?.nextIsActive ? "Enable" : "Disable"} Stage`,
      "deactivate-stage": "Deactivate Stage", "add-stage": "Add Stage",
    };
    return titles[kind] || "";
  }, [kind, dialog?.nextIsActive]);

  if (!kind) return null;
  const isBusy = isMutatingAction;
  const submitMap = {
    "add-workflow": submitAddWorkflow, "edit-workflow": submitEditWorkflow,
    "toggle-workflow": submitToggleWorkflow, "deactivate-workflow": submitDeactivateWorkflow,
    "edit-stage": submitEditStage, "toggle-stage": submitToggleStage,
    "deactivate-stage": submitDeactivateStage, "add-stage": submitAddStage,
  };
  const footerConfig = {
    "add-workflow": { label: "Add Workflow", variant: "success" },
    "edit-workflow": { label: "Save", variant: "primary" },
    "edit-stage": { label: "Save", variant: "primary" },
    "add-stage": { label: "Add Stage", variant: "success" },
    "toggle-workflow": { label: dialog?.nextIsActive ? "Enable" : "Disable", variant: "secondary" },
    "toggle-stage": { label: dialog?.nextIsActive ? "Enable" : "Disable", variant: "secondary" },
    "deactivate-workflow": { label: "Deactivate Workflow", variant: "warning" },
    "deactivate-stage": { label: "Deactivate Stage", variant: "warning" },
  };
  const fc = footerConfig[kind] || { label: "OK", variant: "primary" };
  const footer = (<><Button type="button" variant="ghost" onClick={closeDialog} disabled={isBusy}>Cancel</Button><Button type="button" variant={fc.variant} onClick={submitMap[kind]} loading={isBusy}>{fc.label}</Button></>);
  const isWfForm = kind === "add-workflow" || kind === "edit-workflow";
  const isStageForm = kind === "edit-stage" || kind === "add-stage";

  return (
    <Modal show onHide={closeDialog} title={dialogTitle} footer={footer}>
      {isWfForm ? (
        <div className="d-flex flex-column gap-3">
          <div><label className="form-label mb-1">Workflow Name</label><Input value={workflowDraft.name} onChange={(e) => setWorkflowDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Enter workflow name" autoFocus /></div>
          <div><label className="form-label mb-1">Description</label><Input as="textarea" rows={3} value={workflowDraft.desc} onChange={(e) => setWorkflowDraft((p) => ({ ...p, desc: e.target.value }))} placeholder="Enter workflow description" /></div>
        </div>
      ) : null}
      {isStageForm ? (
        <div className="d-flex flex-column gap-3">
          {kind === "add-stage" ? <div className="small text-muted">Creating stage for <strong>{dialog?.target?.wf_name || selectedWf?.wf_name || "selected workflow"}</strong></div> : null}
          <div><label className="form-label mb-1">Stage Name</label><Input value={stageDraft.name} onChange={(e) => setStageDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Enter stage name" autoFocus /></div>
          <div><label className="form-label mb-1">Description</label><Input as="textarea" rows={2} value={stageDraft.desc} onChange={(e) => setStageDraft((p) => ({ ...p, desc: e.target.value }))} placeholder="Enter stage description" /></div>
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label mb-1">Stage Type</label>
              <select className="form-select form-select-sm" value={stageDraft.stagetypeId} onChange={(e) => setStageDraft((p) => ({ ...p, stagetypeId: e.target.value }))}>
                <option value="">-- None --</option>
                {stageTypeOptions.map((st) => (
                  <option key={st.stagetype_id} value={st.stagetype_id}>{st.stagetype_name}</option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label mb-1">Org Role</label>
              <select className="form-select form-select-sm" value={stageDraft.orgroleId} onChange={(e) => setStageDraft((p) => ({ ...p, orgroleId: e.target.value }))}>
                <option value="">-- None --</option>
                {orgRoleOptions.map((or) => (
                  <option key={or.orgrole_id} value={or.orgrole_id}>{or.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}
      {kind === "toggle-workflow" ? <p className="mb-0">{dialog?.nextIsActive ? "Enable" : "Disable"} workflow <strong>{dialog?.target?.wf_name || ""}</strong>?</p> : null}
      {kind === "toggle-stage" ? <p className="mb-0">{dialog?.nextIsActive ? "Enable" : "Disable"} stage <strong>{dialog?.target?.stage_name || ""}</strong>?</p> : null}
      {kind === "deactivate-workflow" ? <p className="mb-0 text-danger">Deactivate workflow <strong>{dialog?.target?.wf_name || ""}</strong> and all associated stages?</p> : null}
      {kind === "deactivate-stage" ? <p className="mb-0 text-danger">Deactivate stage <strong>{dialog?.target?.stage_name || ""}</strong>?</p> : null}
    </Modal>
  );
}

// ─── MAIN VIEW (default export) ────────────────────────────

export default function WorkflowSetupView({ workflows, stages, stageTypes, orgRoles, initialSelectedWfId }) {
  const h = useWorkflowSetup({ workflows, stages, stageTypes, orgRoles, initialSelectedWfId });

  return (
    <main className="container-fluid py-4">
      <div className="d-flex align-items-center mb-3">
        <div>
          <h1 className="h3 mb-0">Workflow Configuration</h1>
          <p className="text-muted mb-0">Manage workflow tables and setup configurations.</p>
        </div>
      </div>

      <div className="setup-split-layout">
        <WorkflowSideNav />

        <div className="setup-content-pane">
          <WorkflowHeader
            hasPendingChanges={h.hasPendingChanges} pendingSummary={h.pendingSummary}
            isSavingOrder={h.isSavingOrder} isMutatingAction={h.isMutatingAction}
            handleSaveOrderChanges={h.handleSaveOrderChanges} handleCancelOrderChanges={h.handleCancelOrderChanges}
            openAddWorkflowDialog={h.openAddWorkflowDialog}
          />

          <WorkflowTable
            decoratedWorkflows={h.decoratedWorkflows} decoratedSelectedWfStages={h.decoratedSelectedWfStages}
            selectedWf={h.selectedWf} expandedWfId={h.expandedWfId}
            isSavingOrder={h.isSavingOrder} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedWfIds={h.pendingDeactivatedWfIds} pendingDeactivatedStageIds={h.pendingDeactivatedStageIds}
            handleWorkflowRowClick={h.handleWorkflowRowClick} handleWorkflowReorder={h.handleWorkflowReorder}
            editingWfId={h.editingWfId} onStartEditingWf={h.startEditingWf} onStopEditingWf={h.stopEditingWf}
            onInlineEditWf={h.handleInlineEditWorkflow}
            openToggleWorkflowDialog={h.openToggleWorkflowDialog} openDeactivateWorkflowDialog={h.openDeactivateWorkflowDialog}
            stageHardDeleteWorkflow={h.stageHardDeleteWorkflow} onUndoBatchActionWf={h.unstageHardDeleteWorkflow}
            openAddStageDialog={h.openAddStageDialog}
            editingStageId={h.editingStageId} onStartEditingStage={h.startEditingStage} onStopEditingStage={h.stopEditingStage}
            onInlineEditStage={h.handleInlineEditStage}
            openEditStageDialog={h.openEditStageDialog} openToggleStageDialog={h.openToggleStageDialog}
            openDeactivateStageDialog={h.openDeactivateStageDialog}
            stageHardDeleteStage={h.stageHardDeleteStage} onUndoBatchActionStage={h.unstageHardDeleteStage}
            stageTypeOptions={h.stageTypeOptions} orgRoleOptions={h.orgRoleOptions}
          />

          <WorkflowDialog
            dialog={h.dialog} workflowDraft={h.workflowDraft} stageDraft={h.stageDraft}
            isMutatingAction={h.isMutatingAction}
            setWorkflowDraft={h.setWorkflowDraft} setStageDraft={h.setStageDraft}
            closeDialog={h.closeDialog}
            submitAddWorkflow={h.submitAddWorkflow} submitEditWorkflow={h.submitEditWorkflow}
            submitToggleWorkflow={h.submitToggleWorkflow} submitDeactivateWorkflow={h.submitDeactivateWorkflow}
            submitEditStage={h.submitEditStage} submitToggleStage={h.submitToggleStage}
            submitDeactivateStage={h.submitDeactivateStage} submitAddStage={h.submitAddStage}
            stageTypeOptions={h.stageTypeOptions} orgRoleOptions={h.orgRoleOptions}
            selectedWf={h.selectedWf}
          />
        </div>
      </div>
    </main>
  );
}