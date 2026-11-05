# Easy Automate – Stage 1 Desktop Application (Electron + React + TypeScript)

Easy Automate is a web-based test automation platform that allows users to register, manage multiple projects, create test cases, and execute automation scripts using natural-language instructions (NLP) powered by **Playwright with TypeScript**.

This repository contains the complete **Stage 1** implementation built as an **Electron local desktop application**.

---

## 🚀 Stage 1 Implemented Modules

### 1. Landing Page
- Accessible at `/`.
- Features a modern, developer-focused UI highlighting Playwright + NLP architecture.
- **Login** & **Register** options with clear CTAs.
- Architecture summary and feature cards.

### 2. Login Module
- Accessible at `/login`.
- **Email Validation**: Real-time regex format validation on the UI and database verification.
- **Password Verification**: Validates passwords using **bcryptjs** cryptographic hash comparison.
- **Error Handling**:
  - Unregistered account warning.
  - Invalid password warning.
  - Unactivated account warning with a one-click shortcut to open the activation mail simulator.
- Pre-configured demo account quick-fill: `demo@easyautomate.dev` / `P@ssword123`.

### 3. Registration Module
- Accessible at `/register`.
- **Email Validation**: Format validation and uniqueness checks against the database.
- Prevents duplicate registration if an account already exists and is activated.
- **Activation Dispatch**: Initiates account activation process with a secure 24-hour cryptographic token.
- Seamlessly pipes the activation notification into the built-in **In-App Mailbox Simulator**.

### 4. Account Activation Module
- Accessible at `/activate?token=...`.
- Verifies the cryptographic token and ensures it has not expired or already been activated.
- **Password & Confirm Password** inputs with a real-time 5-point validation checklist:
  - Minimum 8 characters.
  - At least one uppercase letter (`[A-Z]`).
  - At least one lowercase letter (`[a-z]`).
  - At least one number (`[0-9]`).
  - At least one special character (`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`).
  - Confirm Password matches Password.
- Hashes the password using `bcryptjs` and marks the account as active with activation timestamp.

### 5. Project Management Module
Two-level project navigation:
- **All Projects Page** (`/projects`):
  - Lists all projects belonging to the logged-in user (multi-user isolation).
  - Search & filter projects by name, description, or target URL.
  - Project statistics counter.
  - **Create New Project Modal**:
    - Project Name field with strict length and duplicate validation.
    - Description, Base URL, Environment (`development`, `staging`, `production`), and Default Browser (`chromium`, `firefox`, `webkit`).
    - Immediate UI update upon creation.
- **Individual Project Page** (`/projects/:id`):
  - Dedicated page with breadcrumb navigation back to All Projects.
  - Displays project details, environment configuration, and target URL.
  - **Tabs**:
    - **Overview**: Environment configuration and Playwright engine status.
    - **Test Cases**: Test scenario listing.
    - **NLP Engine**: Interactive playground demonstrating conversion of natural-language instructions (e.g. *"Login to the application using valid credentials and verify that the dashboard is displayed"*) into Playwright TypeScript code.
    - **Settings**: Edit project details or delete project.

### 6. Local In-App Mailbox Simulator
- Accessible globally from the navigation bar.
- Simulates outgoing emails locally so developers can test the complete email activation flow without needing a live SMTP server.
- Provides direct "Click Activation Link" buttons.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Desktop Shell** | Electron 34 with secure context isolation & IPC channels |
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS |
| **Icons & Styling** | Lucide React, Tailwind CSS |
| **Routing** | React Router (HashRouter for Electron compatibility) |
| **Authentication** | Cryptographic tokens & bcryptjs password hashing |
| **Local Database** | File-backed JSON database engine stored in `userData` directory with multi-user isolation |
| **Validation** | Zod + Client-side RegEx validators |

---

## 🏃 How to Run

### Development Mode (with Live Hot Reload)
```bash
npm run dev
```
Starts the Vite dev server on `http://localhost:5173` and launches the Electron desktop window.

### Production Build & Launch
```bash
# Build both frontend assets and Electron main process
npm run build

# Start the packaged Electron app
npm start
```

### Browser Preview (Optional)
If you prefer previewing solely in a web browser without launching Electron:
```bash
npm run dev:renderer
```
Open `http://localhost:5173` in any browser. The built-in client fallback automatically activates LocalStorage persistence.

### Run Automated Tests
```bash
npm test
```
Executes the comprehensive verification test suite covering user registration, activation tokens, bcrypt password hashing, unactivated account rejection, project creation, validation, and user isolation.
