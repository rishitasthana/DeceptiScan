/**
 * Root App component with routing, layout, and global theme state.
 * Renders the top navigation matching the ShieldCheck Stitch design.
 */

import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TopNav from "./components/TopNav";
import Dashboard from "./pages/Dashboard";
import ScanHistory from "./pages/ScanHistory";
import FlagQueue from "./pages/FlagQueue";
import ModelMetrics from "./pages/ModelMetrics";

export default function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <TopNav theme={theme} onThemeToggle={setTheme} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<ScanHistory />} />
            <Route path="/flags" element={<FlagQueue />} />
            <Route path="/metrics" element={<ModelMetrics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
