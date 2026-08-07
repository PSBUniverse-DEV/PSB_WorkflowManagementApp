"use client";

import { usePathname } from "next/navigation";

export const WORKFLOW_NAV_ITEMS = [
  { key: "workflows", label: "Workflows", path: "/workflow/workflows", icon: "diagram-3" },
  { key: "stage-types", label: "Stage Types", path: "/workflow/stage-types", icon: "list" },
  { key: "approval-types", label: "Approval Types", path: "/workflow/approval-types", icon: "check-circle" },
  { key: "org-roles", label: "Org Roles", path: "/workflow/org-roles", icon: "people" },
  { key: "stage-participants", label: "Stage Participants", path: "/workflow/stage-participants", icon: "person-badge" },
  { key: "user-org-roles", label: "User Org Roles", path: "/workflow/user-org-roles", icon: "person-lines-fill" },
];

export default function WorkflowSideNav() {
  const pathname = usePathname();
  return (
    <aside className="setup-side-nav" aria-label="Workflow configuration">
      <p className="setup-side-nav-label">WORKFLOW SETUP</p>
      <div className="setup-side-nav-list">
        {WORKFLOW_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          return (
            <a key={item.key} href={item.path}
              className={`setup-side-nav-item${isActive ? " is-active" : ""}`}>
              <span className="setup-side-nav-item-main">
                <span className="setup-side-nav-item-title">{item.label}</span>
              </span>
              <span className="setup-side-nav-item-end">
                <i className="fa-solid fa-chevron-right fa-xs" aria-hidden="true" />
              </span>
            </a>
          );
        })}
      </div>
    </aside>
  );
}