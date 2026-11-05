# Easy Automate – Stage 2 Desktop Application (Electron + React + TypeScript)

Easy Automate is a web-based test automation platform that allows users to register, manage multiple projects, maintain centralized UI element repositories, and execute automation scripts using natural-language instructions (NLP) powered by **Playwright with TypeScript**.

This repository contains the complete **Stage 1** (Auth, Activation & Projects) and **Stage 2** (Individual Project Workspace, Project Dashboard & UI Element Repository) implementations built as an **Electron local desktop application**.

---

## 🚀 Stage 2 Implemented Modules

### 1. Dedicated Individual Project Workspace
Accessible by selecting any project from the All Projects list:
- **Collapsible Sidebar Navigation:**
  1. **Dashboard** *(Implemented)*
  2. **Repository** *(Implemented)*
  3. **Test Data** *(Stage 3 Navigation Placeholder)*
  4. **TestDev** *(Collapsible group)*
     - **Scripts** *(Stage 3 Navigation Placeholder)*
     - **Execution** *(Stage 4 Navigation Placeholder)*
  5. **Suites** *(Stage 4 Navigation Placeholder)*
- **Project Settings & Environment Status:** Quick switcher for baseUrl, default browser, and environment.

---

### 2. Module 1: Project Dashboard
- **2.1 Project Overview Cards:**
  - **Total Scripts:** Automation scripts in the project.
  - **Total Elements:** Real-time count of UI elements stored in the Repository.
  - **Total Suites:** Active test suites configured in the project.
  - **Suite Executions:** Total historical test suite runs.
  - **Passed Executions:** Successful runs with visual pass rate percentage.
  - **Failed Executions:** Runs requiring triage.
- **2.2 Execution Overview:**
  - Status badges (`Passed`, `Failed`, `Running`, `Aborted`).
  - Execution timestamps, durations (e.g. `1m 34s`), and test results count (Passed/Failed).
- **2.3 Machine Details:**
  - Telemetry for the active execution node:
    - **Machine Name:** e.g. `WORKSTATION-QA-01`
    - **Operating System:** e.g. `Windows 11 Pro 64-bit`
    - **Browser Name & Version:** e.g. `Chromium v131.0.6778.86`
    - **Environment:** `development` / `staging` / `production`
    - **Status:** `Ready` / `Online`
- **2.4 Telemetry Visuals:**
  - Real-time pass rate distribution bar and health indicators.

---

### 3. Module 2: Repository (UI Element Store)
- **3.1 Hierarchical Tree View:**
  - Multi-level structure: **Pages ➔ Subpages ➔ Elements**.
  - Default seed repository showcasing the requirements example:
    - `Login Page` (Email Field, Password Field, Login Button, Forgot Password Link)
    - `Home Page` ➔ `Header Section` (Profile Icon, Search Field)
    - `Home Page` ➔ `Product Section` (Product Name, Add To Cart Button)
    - `Cart Page` (Cart Items Table, Checkout Button)
  - Expand all and collapse all tree operations.
  - Page & subpage element counts.
- **3.2 Repository Operations:**
  - Create new root pages.
  - Create nested subpages under any page.
  - Rename pages and subpages with real-time uniqueness validation.
  - Cascade deletion (deleting a page cleanly removes child subpages and their elements).
  - Search and filter elements across locators and names.
- **3.3 & 3.4 Add/Edit Element Right-Side Drawer:**
  - Smooth slide-over panel from the right edge.
  - **Element Name** (mandatory).
  - **Element Type** (mandatory): `Button`, `Input Field`, `Link`, `Dropdown / Select`, `Checkbox`, `Radio Button`, `Text / Label`, `Image`, `Table`, `Modal`, `Card`, `Container`, `Custom`.
  - **Page Assignment:** Dropdown to select or reassign parent page/subpage.
  - **Multiple Locator Support:** Configure multiple locator strategies for each element:
    - Supported types: `ID`, `Name`, `XPath`, `CSS Selector`, `Class Name`, `Link Text`, `Partial Link Text`, `Tag Name`, `Text`, `Role`, `Placeholder`, `Label`, `Test ID`.
    - Mark primary strategy.
    - Add, edit, or remove individual locators.
- **3.5 & 3.6 Static & Dynamic Locator Support with Auto-Suggestions:**
  - Supports static locators: `//button[@name='login']`.
  - Supports dynamic locators with placeholders: `//button[@name='{dynamic value1}' and @text='{dynamic value2}']`.
  - **Interactive Dynamic Suggestions Dropdown:**
    - Typing `{` inside the locator value input immediately displays suggestion options.
    - Click to insert auto-incrementing sequential variables: `{dynamic value1}`, `{dynamic value2}`.
    - Or insert descriptive dynamic variables: `{dynamic text}`, `{dynamic id}`.
    - Visual pills display all detected dynamic placeholders below the input.
- **3.7 Validation Engine:**
  - Validates mandatory fields (Element Name, Element Type, Target Page).
  - Ensures at least one valid locator configuration.
  - Enforces matching braces `{` and `}` for dynamic placeholder syntax before saving.

---

### 4. Navigation Placeholders (Stages 3 & 4)
- **Test Data:** Preview of data-driven automation with Excel (`.xlsx` and `.xls`) datasets.
- **TestDev – Scripts:** Preview of Playwright TypeScript script composer and NLP generation.
- **TestDev – Execution:** Preview of BullMQ background execution queue and screenshot viewer.
- **Suites:** Preview of suite orchestration and batch runs.

---

## 🏃 How to Run

### Development Mode (with Live Hot Reload)
```powershell
npm run dev
```
Starts the Vite dev server and opens the Electron desktop window.

### Production Build & Launch
```powershell
npm run build
npm start
```

### Run Automated Tests (Stage 1 & Stage 2 Test Suites)
```powershell
npm test
```
Verifies all Stage 1 authentication and project isolation requirements, plus all Stage 2 Dashboard metrics, hierarchical page tree management, dynamic placeholder suggestions, and multiple locator validations.
