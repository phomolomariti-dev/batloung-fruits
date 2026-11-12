import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Catalog from './pages/Catalog';
import Stock from './pages/Stock';
import Suppliers from './pages/Suppliers';
import Vendors from './pages/Vendors';
import Orders from './pages/Orders';
import Reports from './pages/Reports';
import Architecture from './pages/Architecture';
import Legal from './pages/Legal';
import Register from './pages/Register';
import Users from './pages/Users';
import AuthCallback from './pages/AuthCallback';

function Protected({ adminOnly, children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="p-10 text-center text-outline">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
      <Route path="/legal/:slug" element={<Legal />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="stock" element={<Protected adminOnly><Stock /></Protected>} />
        <Route path="suppliers" element={<Protected adminOnly><Suppliers /></Protected>} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="orders" element={<Orders />} />
        <Route path="reports" element={<Protected adminOnly><Reports /></Protected>} />
 <Route path="users" element={<Protected adminOnly><Users /></Protected>} />
        <Route path="architecture" element={<Architecture />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
