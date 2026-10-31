# NoTokenLimit Full-Stack Workspace

NoTokenLimit is a premium, context-aware AI chat and workspace platform featuring a persistent user memory system, skill-toggle system prompts, a multi-model selector proxy, automatic key rotation and failovers, editable visual spreadsheet/document artifacts, and a multi-section admin dashboard with 5-digit redeem code lifecycles.

---

## 1. Directory Structure

```
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/        # JWT & Admin middlewares
│   │   ├── models/            # User, ApiKey, UserProfile, ChatHistory, Artifact, SystemError, RedeemCode
│   │   ├── routes/            # Auth, Chats, Profile, Artifacts, Admin controller
│   │   ├── services/          # KeyManager (AES proxy rotation), MemoryService (facts)
│   │   └── index.ts           # Express bootstrapper & DB seeders
│   ├── tsconfig.json
│   ├── package.json
│   └── .env                   # Local backend configuration secrets
├── frontend/
│   ├── src/
│   │   ├── components/        # Sidebar, Workspace, ArtifactsPane, AdminDashboard, SettingsModal, Toast
│   │   ├── utils/             # apiCall client helpers
│   │   ├── App.tsx            # Main layout container & SSE stream parser
│   │   ├── index.css          # Tailwind CSS v4 & custom glassmorphism
│   │   └── main.tsx           # Entry React mounting
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .env.example               # Root configuration template
└── README.md                  # Development instructions (This file)
```

---

## 2. Setup & Installation

### Prerequisites
1. **Node.js** (v18+ recommended)
2. **MongoDB** instance running locally on `mongodb://127.0.0.1:27017`

### Step 1: Install Dependencies
Open two terminals or run these sequentially:

**For Backend:**
```bash
cd backend
npm install
```

**For Frontend:**
```bash
cd frontend
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `backend/.env` (already done by the automated setup):
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=super_secret_jwt_key_no_token_limit_2026
SESSION_SECRET=super_secret_session_key_no_token_limit_2026
ENCRYPTION_SECRET=12345678901234567890123456789012
MONGODB_URI=mongodb://127.0.0.1:27017/notokenlimit
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
DEFAULT_MODEL=meta/llama-3.1-70b-instruct
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```
*Note: `ENCRYPTION_SECRET` is used for AES-256-CBC database storage of provider API keys and must be exactly 32 characters.*

---

## 3. Running the Application

### Launch Backend Server
In the `backend/` directory:
```bash
npm run dev
```
- The backend server will start on `http://localhost:5000`.
- It will automatically connect to your local MongoDB instance.
- **Auto-Seeding**: On first run, it checks the database and automatically seeds 21 placeholder API keys (for Llama, Qwen, Mistral, Nemotron, etc., spread across `group-A`, `group-B`, and `group-C`) if the collections are empty.
- **Admin Privilege Helper**: The first user to sign up via credentials or Discord is automatically granted the **Admin** role to make immediate local configurations simple.

### Launch Frontend Dashboard
In the `frontend/` directory:
```bash
npm run dev
```
- The Vite web server will start on `http://localhost:5173`.
- Open `http://localhost:5173` in your browser.

---

## 4. Key Workflows to Explore

### 1. Account Creation & Group Load Balancing
- Register a test user. The backend scans existing user group counts and balance-allocates the registrant into the least populated `groupArea` (`group-A`, `group-B`, or `group-C`) automatically.

### 2. Admin Dashboard Controls
- Since the first user is an Admin, you will see a red shield icon in the top right of the sidebar. Click it to open the administrative panel.
- Swapping tabs displays live stats for: Users, Chats, Errors, Costs, API Keys CRUD, Provider distribution, server Latency, console Logs, rate limits, and MongoDB storage metrics.
- Go to the **API Keys** tab to replace placeholder keys with your real NVIDIA NIM keys (or other compatible endpoints). Keys are encrypted before being written to MongoDB.

### 3. Redeem Code & Unlimited Access Life Cycle
- In the Admin panel, go to **Redeem Codes** and click **Generate Code**. A unique 5-digit code is created.
- Log in as another (standard) user, open **Settings**, paste the code, and click **Upgrade**.
- The user is promoted to the `Unlimited` tier. The Admin panel tracking updates to show exactly which user redeemed the code and when.
- Click **Expire/Revoke** on that code in the Admin Panel to demote the user back to the `Free` tier.

### 4. Incognito & Memory Extraction
- Turn on the **Incognito Mode** switch in the sidebar to prevent any conversations or prompt streams from logging in MongoDB.
- With incognito off, chat about yourself (e.g. "I code in React"). In the background, the server scans for declarations and updates your **Personalize** facts card. Facts and toggleable system skills are injected into the context prompt on all future requests automatically.

### 5. Workspace Artifact Splits
- Ask the AI to write a document, format a table, or compile markdown.
- The assistant output triggers special markup tags like `[artifact-sheet title="Sample Spreadsheet"]...[/artifact-sheet]`.
- The frontend parses these stream boundaries, slides open the right split panel, and mounts the interactive tab, allowing you to edit grid cells, add/delete rows/cols, or view Markdown previews alongside versions history.
