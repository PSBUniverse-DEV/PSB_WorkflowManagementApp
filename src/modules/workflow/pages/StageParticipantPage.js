import { loadStageParticipantsData } from "../data/workflow.actions.js";
import MappingTableView from "../components/MappingTableView.jsx";
import { REF_ACTIONS } from "../data/reference.data.js";

export const dynamic = "force-dynamic";

export default async function StageParticipantPage() {
  const { items, stages, orgRoles, approvalTypes } = await loadStageParticipantsData();

  const config = {
    idField: "stageparticipant_id",
    title: "Stage Participants",
    subtitle: "Map approval participants to workflow stages.",
    addLabel: "+ Add Participant",
    actions: REF_ACTIONS.stageparticipant,
    selectColumns: [
      {
        field: "wfs_id",
        label: "Stage",
        required: true,
        width: "30%",
        options: (Array.isArray(stages) ? stages : []).map((s) => ({ value: s.wfs_id, label: s.stage_name })),
      },
      {
        field: "orgrole_id",
        label: "Org Role",
        required: false,
        width: "24%",
        options: (Array.isArray(orgRoles) ? orgRoles : []).map((r) => ({ value: r.orgrole_id, label: r.name })),
      },
      {
        field: "approvaltype_id",
        label: "Approval Type",
        required: false,
        width: "24%",
        options: (Array.isArray(approvalTypes) ? approvalTypes : []).map((a) => ({ value: a.approvaltype_id, label: a.approvaltype_name })),
      },
    ],
  };

  return <MappingTableView items={items} config={config} />;
}