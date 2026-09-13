import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import UploadPdf from './components/UploadPdf';

function AppContent() {
  const { auth, loading } = useAuth();

  if (loading) return null; // avoids a login-screen flash while checking localStorage
  if (!auth) return <Login />;
  return <UploadPdf />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
