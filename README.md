# Easy Automate – Stage 3 Desktop Application (Electron + React + TypeScript)

Easy Automate is a web-based test automation platform that allows users to register, manage multiple projects, maintain centralized UI element repositories, manage structured Excel test data, and execute automation scripts using natural-language instructions (NLP) powered by **Playwright with TypeScript**.

This repository contains the complete **Stage 1** (Auth, Activation & Projects), **Stage 2** (Individual Project Workspace, Project Dashboard & UI Element Repository), and **Stage 3** (Test Data Management with Hierarchical Folder Structure & Excel Management) implementations built as an **Electron local desktop application**.

---

## 🚀 Implemented Modules

### 1. Dedicated Individual Project Workspace (Stage 2 & 3)
Accessible by selecting any project from the All Projects list:
- **Left Sidebar Navigation:**
  1. **Dashboard** *(Implemented)*
  2. **Repository** *(Implemented)*
  3. **Test Data** *(Stage 3 Implemented)*
  4. **TestDev** *(Collapsible group)*
     - **Scripts** *(Stage 4 Navigation Placeholder with architecture preview)*
     - **Execution** *(Stage 4 Navigation Placeholder with architecture preview)*
  5. **Suites** *(Stage 5 Navigation Placeholder with architecture preview)*
- **Project Settings & Environment Status:** Quick switcher for project name, description, target base URL, default browser (Chromium, Firefox, WebKit), and environment (Development, Staging, Production).

---

### 2. Stage 3 – Test Data Management
- **4.1 Hierarchical Folder and Subfolder Structure:**
  - Tree-based folder explorer supporting infinite levels of nested subfolders.
  - Default seed repository showcasing the requirements example:
    - `Login Module`
      - `Valid Login` ➔ `valid_login_data.xlsx`
      - `Invalid Login` ➔ `invalid_login_data.xlsx`
    - `Product Module`
      - `Product Search` ➔ `product_search_data.xlsx`
      - `Add To Cart` ➔ `cart_valid_data.xlsx`, `cart_invalid_data.xlsx`
    - `Payment Module`
      - `Credit Card` ➔ `credit_card_data.xlsx`
      - `UPI` ➔ `upi_data.xlsx`
    - `Registration Module` ➔ `registration_data.xlsx`
  - Folder operations:
    - Create root folders and nested subfolders.
    - Rename folders and subfolders with uniqueness validation.
    - Cascading deletion: deleting a parent folder safely removes all child subfolders and associated files.
    - Expand all and collapse all tree operations.
    - Interactive breadcrumbs navigation path.
- **4.2 Excel File Upload & Management:**
  - Supported formats: `.xlsx` and `.xls` only.
  - Strict format validation: rejects unsupported formats (`.csv`, `.pdf`, `.txt`, `.json`, `.png`, etc.) with clear, user-friendly error banners.
  - Drag-and-drop file upload zone + local file picker.
  - Multi-file upload support.
  - Upload Excel files into any selected folder or root.
  - File metadata tracking:
    - **File Name**
    - **File Format** (`.xlsx`, `.xls`)
    - **File Size** (formatted in B, KB, MB)
    - **Upload Date & Time**
    - **Uploaded By** (tracks author email)
    - **Worksheet Inspector** (detected sheets and sample row counts)
  - Duplicate file name handling: detects name collision in the target folder and prompts for confirmation before replacing or updating.
  - File operations:
    - Download uploaded Excel workbooks directly to the local machine.
    - In-browser workbook sheet inspection modal with tabular preview.
    - Rename files while enforcing `.xlsx`/`.xls` preservation.
    - Delete files with confirmation dialogs.
  - Dual view modes: toggle between modern Card Grid View and dense Details Table List View.
  - Real-time search filter across file names and parent folder paths.
- **4.3 Cross-Module Architecture:**
  - Project-level data sharing: Test Data files and Repository UI elements are shared across the project workspace.
  - Prepared for upcoming TestDev (Scripts & Execution) and Suites modules to consume shared Excel datasets for data-driven test runs.

---

### 3. Stage 2 – Dashboard & Repository
- **Project Dashboard:** Real-time metrics for total scripts, elements, suites, execution pass rates, and active execution node telemetry.
- **Centralized UI Element Repository:**
  - Pages and subpages hierarchy.
  - Right-side slide-over Add/Edit Element drawer.
  - Multiple locator strategies per element (`ID`, `Name`, `XPath`, `CSS Selector`, `Test ID`, etc.).
  - Static and dynamic locators with interactive placeholder auto-suggestions (`{dynamic value1}`, `{dynamic value2}`).

---

### 4. Stage 1 – Authentication, Activation & Multi-Project Management
- **Landing Page, Login & Register:** Secure bcrypt password hashing and unique email validation.
- **Account Activation:** 5-point password validation checklist (length, uppercase, lowercase, number, special character) with simulated in-app mailbox.
- **Multi-User Project Isolation:** Each user owns isolated test automation projects.

---

## 🏃 How to Run

### Development Mode (with Live Hot Reload)
```powershell
npm run dev
```

### Run Electron Directly
```powershell
npm start
```

### Run Complete Test Suite (Stages 1, 2, and 3)
```powershell
npm test
```

### Production Build
```powershell
npm run build
```

---

## 🧪 Automated Test Verification
Run all automated test suites covering business logic, validation rules, cascading deletions, and Excel format handling:
```powershell
node test-stage1.js
node test-stage2.js
node test-stage3.js
```
All tests run locally against the file-backed database engine and assert 100% compliance with application requirements.
