import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TitleBar } from './components/TitleBar';
import { Navbar } from './components/Navbar';
import { EmailSimulatorModal } from './components/EmailSimulatorModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ActivationPage } from './pages/ActivationPage';
import { AllProjectsPage } from './pages/AllProjectsPage';
import { IndividualProjectPage } from './pages/IndividualProjectPage';

const AppContent: React.FC = () => {
  const { currentUser } = useAuth();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const location = useLocation();

  // Show Navbar on all pages
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Electron custom titlebar */}
      <TitleBar />

      {/* Main App Navbar */}
      <Navbar onOpenCreateProject={() => setIsCreateProjectOpen(true)} />

      {/* Routes */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/activate" element={<ActivationPage />} />
          <Route path="/projects" element={<AllProjectsPage />} />
          <Route path="/projects/:id" element={<IndividualProjectPage />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Global In-App Mailbox Simulator Modal */}
      <EmailSimulatorModal />

      {/* Global Create Project Modal */}
      {currentUser && (
        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
          userId={currentUser.id}
          onProjectCreated={() => {
            // Trigger refresh
            if (location.pathname === '/projects') {
              window.location.reload();
            }
          }}
        />
      )}
    </div>
  );
};

export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HashRouter>
  );
}

export default App;

