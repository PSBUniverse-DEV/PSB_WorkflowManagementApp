import { loadUserOrgRolesData } from "../data/workflow.actions.js";
import MappingTableView from "../components/MappingTableView.jsx";
import { REF_ACTIONS } from "../data/reference.data.js";

export const dynamic = "force-dynamic";

export default async function UserOrgRolePage() {
  const { items, orgRoles, users } = await loadUserOrgRolesData();

  const getUserLabel = (user) => {
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
    return fullName ? `${fullName} (${user?.username || ""})` : (user?.username || "Unknown");
  };

  const config = {
    idField: "user_orgrole_id",
    title: "User Org Roles",
    subtitle: "Map users to organizational roles.",
    addLabel: "+ Add User Role",
    actions: REF_ACTIONS.userorgrole,
    selectColumns: [
      {
        field: "user_id",
        label: "User",
        required: true,
        width: "36%",
        options: (Array.isArray(users) ? users : []).map((u) => ({ value: u.user_id, label: getUserLabel(u) })),
      },
      {
        field: "role_id",
        label: "Org Role",
        required: true,
        width: "34%",
        options: (Array.isArray(orgRoles) ? orgRoles : []).map((r) => ({ value: r.orgrole_id, label: r.name })),
      },
    ],
    booleanColumns: [
      {
        key: "is_primary",
        field: "is_primary",
        label: "Primary",
        width: "10%",
        align: "center",
      },
    ],
  };

  return <MappingTableView items={items} config={config} />;
}