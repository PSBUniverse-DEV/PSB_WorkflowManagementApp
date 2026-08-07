import { loadOrgRolesData } from "../data/workflow.actions.js";
import ReferenceTableView from "../components/ReferenceTableView.jsx";
import { REF_ACTIONS } from "../data/reference.data.js";

export const dynamic = "force-dynamic";

export default async function OrgRolePage() {
  const { items } = await loadOrgRolesData();

  const config = {
    idField: "orgrole_id",
    nameField: "name",
    descField: "description",
    nameLabel: "Org Role Name",
    descLabel: "Description",
    title: "Org Roles",
    subtitle: "Manage organizational role reference records.",
    addLabel: "+ Add Org Role",
    actions: REF_ACTIONS.orgrole,
  };

  return <ReferenceTableView items={items} config={config} />;
}