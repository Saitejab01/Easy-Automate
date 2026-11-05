import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SimulatedEmail } from '../api/types';
import { api } from '../api/client';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string) => Promise<{ success: boolean; error?: string; activationToken?: string; activationLink?: string }>;
  activateAccount: (token: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => void;
  simulatedEmails: SimulatedEmail[];
  refreshEmails: () => Promise<void>;
  isEmailModalOpen: boolean;
  setIsEmailModalOpen: (open: boolean) => void;
  unreadEmailCount: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'easy_automate_current_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [simulatedEmails, setSimulatedEmails] = useState<SimulatedEmail[]>([]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);

  // Initialize saved session
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) {
        const user = JSON.parse(saved);
        setCurrentUser(user);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY_USER);
    } finally {
      setIsLoading(false);
      refreshEmails();
    }
  }, []);

  const refreshEmails = async () => {
    try {
      const emails = await api.email.getSimulatedEmails();
      setSimulatedEmails(emails);
    } catch (err) {
      console.error('Failed to fetch simulated emails:', err);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(res.user));
      return { success: true };
    }
    return { success: false, error: res.error || 'Login failed' };
  };

  const register = async (email: string) => {
    const res = await api.auth.register(email);
    await refreshEmails();
    if (res.success) {
      return {
        success: true,
        activationToken: res.activationToken,
        activationLink: res.activationLink
      };
    }
    return { success: false, error: res.error || 'Registration failed' };
  };

  const activateAccount = async (token: string, password: string) => {
    const res = await api.auth.activateAccount(token, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(res.user));
      await refreshEmails();
      return { success: true, user: res.user };
    }
    return { success: false, error: res.error || 'Activation failed' };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const unreadEmailCount = simulatedEmails.filter(e => !e.read).length;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        register,
        activateAccount,
        logout,
        simulatedEmails,
        refreshEmails,
        isEmailModalOpen,
        setIsEmailModalOpen,
        unreadEmailCount
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

