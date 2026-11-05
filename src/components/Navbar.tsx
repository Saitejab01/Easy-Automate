import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bot, FolderKanban, Mail, LogOut, Plus, User as UserIcon, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onOpenCreateProject?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateProject }) => {
  const { currentUser, logout, setIsEmailModalOpen, unreadEmailCount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center space-x-6">
          <Link to={currentUser ? "/projects" : "/"} className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-100 text-base tracking-tight group-hover:text-brand-400 transition-colors">
                Easy Automate
              </span>
              <div className="flex items-center gap-1.5 -mt-0.5">
                <span className="text-[10px] text-slate-400 font-medium">Playwright + NLP</span>
                <span className="w-1 h-1 rounded-full bg-brand-500"></span>
                <span className="text-[10px] text-brand-400 font-mono">Stage 1</span>
              </div>
            </div>
          </Link>

          {currentUser && (
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-800">
              <Link
                to="/projects"
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/projects' || location.pathname.startsWith('/projects/')
                    ? 'bg-slate-800 text-brand-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <FolderKanban className="w-4 h-4" />
                <span>All Projects</span>
              </Link>
            </nav>
          )}
        </div>

        {/* Right: Actions, Mailbox preview & User Profile */}
        <div className="flex items-center space-x-3">
          {/* Email Inbox Simulator Button */}
          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="relative flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium transition-colors shadow-sm"
            title="Open In-App Email Simulator to inspect activation links"
          >
            <Mail className="w-4 h-4 text-brand-400" />
            <span className="hidden sm:inline">Simulated Inbox</span>
            {unreadEmailCount > 0 ? (
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white font-bold text-[10px] flex items-center justify-center animate-pulse">
                {unreadEmailCount}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
            )}
          </button>

          {currentUser ? (
            <>
              {onOpenCreateProject && (
                <button
                  onClick={onOpenCreateProject}
                  className="hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium shadow-sm transition-all hover:scale-[1.02]"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
              )}

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2.5 p-1.5 pl-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                    {currentUser.email.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-slate-300 max-w-[140px] truncate hidden md:inline">
                    {currentUser.email}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-slate-800">
                      <p className="text-xs text-slate-400">Signed in as</p>
                      <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">{currentUser.email}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full mt-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Active Account
                      </span>
                    </div>

                    <div className="p-1">
                      <Link
                        to="/projects"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center space-x-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <FolderKanban className="w-4 h-4 text-slate-400" />
                        <span>All Projects</span>
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          setIsEmailModalOpen(true);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span>View Sent Emails</span>
                      </button>
                    </div>

                    <div className="p-1 border-t border-slate-800">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-lg shadow-sm transition-all hover:scale-[1.02]"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
