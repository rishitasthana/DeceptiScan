import React, { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { 
    path: "/", 
    label: "Overview", 
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
  },
  { 
    path: "/history", 
    label: "Scan History", 
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
  },
  { 
    path: "/flags", 
    label: "Flag Queue", 
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>, 
    badge: 3 
  },
  { 
    path: "/metrics", 
    label: "Model Metrics", 
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>, 
    badge: 8 
  },
];

export default function Sidebar() {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside style={{
      width: "var(--sidebar-w)",
      background: "var(--bg-card)",
      borderRadius: "var(--radius-lg)",
      display: "flex",
      flexDirection: "column",
      padding: "24px 20px",
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40, padding: "0 8px" }}>
        <div style={{
          width: 36, height: 36,
          background: "linear-gradient(135deg, #333 0%, #111 100%)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid #333"
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5, color: "var(--text-primary)" }}>DeceptiScan</span>
      </div>

      {/* Navigation */}
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, padding: "0 8px", fontWeight: 600 }}>
        Dashboard
      </div>
      
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              background: isActive ? "var(--bg-active)" : "transparent",
              transition: "all 0.2s",
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: isActive ? 1 : 0.6 
                }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    background: isActive ? "var(--accent-transparent)" : "var(--bg-active)",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }} ref={settingsRef}>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: "50%",
            background: showSettings ? "var(--bg-hover)" : "var(--bg-active)", color: showSettings ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: "pointer", transition: "all 0.2s"
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.transform = "rotate(45deg)"; }}
          onMouseOut={(e) => { if(!showSettings) { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.transform = "rotate(0deg)"; } }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
        
        {showSettings && (
          <div style={{
            position: "absolute", bottom: 0, left: 56, width: 240,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            zIndex: 100, padding: 8
          }}>
            <div style={{ padding: "12px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Preferences</div>
            </div>
            <div style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderRadius: 4, display: "flex", justifyContent: "space-between" }} onMouseOver={(e) => e.currentTarget.style.background="var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background="transparent"}>
              <span>Dark Mode</span>
              <span style={{ color: "var(--accent)" }}>On</span>
            </div>
            <div style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderRadius: 4 }} onMouseOver={(e) => e.currentTarget.style.background="var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background="transparent"}>Notification Settings</div>
            <div style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderRadius: 4 }} onMouseOver={(e) => e.currentTarget.style.background="var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background="transparent"}>Manage API Keys</div>
            <div style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderRadius: 4 }} onMouseOver={(e) => e.currentTarget.style.background="var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background="transparent"}>System Status</div>
          </div>
        )}
      </div>
    </aside>
  );
}
