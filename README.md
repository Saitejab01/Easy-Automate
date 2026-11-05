# Easy Automate – Stages 1 through 5 Desktop Application (Electron + React + TypeScript)

Easy Automate is a web-based test automation platform that allows users to register, manage multiple projects, maintain centralized UI element repositories, manage structured Excel test data, and author & execute automation scripts using natural-language instructions (NLP) powered by **Playwright with TypeScript**.

This repository contains the complete **Stage 1** (Auth, Activation & Projects), **Stage 2** (Workspace, Dashboard & Repository), **Stage 3** (Test Data Management), **Stage 4** (TestDev – Scripts, Modules, NLPs & Variables), and **Stage 5** (TestDev – Playwright Execution Engine & Telemetry) implementations built as an **Electron local desktop application**.

---

## 🚀 Implemented Modules

### 1. Dedicated Individual Project Workspace
Accessible by selecting any project from the All Projects list:
- **Left Sidebar Navigation:**
  1. **Dashboard** *(Implemented)*
  2. **Repository** *(Implemented)*
  3. **Test Data** *(Implemented)*
  4. **TestDev** *(Collapsible group)*
     - **Scripts** *(Stage 4 Implemented)*
     - **Execution** *(Stage 5 Implemented)*
  5. **Suites** *(Stage 6 Navigation Placeholder with architecture preview)*
- **Project Settings & Environment Status:** Quick switcher for project name, description, target base URL, default browser (Chromium, Firefox, WebKit), and environment (Development, Staging, Production).

---

### 2. Stage 4 – TestDev (Scripts & NLP Development)

#### 2.1 Modules and Submodules Hierarchy (Section 2)
- Tree-based hierarchical folder structure for organizing automation scripts:
  - **Login Module**
    - `Valid Login` ➔ `Login With Valid Credentials`, `Login With Remember Me`
    - `Invalid Login` ➔ `Login With Invalid Password`, `Login With Invalid Email`
  - **Product Module**
    - `Product Search` ➔ `Search With Valid Product`, `Search With Invalid Product`
    - `Cart Module` ➔ `Add Product To Cart`
  - **Payment Module**
    - `Payment Validation` ➔ `Payment Validation`
- Module Operations: Create modules & submodules, rename, delete (with cascading deletion of submodules and scripts), expand/collapse hierarchy.
- Script Metadata: Script Name, Script ID, Module/Submodule, Created By, Created Date/Time, Last Modified Date/Time, Step Count, Last Execution Status, Last Execution Date.

#### 2.2 Script Development Interface (Section 3)
- Slide-over / Full script editor panel:
  - **Script Header:** Name, module path, ID, timestamps, step count, and actions (`Add NLP`, `Run`, `Run Settings`, `Variables`, `Close`).
  - **Step Management Area:**
    - Step Number, NLP Name, Category badge, Element Mapping chip, Parameter chips.
    - **Add Step (+) Beside Every Step:** Clicking the (+) beside Step 1 inserts a new step **immediately below Step 1** (as Step 2) and automatically recalculates all subsequent step numbers!
    - **Add NLP Button (Top-Left):** Adds selected NLP as a new step at the end of the script.
    - Actions on each step: Edit parameters, Delete step, Duplicate step, Reorder (move up/down).

#### 2.3 NLP Engine Catalog (Section 4)
Complete predefined NLP catalog categorized into 7 categories:
1. **Browser NLPs:** Open Browser, Navigate To URL, Refresh Browser, Close Browser, Maximize Browser, Minimize Browser, Get Current URL, Get Page Title, Navigate Back, Navigate Forward.
2. **Browser Action NLPs:** Click On Element, Double Click On Element, Right Click On Element, Enter Text, Clear Text, Select Dropdown By Text, Select Dropdown By Value, Select Checkbox, Deselect Checkbox, Upload File, Download File, Press Keyboard Key, Hover On Element.
3. **Switching NLPs:** Switch To Frame, Switch To Default Content, Switch To Parent Frame, Switch To New Tab, Switch To Tab By Title, Switch To Tab By URL, Close Current Tab, Switch To Alert, Accept Alert, Dismiss Alert, Get Alert Text.
4. **Verification / Assertion NLPs:** Verify Element Is Displayed, Verify Element Is Not Displayed, Verify Element Is Enabled, Verify Element Is Disabled, Verify Text, Verify Attribute, Verify URL, Verify Page Title, Verify Checkbox Is Selected, Verify Dropdown Value.
5. **Wait NLPs:** Wait For Element, Wait For Element To Be Visible, Wait For Element To Be Hidden, Wait For Element To Be Enabled, Wait For Navigation, Wait For URL, Wait For Text, Static Wait.
6. **Scroll NLPs:** Scroll To Element, Scroll Up, Scroll Down, Scroll To Top, Scroll To Bottom, Scroll By Pixels.
7. **Excel NLPs:**
   - **Get Data From Excel:** Retrieves row matching unique Test Case ID / identifier and returns header ➔ value Map.
   - **Write Data To Excel:** Finds intersection of unique identifier (row) and column header, writes data back, and saves updated `.xlsx` file.

