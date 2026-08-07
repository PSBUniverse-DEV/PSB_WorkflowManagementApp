import { loadWorkflowSetupData } from "../data/workflow.actions.js";
import WorkflowSetupView from "./WorkflowSetupView.jsx";

function parseWfId(value) {
  if (value === undefined || value === null || value === "") return null;
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : String(value);
}

export default async function WorkflowSetupPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const { workflows, stages, stageTypes, orgRoles } = await loadWorkflowSetupData();
  const initialSelectedWfId = parseWfId(resolvedSearchParams?.wf) ?? workflows[0]?.wf_id ?? null;

  return (
    <WorkflowSetupView
      workflows={workflows}
      stages={stages}
      stageTypes={stageTypes}
      orgRoles={orgRoles}
      initialSelectedWfId={initialSelectedWfId}
    />
  );
}
