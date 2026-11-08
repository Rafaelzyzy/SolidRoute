import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Adoption from './pages/Adoption';
import Team from './pages/Team';
import Sidebar from './components/Sidebar';

// Componente para proteger rotas
const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? (
    <div className="flex h-screen bg-darkerBox text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto p-8">
        {children}
      </div>
    </div>
  ) : <Navigate to="/login" />;
};

function AppRoutes() {
  const { user } = useContext(AuthContext);
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/adopt" element={<PrivateRoute><Adoption /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute><Team /></PrivateRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
