/**
 * Sidebar navigation component.
 */

import React from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard" },
  { path: "/flags", label: "Flag Queue" },
  { path: "/metrics", label: "Model Metrics" },
];

const sidebarStyle = {
  position: "fixed",
  left: 0, top: 0, bottom: 0,
  width: "var(--sidebar-width)",
  background: "var(--color-bg-1)",
  borderRight: "1px solid var(--color-border)",
  display: "flex",
  flexDirection: "column",
  zIndex: 100,
};

const logoStyle = {
  padding: "20px 20px 16px",
  borderBottom: "1px solid var(--color-border)",
};

const logoIconStyle = {
  width: 40, height: 40,
  background: "var(--gradient-primary)",
  borderRadius: 12,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 14, marginBottom: 10,
  fontWeight: 700, color: "var(--color-text)",
};

const logoTitleStyle = {
  fontSize: 14, fontWeight: 700, color: "var(--color-text)",
  lineHeight: 1.2,
};

const logoSubStyle = {
  fontSize: 11, color: "var(--color-text-muted)", marginTop: 2,
};

const navStyle = { padding: "12px 12px", flex: 1 };

const navLinkBase = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px", borderRadius: 10,
  fontSize: 13, fontWeight: 500,
  color: "var(--color-text-muted)",
  transition: "all 0.2s",
  marginBottom: 4,
};

export default function Sidebar() {
  return (
    <aside style={sidebarStyle}>
      <div style={logoStyle}>
        <div style={logoIconStyle}>DPD</div>
        <div style={logoTitleStyle}>Dark Pattern</div>
        <div style={logoTitleStyle}>Detector</div>
        <div style={logoSubStyle}>Admin Console</div>
      </div>

      <nav style={navStyle}>
        {NAV_ITEMS.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            style={({ isActive }) => ({
              ...navLinkBase,
              ...(isActive
                ? {
                    background: "rgba(233,69,96,0.12)",
                    color: "var(--color-primary)",
                    borderLeft: "3px solid var(--color-primary)",
                    paddingLeft: 9,
                  }
                : {}),
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>API: localhost:8000</div>
        <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 2 }}>v1.0.0</div>
      </div>
    </aside>
  );
}
