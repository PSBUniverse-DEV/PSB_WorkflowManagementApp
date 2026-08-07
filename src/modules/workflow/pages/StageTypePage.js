import { loadStageTypesData } from "../data/workflow.actions.js";
import ReferenceTableView from "../components/ReferenceTableView.jsx";
import { REF_ACTIONS } from "../data/reference.data.js";

export const dynamic = "force-dynamic";

export default async function StageTypePage() {
  const { items } = await loadStageTypesData();

  const config = {
    idField: "stagetype_id",
    nameField: "stagetype_name",
    descField: "stagetype_description",
    nameLabel: "Stage Type Name",
    descLabel: "Description",
    title: "Stage Types",
    subtitle: "Manage workflow stage type reference records.",
    addLabel: "+ Add Stage Type",
    actions: REF_ACTIONS.stagetype,
  };

  return <ReferenceTableView items={items} config={config} />;
}