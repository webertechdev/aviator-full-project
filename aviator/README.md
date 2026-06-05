# ✈️ Aviator Game — Full Stack

A real-money Aviator crash game with M-PESA payments via Pesapal, built on Firebase + React + Vercel.

---

## Project Structure

```
aviator/
├── frontend/          # Player game UI (React + Vite → Vercel)
├── admin/             # Admin dashboard (React + Vite → Firebase Hosting)
├── functions/         # Firebase Cloud Functions (Node.js backend)
├── firestore.rules    # Firestore security rules
├── firestore.indexes.json
├── firebase.json
└── .github/workflows/ # CI/CD
```

---

## 🚀 Quick Start

### 1. Install all dependencies
```bash
npm run install:all
```

### 2. Run locally
```bash
# Terminal 1 - Player frontend (http://localhost:3000)
npm run dev:frontend

# Terminal 2 - Admin dashboard (http://localhost:3001)
npm run dev:admin

# Terminal 3 - Firebase emulators
npm run dev:functions
```

---

## 🔧 Firebase Setup

### Enable these Firebase services:
1. **Authentication** → Email/Password provider
2. **Firestore** → Create database (production mode)
3. **Realtime Database** → Create database
4. **Functions** → Requires Blaze (pay-as-you-go) plan
5. **Hosting** → Two sites: `app` and `admin`

### Add hosting targets:
```bash
firebase target:apply hosting app aviator-6827d
firebase target:apply hosting admin aviator-admin  # create second site in Firebase console
```

### Deploy Firestore rules + indexes:
```bash
firebase deploy --only firestore
```

### Deploy functions:
```bash
cd functions && npm install
firebase deploy --only functions
```

### Deploy hosting:
```bash
npm run build:all
firebase deploy --only hosting
```

---

## 🌐 Vercel Deployment (Frontend)

1. Connect GitHub repo to Vercel
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `VITE_API_BASE` = `https://us-central1-aviator-6827d.cloudfunctions.net`
4. Deploy

---

## 👑 Create First Admin User

1. Register normally on the frontend (creates a regular user)
2. Go to Firebase Console → Firestore → `users` collection
3. Find your user document
4. Edit: add `role: "admin"` field
5. Now log in at the admin dashboard

---

## 💳 Pesapal Configuration

- **Key**: `KLg8UrH2NzfTvfeC4DuDXBQo2OPohmgH`
- **Secret**: `EA1hRGKSXVrIdahZmOLE8uG3ZK8=`
- Currently using **sandbox** (`cybqa.pesapal.com`)
- For production: change `PESAPAL_BASE` in `functions/src/pesapal.js` to:
  `https://www.pesapal.com/api`
- Register your IPN URL with Pesapal: `https://us-central1-aviator-6827d.cloudfunctions.net/pesapalIPN`

---

## 🎮 Game Flow

1. Auto-scheduler triggers a new round every ~1 minute (Pub/Sub)
2. Game state stored in `gameState/current` document
3. Frontend listens via Firestore `onSnapshot` for real-time updates
4. Players place bets during `waiting` phase
5. Round goes `flying` → multiplier animates on canvas
6. Players cash out manually or via auto-cashout
7. Round `crashes` at the RNG-determined multiplier
8. Uncashed bets are marked as `lose`
9. 5-second pause → next `waiting` phase begins

---

## 🔐 GitHub Actions Secrets Required

| Secret | Where to get it |
|--------|----------------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project Settings → Service Accounts → Generate key |
| `FIREBASE_TOKEN` | Run `firebase login:ci` locally |

---

## 📊 Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | uid, email, phone, country, balance, role, chatEnabled |
| `transactions` | deposits and withdrawals with Pesapal tracking |
| `rounds` | crash multiplier history |
| `bets` | per-round bets with results |
| `gameState` | single doc `current` with live round state |
| `chat` | live chat messages |

---

## 🌍 Supported Countries & Currencies

| Country | Currency | Min Deposit | Min Withdraw |
|---------|----------|-------------|--------------|
| Kenya 🇰🇪 | KES | 100 | 100 |
| Tanzania 🇹🇿 | TZS | 10,000 | 10,000 |
| Uganda 🇺🇬 | UGX | 3,000 | 3,000 |

---

## 📱 Chat Permissions

- By default, all players have chat **disabled**
- Admin enables chat per-user in the Admin Dashboard → Users tab → "Allow Chat"
- Admins always have chat access
- Chat messages are stored in Firestore `chat` collection

---

## ⚠️ Important Notes

1. **Switch Pesapal to production** before going live (update `PESAPAL_BASE` in `pesapal.js`)
2. **Firebase Blaze plan** required for Cloud Functions
3. **Update `FRONTEND_URL`** in `functions/src/index.js` after Vercel deploy
4. The auto-scheduler (`autoStartRound`) runs every 1 minute via Cloud Scheduler — ensure it's enabled
5. Store Pesapal credentials as Firebase Function environment variables in production:
   ```bash
   firebase functions:config:set pesapal.key="..." pesapal.secret="..."
   ```
