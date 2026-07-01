/**
 * TopNav — horizontal navigation bar matching the ShieldCheck Stitch design.
 * Includes logo, tab links, theme toggle, and avatar.
 */

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_TABS = [
  { path: "/",        label: "Dashboard" },
  { path: "/history", label: "Scan History" },
  { path: "/flags",   label: "Flag Queue" },
  { path: "/metrics", label: "Model Metrics" },
];

/**
 * @param {object} props
 * @param {"light"|"dark"} props.theme - Current theme.
 * @param {Function} props.onThemeToggle - Toggle callback.
 */
export default function TopNav({ theme, onThemeToggle }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header className="topnav">
      {/* Logo */}
      <div className="topnav-logo">
        <div className="topnav-logo-icon" style={{ fontSize: 12, fontWeight: 800, color: "white" }}>SC</div>
        <span className="topnav-logo-name">ShieldCheck</span>
      </div>

      {/* Tab navigation */}
      <nav className="topnav-tabs">
        {NAV_TABS.map(({ path, label }) => {
          const isActive =
            path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
          return (
            <button
              key={path}
              className={`topnav-tab${isActive ? " active" : ""}`}
              onClick={() => navigate(path)}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* Right section */}
      <div className="topnav-right">
        {/* Light / Dark toggle */}
        <div className="theme-toggle" title="Toggle theme" style={{ borderRadius: 8 }}>
          <button
            className={`theme-toggle-btn${theme === "light" ? " active" : ""}`}
            onClick={() => onThemeToggle("light")}
            aria-label="Light mode"
            style={{ fontSize: 11, width: "auto", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}
          >
            Light
          </button>
          <button
            className={`theme-toggle-btn${theme === "dark" ? " active" : ""}`}
            onClick={() => onThemeToggle("dark")}
            aria-label="Dark mode"
            style={{ fontSize: 11, width: "auto", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}
          >
            Dark
          </button>
        </div>

        {/* Avatar */}
        <div className="topnav-avatar" title="Admin user">AD</div>
      </div>
    </header>
  );
}
