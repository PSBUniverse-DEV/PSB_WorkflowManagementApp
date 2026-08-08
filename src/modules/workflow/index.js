/**
 * Module Definition — workflow
 * ═══════════════════════════════════════════════════════════
 *
 * This file registers your module with PSBUniverse Core.
 * The route generator reads this to auto-create page files
 * under src/app/ when you run `npm run dev` or `npm run build`.
 *
 * All workflow configuration tables are consolidated into a single
 * /workflow page with tabbed sections (see WorkflowView).
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
  ],
};

export default workflowModule;