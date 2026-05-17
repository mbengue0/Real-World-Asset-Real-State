import { useState } from "react";
import { Header, type View } from "./components/Header";
import { Catalogue } from "./pages/Catalogue";
import { Dashboard } from "./pages/Dashboard";
import { PropertyDetail } from "./pages/PropertyDetail";
import { Admin } from "./pages/Admin";
import "./App.css";

export default function App() {
  const [view, setView] = useState<View>("catalogue");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);

  function openDetail(id: number) {
    setSelectedPropertyId(id);
    setView("detail");
  }

  function backToCatalogue() {
    setView("catalogue");
  }

  return (
    <div className="app">
      <Header view={view} onViewChange={setView} />
      <main className="container">
        {view === "catalogue" && <Catalogue onSelectProperty={openDetail} />}
        {view === "dashboard" && <Dashboard />}
        {view === "detail" && selectedPropertyId !== null && (
          <PropertyDetail propertyId={selectedPropertyId} onBack={backToCatalogue} />
        )}
        {view === "admin" && <Admin />}
      </main>
      <footer className="footer">
        <span>DAUST Spring 2026 · Blockchain & Web3 Final Project</span>
      </footer>
    </div>
  );
}
