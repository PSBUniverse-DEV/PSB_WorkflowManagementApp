/**
 * Module Definition — workflow
 * ═══════════════════════════════════════════════════════════
 *
 * This file registers your module with PSBUniverse Core.
 * The route generator reads this to auto-create page files
 * under src/app/ when you run `npm run dev` or `npm run build`.
 *
 * ───────────────────────────────────────────────────────────
 * SETUP CHECKLIST — Verify these are done before your PR
 * ───────────────────────────────────────────────────────────
 *
 * FILES (auto-created by create-module script):
 *   ☐ src/modules/workflow/index.js             ← You are here
 *   ☐ src/modules/workflow/pages/WorkflowPage.js              ← Server component (loads data)
 *   ☐ src/modules/workflow/pages/WorkflowView.jsx             ← Client component (all UI)
 *   ☐ src/modules/workflow/data/workflow.actions.js  ← Server Actions (DB queries)
 *   ☐ src/modules/workflow/data/workflow.data.js     ← Client helpers (forms, constants)
 *
 * AUTO-GENERATED (do NOT edit — created on npm run dev/build):
 *   ☐ src/app/workflow/page.js       ← Route wrapper
 *   ☐ src/app/rewrites.json                     ← URL rewrites (if psbpages/)
 *
 * DATABASE SETUP (manual — ask senior dev if unsure):
 *   ☐ psb_s_application  → Ensure your app exists (module_key must match below)
 *   ☐ psb_s_appcard      → Add card with route_path = "/workflow"
 *   ☐ psb_m_appcardgroup → Add/use a group for your cards
 *   ☐ psb_m_appcardroleaccess → Assign roles that can see this card
 *   ☐ psb_s_role          → Ensure roles exist for your app
 *   ☐ psb_m_userapproleaccess → Assign users to roles for testing
 *
 * SSO SETUP (centralized authentication):
 *   ☐ Module is registered in psb_s_application with a unique app_id
 *   ☐ API routes use withModuleAuth("WORKFLOW", handler)
 *   ☐ Client pages validate session via validateSessionToken() or useAuth()
 *   ☐ .env.local has NEXT_PUBLIC_COOKIE_DOMAIN set (e.g. .psbuniverse.com)
 *
 * HOW TO VERIFY EVERYTHING WORKS:
 *   1. Run `npm run dev`
 *   2. Open http://localhost:3000/workflow
 *   3. You should see "Workflow" heading with "This page is ready."
 *   4. If 404 → check that src/app/workflow/page.js exists (run npm run gen:routes)
 *   5. If "No Access" → check your role mappings in the database
 *   6. If module not on dashboard → check psb_s_appcard has this route_path
 *
 * UPDATING ROUTES:
 *   If you change the path below, just run `npm run dev` or `npm run build`.
 *   The old page wrapper is auto-deleted and a new one is created.
 *   But you MUST also update psb_s_appcard.route_path in the database.
 *
 * DOCS:
 *   - docs/02-architecture/module-system.md
 *   - docs/08-junior-dev-guide/module-creation-checklist.md
 *   - docs/09-sso-architecture/README.md
 * ═══════════════════════════════════════════════════════════
 */
const workflowModule = {
  key: "workflow",
  module_key: "psbuniverse",          // ← change to your app key from Application Setup
  name: "Workflow",
  description: "TODO: Describe what this module does.",
  icon: "box",                        // ← pick from https://fontawesome.com/search?o=r&m=free
  group_name: "TODO: Pick a sidebar group",
  group_desc: "TODO: Describe this group",
  order: 200,                         // ← adjust to control sidebar position
  routes: [
    { path: "/workflow", page: "WorkflowPage" },
  ],
};

export default workflowModule;
