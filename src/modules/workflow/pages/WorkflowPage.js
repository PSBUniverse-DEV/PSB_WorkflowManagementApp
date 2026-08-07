/**
 * Server Component — WorkflowPage.js
 *
 * Runs on the server. Loads data, then passes it to the View.
 *
 * WHAT TO DO:
 *   1. Import your load function from "../data/workflow.actions"
 *   2. Call it with `await`
 *   3. Pass the result as props to WorkflowView
 *
 * RULES:
 *   - No useState, useEffect, or onClick here — those go in the View.
 *   - Do NOT wrap JSX in try/catch (causes a React lint error).
 *
 * SSO NOTE:
 *   This page is a server component. Session validation happens
 *   on the client side in the View via useAuth() or in API routes
 *   via withModuleAuth(). If you need server-side session data,
 *   use getCurrentSession() from "@/core/auth/session.service".
 */
import WorkflowView from "./WorkflowView";
// import { loadWorkflowData } from "../data/workflow.actions";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  // TODO: Load your data here
  // const { items } = await loadWorkflowData();

  return <WorkflowView />;
}