#### 2.4 Repository Element Mapping (Section 5)
- Automated element selection prompt for NLPs requiring UI elements.
- Element browser with page/subpage tree and element search.
- Associates Element ID, Name, Page, and primary locator configuration with dynamic placeholder resolution (`{dynamic value1}`).

#### 2.5 Variables Management & Suggestions (Section 7)
- **Local Variables:** Scoped only to the current script (`username`, `password`, `isDisplayed`, `isEnabled`).
- **Global Variables:** Project-level reusable variables (`baseURL`, `defaultTimeout`, `environment`, `productName`).
- **Variable Suggestions Autocomplete:** Typing `$` in any NLP input field instantly pops up autocomplete suggestions with matching local and global variables.
- Sensitive variables (passwords, encrypted fields) are automatically masked (`••••••••`) in logs and telemetry.

#### 2.6 Run Settings (Section 8)
- Configuration panel for Browser (Chromium, Firefox, WebKit), Step Delay (ms), Global Wait Time (ms), Execution Timeout (s), Screenshot options ("Every step" vs "Failed steps only"), and Screen Recording toggles.

---

### 3. Stage 5 – TestDev (Execution Management & Telemetry)

#### 3.1 Execution Management (Section 9)
- Unique Execution ID generation: `EXEC0001`, `EXEC0002`...
- Execution List with ID, Date/Time, Duration, Status (Passed, Failed, Running, Pending, Aborted, Skipped), Total/Passed/Failed Scripts count, and Executed Machine Details.
- **Expandable Execution Structure:** Expand Execution ID to inspect individual scripts and their step-level pass/fail statuses.

#### 3.2 Script-Level & Step-Level Execution Details (Section 10)
- Execution Step Table: Step No., Step Name, Duration, Status.
- **Individual Step Details Modal:**
  - Step Information: Step Number, NLP Name, Description, Timestamps, Duration, Status.
  - Repository Element Details: Element Name, Page/Subpage, Locator Type, Locator Value, Dynamic Values.
  - Variable Details: Resolved variable values with sensitive data masking.
  - Input Parameters: Inputs passed to NLP, resolved test data, and Excel row map preview.
  - Execution Logs: Timestamped terminal logs (Element identified, action performed, assertions).
  - Visual Browser Screenshot: Mock / Playwright browser viewport screenshot with element highlight and status badge.
  - Screen Recording: Simulated video recording player with playback status.
- **Failure Diagnostic (Section 10.2):** Prominent diagnostic card for failed steps displaying Failure Reason, Exception Name, Error Message, Failed Locator, and failure screenshot.

#### 3.3 Executed Machine & Environment Details (Section 11)
- Telemetry card capturing Hostname, Operating System, OS Version, Browser & Version, Playwright Version (v1.49.1), Node.js Version, Execution Environment, and Start/End timestamps.

---

## 🏃 How to Run

### Development Mode (with Live Hot Reload)
```powershell
npm run dev
```

### Run Electron Desktop App Directly
```powershell
npm start
```

### Run Complete Test Suite (Stages 1 through 5)
```powershell
npm test
```

### Production Build
```powershell
npm run build
```

---

## 🧪 Automated Test Verification
Run all automated test suites covering authentication, UI element repository, Excel test data, and the complete script authoring & execution lifecycle:
```powershell
node test-stage1.js
node test-stage2.js
node test-stage3.js
node test-stage4-5.js
```
All tests run against the file-backed JSON database engine and assert 100% compliance with application requirements.
