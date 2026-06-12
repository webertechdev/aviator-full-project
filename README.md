✈️ AVIATOR — Full Stack Game Platform
React + Firebase + Vercel Serverless | M-PESA Payments via Pesapal
🗂️ PROJECT ARCHITECTURE
Plain Text
aviator-full-project/                              ← GitHub repo root
│
├── 📁 frontend/                      ← Player Game UI  (→ Vercel)
│   ├── index.html                    ← App shell
│   ├── package.json                  ← React 18, Firebase, Vite
│   ├── vite.config.js                ← Vite build config
│   └── src/
│       ├── main.jsx                  ← ReactDOM entry point
│       ├── App.jsx                   ← Router (Landing/Login/Register/Game)
│       ├── index.css                 ← Full theme — dark purple + light mode
│       │
│       ├── lib/
│       │   └── firebase.js           ← Firebase client SDK init
│       │
│       ├── context/
│       │   └── AuthContext.jsx       ← Auth state, register, login, logout
│       │
│       ├── hooks/
│       │   └── useGame.js            ← Game engine — rounds, RNG, bets, cashout
│       │
│       ├── pages/
│       │   ├── Landing.jsx           ← Public landing page (Login/Register top right)
│       │   ├── Login.jsx             ← Email + password login
│       │   ├── Register.jsx          ← Full name, email, phone, country, password
│       │   └── Game.jsx              ← Main game screen
│       │
│       └── components/
│           ├── GameCanvas.jsx        ← HTML5 canvas — plane + curve animation
│           ├── BettingPanel.jsx      ← Dual bet slots (Bet 1 + Bet 2)
│           ├── LeftPanel.jsx         ← All Bets / Previous / Top / Chat tabs
│           └── WalletModal.jsx       ← Deposit (STK push) + Withdraw
│
├── 📁 api/                           ← Vercel Serverless Functions  (→ Vercel)
│   ├── deposit.js                    ← POST /api/deposit — Pesapal STK push
│   ├── withdraw.js                   ← POST /api/withdraw — Hold & request approval
│   ├── ipn.js                        ← POST /api/ipn — Pesapal payment callback
│   ├── history.js                    ← GET  /api/history?uid=xxx
│   └── admin/
│       ├── process-withdrawal.js     ← POST /api/admin/process-withdrawal
│       └── users.js                  ← POST /api/admin/users
│
├── 📁 admin/                         ← Admin Dashboard  (→ Firebase Hosting)
│   ├── index.html                    ← Admin shell
│   ├── admin-main.jsx                ← ReactDOM entry
│   ├── AdminApp.jsx                  ← Full dashboard — 6 tabs, single file
│   ├── package.json
│   └── vite.config.js
│
├── 📁 .github/
│   └── workflows/
│       └── deploy.yml                ← Auto CI/CD on push to main
│
├── firebase.json                     ← Firestore rules + hosting config
├── firestore.rules                   ← Security rules (role-based access)
├── firestore.indexes.json            ← Composite indexes for queries
├── vercel.json                       ← Vercel build + routing config
├── package.json                      ← Root deps (firebase-admin, axios)
├── .env.example                      ← Environment variables template
├── .gitignore
└── README.md
🚀 HOW IT WORKS (No Cloud Functions Needed)
Plain Text
┌─────────────┐     Firestore     ┌──────────────────────────┐
│  Browser A  │ ←─ onSnapshot ──► │  gameState/current       │
│  (Player)   │                   │  { phase, multiplier,    │
└─────────────┘                   │    roundId, crashAt }    │
       │                          └──────────────────────────┘
       │ writes round               ▲         ▲
       ▼                            │         │
┌─────────────┐     Firestore     Browser A  Browser B
│  Game Engine│ ──► rounds/       (starts)  (watches)
│  (Frontend) │ ──► bets/
│  useGame.js │ ──► gameState/
└─────────────┘

       Payments
┌─────────────┐  POST /api/deposit  ┌──────────────────────────┐
│  Frontend   │ ──────────────────► │  Vercel Serverless API   │
│  WalletModal│                     │  (Node.js)               │
└─────────────┘                     └────────────┬─────────────┘
                                                 │
                                    ┌────────────▼─────────────┐
                                    │  Pesapal API             │
                                    │  STK Push → M-PESA       │
                                    └────────────┬─────────────┘
                                                 │ IPN callback
                                    ┌────────────▼─────────────┐
                                    │  /api/ipn                │
                                    │  Credits user balance    │
                                    └──────────────────────────┘
