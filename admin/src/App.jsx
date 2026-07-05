/**
 * Root App component with routing, layout, and global theme state.
 * Renders the top navigation matching the ShieldCheck Stitch design.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TopNav from "./components/TopNav";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import ScanHistory from "./pages/ScanHistory";
import FlagQueue from "./pages/FlagQueue";
import ModelMetrics from "./pages/ModelMetrics";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <TopNav />
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
      </div>
    </BrowserRouter>
  );
}
