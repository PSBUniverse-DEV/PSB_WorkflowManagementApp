import { loadApprovalTypesData } from "../data/workflow.actions.js";
import ReferenceTableView from "../components/ReferenceTableView.jsx";
import { REF_ACTIONS } from "../data/reference.data.js";

export const dynamic = "force-dynamic";

export default async function ApprovalTypePage() {
  const { items } = await loadApprovalTypesData();

  const config = {
    idField: "approvaltype_id",
    nameField: "approvaltype_name",
    descField: "approvaltype_description",
    nameLabel: "Approval Type Name",
    descLabel: "Description",
    title: "Approval Types",
    subtitle: "Manage workflow approval type reference records.",
    addLabel: "+ Add Approval Type",
    actions: REF_ACTIONS.approvaltype,
  };

  return <ReferenceTableView items={items} config={config} />;
}