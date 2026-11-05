import React from 'react';
import {
  FileSpreadsheet,
  FileCode,
  PlayCircle,
  Layers,
  Sparkles,
  Cpu,
  Clock,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Database
} from 'lucide-react';

interface PlaceholderViewProps {
  section: 'test-data' | 'scripts' | 'execution' | 'suites';
  projectName: string;
}

export const PlaceholderView: React.FC<PlaceholderViewProps> = ({ section, projectName }) => {
  const configs = {
    'test-data': {
      title: 'Test Data Management',
      subtitle: 'Data-driven automation engine for Excel and structured datasets',
      badge: 'Stage 3 Feature',
      icon: FileSpreadsheet,
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      description:
        'Upload, manage, and parameterize test data files directly within your project workspace. Seamlessly feed dynamic variables into Playwright automation scripts.',
      features: [
        'Excel Spreadsheet Support (.xlsx and .xls)',
        'Data-driven parameter mapping for dynamic Repository locators',
        'Multiple environment-specific datasets (Dev, Staging, Prod)',
        'CSV and JSON dataset import & export',
        'In-browser tabular data editor with row validation'
      ],
      codeSnippet: `// Planned Data-Driven Playwright Execution
import { test } from '@playwright/test';
import { loadExcelData } from '@easy-automate/data-loader';

const records = loadExcelData('./test-data/users.xlsx');
for (const row of records) {
  test(\`Login Flow for \${row.username}\`, async ({ page }) => {
    await page.locator('#email').fill(row.email);
    await page.locator('#password').fill(row.password);
  });
}`
    },
    scripts: {
      title: 'TestDev – Automation Scripts',
      subtitle: 'Playwright TypeScript script editor with natural language synthesis',
      badge: 'Stage 3 Feature',
      icon: FileCode,
      iconColor: 'text-brand-400',
      bgColor: 'bg-brand-500/10',
      borderColor: 'border-brand-500/20',
      description:
        'Compose, organize, and edit robust Playwright automation scripts. Bind UI steps directly to centralized Repository elements or generate full test sequences from natural language instructions.',
      features: [
        'Interactive Natural Language (NLP) to Playwright synthesis',
        'Repository Element integration with autocompletion',
        'TypeScript syntax highlighting & static type analysis',
        'Reusable Page Object Model (POM) step templates',
        'Visual assertion builder and step sequencing'
      ],
      codeSnippet: `// Auto-Generated from NLP Instruction:
// "Login to storefront and verify checkout button is enabled"
import { test, expect } from '@playwright/test';
import { Repository } from './easy-automate.repo';

test('Storefront Checkout Smoke', async ({ page }) => {
  await page.locator(Repository.LoginPage.EmailField).fill('user@demo.com');
  await page.locator(Repository.LoginPage.LoginButton).click();
  await expect(page.locator(Repository.CartPage.CheckoutButton)).toBeEnabled();
});`
    },
    execution: {
      title: 'TestDev – Script Execution',
      subtitle: 'Asynchronous Playwright worker runner powered by BullMQ & Redis',
      badge: 'Stage 4 Feature',
      icon: PlayCircle,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      description:
        'Execute automation scripts across Chromium, Firefox, and WebKit browsers. Monitor live execution progress, terminal logs, interactive step traces, and automatic failure screenshots.',
      features: [
        'Background execution worker decoupled from UI thread',
        'Parallel browser execution (Chromium, Firefox, WebKit)',
        'Live streaming console logs and step-by-step progress',
        'Automatic failure screenshot & video recording capture',
        'Playwright trace viewer integration for deep debugging'
      ],
      codeSnippet: `// Execution Worker Queue Job Spec
{
  "jobId": "exec_job_9182",
  "project": "${projectName}",
  "browser": "chromium",
  "headless": true,
  "workers": 4,
  "retries": 1,
  "artifacts": {
    "screenshots": "only-on-failure",
    "video": "retain-on-failure",
    "trace": "on-first-retry"
  }
}`
    },
    suites: {
      title: 'Test Suites Orchestration',
      subtitle: 'Organize, schedule, and execute grouped automation suites',
      badge: 'Stage 4 Feature',
      icon: Layers,
      iconColor: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      description:
        'Aggregate individual scripts into comprehensive Smoke, Regression, and Sanity test suites. Schedule automated runs and view consolidated Allure execution reports.',
      features: [
        'Visual suite grouping (Smoke, Regression, End-to-End)',
        'Execution dependency management and priority tagging',
        'Scheduled recurring suite runs (Cron / CI triggers)',
        'Consolidated Allure & HTML test reports',
        'Webhook & Slack failure notification alerts'
      ],
      codeSnippet: `// Test Suite Definition
export const RegressionSuite = {
  name: "Nightly Regression Suite",
  tags: ["@regression", "@smoke"],
  concurrency: 4,
  browsers: ["chromium", "firefox", "webkit"],
  scripts: [
    "user-registration.spec.ts",
    "cart-checkout.spec.ts",
    "payment-gateway.spec.ts"
  ]
};`
    }
  };

  const current = configs[section];
  const Icon = current.icon;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl ${current.bgColor} border ${current.borderColor} flex items-center justify-center ${current.iconColor} shadow-md`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${current.iconColor} ${current.bgColor} px-2.5 py-0.5 rounded-full border ${current.borderColor}`}>
                  {current.badge}
                </span>
                <span className="text-xs text-slate-500 font-mono">Navigation Placeholder</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{current.title}</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">{current.subtitle}</p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl px-5 py-3.5 text-xs text-slate-400 space-y-1">
            <span className="text-[11px] text-slate-500 block">Workspace Target:</span>
            <span className="text-slate-200 font-semibold font-mono">{projectName}</span>
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-300 leading-relaxed max-w-3xl border-t border-slate-800/80 pt-6">
          {current.description}
        </p>
      </div>

      {/* Grid: Planned Features & Architectural Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Features Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            Planned Functional Capabilities
          </h3>
          <ul className="space-y-2.5 text-xs">
            {current.features.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                <span className="leading-relaxed">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Architecture / Code Preview */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span className="flex items-center gap-2 text-slate-300 font-sans font-semibold">
              <Terminal className="w-4 h-4 text-purple-400" />
              Architecture Preview
            </span>
            <span className="text-[10px] text-slate-500">Playwright TS Engine</span>
          </div>
          <pre className="text-[11px] text-slate-300 bg-slate-950 p-4 rounded-xl overflow-x-auto border border-slate-800/80 leading-relaxed">
            {current.codeSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
