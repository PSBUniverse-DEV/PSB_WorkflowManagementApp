/**
 * Module Definition — workflow
 * ═══════════════════════════════════════════════════════════
 *
 * This file registers your module with PSBUniverse Core.
 * The route generator reads this to auto-create page files
 * under src/app/ when you run `npm run dev` or `npm run build`.
 *
 * ═══════════════════════════════════════════════════════════
 */
const workflowModule = {
  key: "workflow",
  module_key: "workflow",
  name: "Workflow",
  description: "Manage workflow configurations.",
  icon: "box",
  group_name: "Admin",
  group_desc: "Tools to manage the system workflows.",
  order: 200,
  routes: [
    { path: "/workflow", page: "WorkflowPage" },
    { path: "/workflow/workflows", page: "WorkflowSetupPage" },
    { path: "/workflow/stage-types", page: "StageTypePage" },
    { path: "/workflow/approval-types", page: "ApprovalTypePage" },
    { path: "/workflow/org-roles", page: "OrgRolePage" },
    { path: "/workflow/stage-participants", page: "StageParticipantPage" },
    { path: "/workflow/user-org-roles", page: "UserOrgRolePage" },
  ],
};

export default workflowModule;