📋 SETUP GUIDE — Step by Step
STEP 1 — Create GitHub Repository
Go to github.com → Click New repository
Name it aviator
Set to Private
Click Create repository
Upload ALL files from this project maintaining the exact folder structure
STEP 2 — Firebase Setup
Go to console.firebase.google.com → Select project aviator-6827d
Enable Authentication → Sign-in method → Email/Password → Enable
Enable Firestore Database → Create database → Production mode
Go to Project Settings → Service Accounts → Generate new private key
This downloads a JSON file — keep it safe, you need it for Vercel
STEP 3 — Deploy Firestore Rules
In Firebase console:
Go to Firestore → Rules tab
Copy the contents of firestore.rules and paste it in
Click Publish
Go to Indexes tab → Composite → create these indexes:
Collection bets: fields uid ASC + timestamp DESC
Collection bets: fields result ASC + winnings DESC
Collection transactions: fields uid ASC + timestamp DESC
STEP 4 — Deploy to Vercel (Frontend + API)
Go to vercel.com → Add New Project → Import from GitHub
Select your aviator repo
Set these settings:
Framework Preset: Other
Build Command: cd frontend && npm install && npm run build
Output Directory: frontend/dist
Install Command: npm install
Add these Environment Variables (from your Firebase service account JSON):
Variable Name
Value
FIREBASE_PROJECT_ID
aviator-6827d
FIREBASE_CLIENT_EMAIL
(from service account JSON)
FIREBASE_PRIVATE_KEY
(from service account JSON — full key with \n)
PESAPAL_CONSUMER_KEY
KLg8UrH2NzfTvfeC4DuDXBQo2OPohmgH
PESAPAL_CONSUMER_SECRET
EA1hRGKSXVrIdahZmOLE8uG3ZK8=
PESAPAL_BASE_URL
https://cybqa.pesapal.com/pesapalv3
Click Deploy
Your game URL will be something like https://aviator-xyz.vercel.app
STEP 5 — Deploy Admin Dashboard to Firebase Hosting
Install Firebase CLI: npm install -g firebase-tools
Run: firebase login
In the project root run:
Bash
cd admin && npm install && npm run build
cd ..
firebase deploy --only hosting --project aviator-6827d
Admin dashboard URL: https://aviator-6827d.web.app
STEP 6 — Create Your Admin Account
Register on the game frontend normally
Go to Firebase Console → Firestore → users collection
Find your user document
Click Edit → Add field:
Field: role | Type: string | Value: admin
Click Save
Now go to https://aviator-6827d.web.app and log in with your email
STEP 7 — GitHub Actions Secrets (for auto-deploy )
In GitHub repo → Settings → Secrets and variables → Actions:
Secret Name
Where to get it
VERCEL_TOKEN
vercel.com → Settings → Tokens
VERCEL_ORG_ID
vercel.com → Settings → General → Team ID
VERCEL_PROJECT_ID
Vercel project → Settings → General
FIREBASE_TOKEN
Run firebase login:ci locally
FIREBASE_SERVICE_ACCOUNT
Firebase → Project Settings → Service Accounts → JSON key
🌍 COUNTRIES & CURRENCIES
Country
Currency
Min Deposit
Min Withdraw
🇰🇪 Kenya
KES
100
100
🇹🇿 Tanzania
TZS
10,000
10,000
🇺🇬 Uganda
UGX
3,000
3,000
🎮 GAME FEATURES
Feature
Details
Demo Account
50,000 KES free — same rounds as real
Real Account
Live M-PESA deposits & withdrawals
Dual Betting
Two independent bet slots per player
Auto Cashout
Set a target multiplier per slot
Live Bets Feed
All Bets / Previous / Top tabs
Live Chat
Admin-controlled per user
Dark/Light Mode
Toggle in top nav
Round History
Scrolling multiplier badges in nav
💸 WITHDRAWAL FLOW
Plain Text
Player requests withdrawal
        ↓
Balance held (deducted immediately)
        ↓
Transaction saved → status: "pending"
        ↓
Admin sees it in dashboard → Withdrawals tab
        ↓
      ┌─────────────────────┐
      │  Admin clicks:      │
      │  ✅ Approve & Pay   │ → Pesapal payout API → M-PESA sent → status: "approved"
      │  ❌ Decline         │ → Balance refunded → status: "declined"
      └─────────────────────┘
        ↓
Player sees status update in Transaction History
⚠️ GOING LIVE CHECKLIST
 Change PESAPAL_BASE_URL to https://www.pesapal.com/api (production )
 Sign Pesapal contract (required for settlements)
 Set your Vercel domain in Firestore Auth → Authorized domains
 Enable Firebase App Check for security
 Test a real deposit with a small amount
 Test a full withdrawal approval flow
 Ensure gameState/current document exists in Firestore (created automatically on first player visit)
🔥 FIRESTORE COLLECTIONS
Collection
Fields
users
uid, fullName, email, phone, country, balance, demoBalance, mode, role, chatEnabled
transactions
id, uid, type, amount, currency, phoneNumber, status, adminNote, timestamp
bets
id, uid, roundId, stake, autoCashout, result, cashoutMultiplier, winnings, mode
rounds
id, crashMultiplier, phase, startTime, endTime
gameState
current → { phase, roundId, crashMultiplier, startTime }
chat
uid, name, text, createdAt
