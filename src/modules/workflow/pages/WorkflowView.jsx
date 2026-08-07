/**
 * Client Component — WorkflowView.jsx
 *
 * Runs in the browser. All UI, hooks, and interaction go here.
 *
 * PATTERN:
 *   1. Create a custom hook (useWorkflow) at the top for state & logic.
 *   2. In the default export, call the hook and render your UI.
 *   3. Import helpers from "../data/workflow.data" (forms, mappers, constants).
 *   4. Import server actions from "../data/workflow.actions" (save, delete).
 *   5. Use shared UI from "@/shared/components/ui/" (TableZ, Card, Modal, etc).
 *
 * SSO AUTHENTICATION:
 *   - Use useAuth() from "@/core/auth/useAuth" to get current user session
 *   - Session is automatically validated via the psb_session cookie
 *   - If not authenticated, the AuthProvider handles redirect to login
 *   - For API calls, the cookie is sent automatically with credentials: "include"
 */
"use client";

// import { useAuth } from "@/core/auth/useAuth";

export default function WorkflowView(/* { items } */) {
  // const { authUser, dbUser, roles, loading } = useAuth();

  return (
    <main className="container py-4">
      <h2>Workflow</h2>
      <p className="text-muted">This page is ready for development.</p>
    </main>
  );
}
