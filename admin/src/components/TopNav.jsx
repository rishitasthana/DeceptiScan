import React, { useState, useRef, useEffect } from "react";

export default function TopNav() {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const notifRef = useRef();
  const profileRef = useRef();

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
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
        {/* Notifications */}
        <div style={{ position: "relative" }} ref={notifRef}>
          <button 
            onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: showNotifs ? "var(--bg-hover)" : "var(--bg-card)", color: "var(--text-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, cursor: "pointer", transition: "all 0.2s"
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-hover)"; }}
            onMouseOut={(e) => { if(!showNotifs) { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "var(--bg-card)"; } }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            <span style={{ position: "absolute", top: 8, right: 10, width: 8, height: 8, background: "var(--critical)", borderRadius: "50%" }}></span>
          </button>
          
          {showNotifs && (
            <div style={{
              position: "absolute", top: 56, right: 0, width: 320,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              zIndex: 100, overflow: "hidden"
            }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>Important Notifications</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: "var(--bg-hover)" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>System Update Complete</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>The backend scanning engine was updated successfully.</div>
                </div>
                <div style={{ padding: "12px 20px", cursor: "pointer" }} onMouseOver={(e) => e.currentTarget.style.background="var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background="transparent"}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>High Risk Domain Detected</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>A scan on an unknown domain resulted in a 8.5/10 risk score.</div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Avatar */}
        <div style={{ position: "relative" }} ref={profileRef}>
          <button 
            onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#333", overflow: "hidden",
              border: "2px solid", borderColor: showProfile ? "var(--primary)" : "var(--border)", padding: 0,
              cursor: "pointer", transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onMouseOut={(e) => { if(!showProfile) e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <img 
              src="https://api.dicebear.com/7.x/notionists/svg?seed=Admin" 
              alt="Profile" 
              style={{ width: "100%", height: "100%", objectFit: "cover", background: "#f0f0f0" }}
            />
          </button>
          
          {showProfile && (
            <div style={{
              position: "absolute", top: 56, right: 0, width: 220,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              zIndex: 100, padding: 8
            }}>
              <div style={{ padding: "12px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Admin User</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>admin@deceptiscan.com</div>
              </div>
              <div style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderRadius: 4 }} onMouseOver={(e) => e.currentTarget.style.background="var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background="transparent"}>My Account</div>
              <div style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderRadius: 4 }} onMouseOver={(e) => e.currentTarget.style.background="var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background="transparent"}>API Keys</div>
              <div style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderRadius: 4, color: "var(--critical)", marginTop: 4, borderTop: "1px solid var(--border)" }} onMouseOver={(e) => e.currentTarget.style.background="var(--bg-hover)"} onMouseOut={(e) => e.currentTarget.style.background="transparent"}>Log out</div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
