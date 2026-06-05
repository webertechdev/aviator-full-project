import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./hooks/useAdminAuth";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import "@fontsource/orbitron";

function Guard({ children }) {
  const { admin } = useAdminAuth();
  return admin ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Guard><AdminDashboard /></Guard>} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
