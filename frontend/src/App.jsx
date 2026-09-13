import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import UploadPdf from './components/UploadPdf';
import ReviewQueue from './components/ReviewQueue';
import ReviewDetail from './components/ReviewDetail';
import PassengerSearch from './components/PassengerSearch';
import Analytics from './components/Analytics';
import NavBar from './components/NavBar';

function AppContent() {
  const { auth, loading } = useAuth();

  if (loading) return null; // avoids a login-screen flash while checking localStorage
  if (!auth) return <Login />;

  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/upload" element={<UploadPdf />} />
        <Route path="/review" element={<ReviewQueue />} />
        <Route path="/review/:id" element={<ReviewDetail />} />
        <Route path="/passengers" element={<PassengerSearch />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*" element={<Navigate to="/upload" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
