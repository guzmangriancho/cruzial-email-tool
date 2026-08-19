import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";

import CRMPage from "./pages/CRMPage";
import ScraperPage from "./pages/ScraperPage";
import CampanasPage from "./pages/CampanasPage";
import SegmentosPage from "./pages/SegmentosPage";
import AjustesPage from "./pages/AjustesPage";
import MapaPage from "./pages/MapaPage";
import { DialogProvider } from "./components/ui";
import { AppLayout } from "./components/layout/Sidebar";
import { ThemeProvider } from "./theme/ThemeProvider";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <DialogProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/clientes" replace />} />
              <Route path="/buscar" element={<ScraperPage />} />
              <Route path="/clientes" element={<CRMPage />} />
              <Route path="/mapa" element={<MapaPage />} />
              <Route path="/segmentos" element={<SegmentosPage />} />
              <Route path="/campanas" element={<CampanasPage />} />
              <Route path="/configuracion" element={<AjustesPage />} />

              {/* Alias para accesos directos de la versión anterior. */}
              <Route path="/crm" element={<Navigate to="/clientes" replace />} />
              <Route path="/scraper" element={<Navigate to="/buscar" replace />} />
              <Route path="/ajustes" element={<Navigate to="/configuracion" replace />} />
              <Route path="*" element={<Navigate to="/clientes" replace />} />
            </Route>
          </Routes>
        </DialogProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
