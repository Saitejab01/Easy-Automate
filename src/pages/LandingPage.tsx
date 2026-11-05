import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Play, Sparkles, FolderKanban, ShieldCheck, Terminal, ArrowRight, CheckCircle2, Cpu, FileCode2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8 border-b border-slate-900">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-brand-600/20 via-indigo-500/15 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Release Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-brand-400 font-medium mb-8 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>Easy Automate • Stage 1 Release</span>
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            <span className="text-slate-400 font-mono">Playwright + NLP Architecture</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6">
            Autonomous Web Testing with{' '}
            <span className="bg-gradient-to-r from-brand-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              Natural Language & Playwright
            </span>
          </h1>

          {/* Subtitle */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed mb-10">
            Write natural-language instructions, manage multi-user projects, and execute robust browser automation scripts powered by Playwright with TypeScript.
          </p>

          {/* Call to Actions (Requirements 2.1: Login & Register options) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {currentUser ? (
              <Link
                to="/projects"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02]"
              >
                <FolderKanban className="w-4 h-4" />
                <span>Go to My Projects ({currentUser.email})</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02]"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Log In to Workspace</span>
                </Link>
                <Link
                  to="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-all hover:border-slate-600"
                >
                  <Bot className="w-4 h-4 text-brand-400" />
                  <span>Create Account (Register)</span>
                </Link>
              </>
            )}
          </div>

          {/* Quick Demo Preview Box */}
          <div className="mt-14 max-w-3xl mx-auto rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-2xl text-left font-mono text-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 text-slate-400">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
                <span className="text-[11px] text-slate-500 ml-2">nlp-to-playwright-orchestrator.ts</span>
              </div>
              <span className="text-[11px] text-brand-400">Playwright + TypeScript</span>
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex items-center gap-2 text-brand-400">
                <span className="text-slate-600">// 1. Natural Language Instruction:</span>
              </div>
              <p className="text-amber-300 bg-amber-950/30 p-2 rounded border border-amber-800/30">
                "Login to the application using valid credentials and verify that the dashboard is displayed."
              </p>
              <div className="flex items-center gap-2 text-brand-400 pt-2">
                <span className="text-slate-600">// 2. Compiled Playwright Action Steps:</span>
              </div>
              <p className="text-slate-400">
                await page.goto('/login');<br />
                await page.getByLabel('Email').fill('user@enterprise.com');<br />
                await page.getByLabel('Password').fill('••••••••');<br />
                await page.getByRole('button', &#123; name: 'Log in' &#125;).click();<br />
                await expect(page.getByRole('heading', &#123; name: 'Dashboard' &#125;)).toBeVisible();
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-2xl font-bold text-white tracking-tight">Stage 1 Features & Architecture</h2>
          <p className="text-sm text-slate-400 mt-2">
            Secure multi-user authentication, verified email activation flow, and dedicated project workspaces.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 hover:border-brand-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Secure Email Activation</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Users register with valid email, receive a secure activation link, and initialize their password with strict 5-point credential rules.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5">
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Format & duplicate email validation</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Local simulated mailbox receiver</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Bcrypt cryptographic password hashing</span>
              </li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 hover:border-brand-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Multi-Project Management</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Two levels of project navigation: All Projects list and dedicated Individual Project pages with independent environments.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5">
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Strict project name validation</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Dedicated project route & details</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>User data isolation & persistence</span>
              </li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 hover:border-brand-500/30 transition-all">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Playwright + NLP Foundation</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Engineered with TypeScript, Playwright, and Zod action structures to translate user instructions into headless browser execution.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5">
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Chromium, Firefox, WebKit ready</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Queue worker architecture</span>
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Local Electron desktop experience</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 py-6 px-4 text-center text-xs text-slate-500">
        <p>Easy Automate © 2026. Built with React, Vite, TypeScript, Electron, and Playwright.</p>
      </footer>
    </div>
  );
};

