import React from "react";

export default function TopNav() {
  return (
    <header style={{
      height: "var(--nav-h)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 8px",
      flexShrink: 0,
    }}>
      {/* Search Bar */}
      <div style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: 320,
      }}>
        <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </span>
        <input 
          type="text" 
          placeholder="Search anything..." 
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontSize: 14,
            width: "100%"
          }}
        />
      </div>

      {/* Right Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "var(--bg-card)", color: "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        </button>
        <button style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "var(--bg-card)", color: "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        </button>
        
        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "#333", overflow: "hidden",
          border: "2px solid var(--border)"
        }}>
          <img 
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Admin" 
            alt="Profile" 
            style={{ width: "100%", height: "100%", objectFit: "cover", background: "#f0f0f0" }}
          />
        </div>

        {/* Create Button */}
        <button style={{
          background: "var(--text-primary)",
          color: "var(--bg-card)",
          padding: "12px 24px",
          borderRadius: 24,
          fontWeight: 600,
          fontSize: 14,
          marginLeft: 8,
          transition: "transform 0.2s",
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          Create
        </button>
      </div>
    </header>
  );
}
