mport { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

const PESAPAL_KEY    = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_BASE   = process.env.PESAPAL_BASE_URL;
const MIN = { KES: 100, TZS: 10000, UGX: 3000 };

// --- Addition 1: Token error handling ---
let _token = null, _expiry = 0;
async function getPesapalToken() {
  if (_token && Date.now() < _expiry) return _token;
  const r = await axios.post(
    `${PESAPAL_BASE}/api/Auth/RequestToken`,
    { consumer_key: PESAPAL_KEY, consumer_secret: PESAPAL_SECRET },
    { headers: { "Content-Type": "application/json", Accept: "application/json" } }
  );
  if (!r.data.token) {
    throw new Error(`Pesapal auth failed: ${JSON.stringify(r.data.error || r.data)}`);
  }
  _token = r.data.token;
  _expiry = Date.now() + 4 * 60 * 1000;
  return _token;
}

// --- Addition 3: IPN ID caching ---
let _ipnId = null;
async function getIpnId(token, appUrl) {
  if (_ipnId) return _ipnId;
  const ipnRes = await axios.post(
    `${PESAPAL_BASE}/api/URLSetup/RegisterIPN`,
    { url: `${appUrl}/api/ipn`, ipn_notification_type: "POST" },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } }
  );
  _ipnId = ipnRes.data.ipn_id;
  return _ipnId;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, amount, currency, phoneNumber } = req.body;
  if (!uid || !amount || !currency || !phoneNumber)
    return res.status(400).json({ error: "Missing required fields" });

  // --- Addition 4: Numeric/negative amount validation ---
  if (isNaN(amount) || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const min = MIN[currency];
  if (!min) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
  const rounded = Math.round(amount / 10) * 10;
  if (rounded < min)
    return res.status(400).json({ error: `Minimum deposit is ${min.toLocaleString()} ${currency}` });

  // --- Addition 2: Declare txnRef outside try for rollback access ---
  let txnRef;
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    const user = userDoc.data();

    txnRef = db.collection("transactions").doc();
    await txnRef.set({
      id: txnRef.id, uid, type: "deposit", amount: rounded,
      currency, phoneNumber, status: "pending",
      timestamp: new Date().toISOString(),
    });

    console.log("PESAPAL_BASE:", PESAPAL_BASE);
    console.log("KEY EXISTS:", !!PESAPAL_KEY);
    console.log("SECRET EXISTS:", !!PESAPAL_SECRET);

    const token = await getPesapalToken();
    console.log("TOKEN:", token);

    const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://aviator-full-project.vercel.app";

    // --- Uses cached IPN ID instead of re-registering every time ---
    const ipnId = await getIpnId(token, appUrl);

    const orderRes = await axios.post(
      `${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`,
      {
        id: txnRef.id, currency, amount: rounded,
        description: "Aviator deposit",
        callback_url: `${appUrl}/game`,
        notification_id: ipnId,
        billing_address: {
          phone_number: phoneNumber,
          country_code: { KES:"KE", TZS:"TZ", UGX:"UG" }[currency] || "KE",
          first_name: user.fullName?.split(" ")[0] || "Player",
          last_name: user.fullName?.split(" ")[1] || "",
          email_address: user.email || "",
        },
      },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } }
    );

    await txnRef.update({ orderTrackingId: orderRes.data.order_tracking_id });

    return res.status(200).json({
      status: "pending",
      transactionId: txnRef.id,
      message: `M-PESA STK push sent to ${phoneNumber}. Please enter your PIN to confirm.`,
    });
  } catch (e) {
    console.error("Deposit error:", e.response?.data || e.message);
    // --- Addition 2: Mark transaction as failed on error ---
    if (txnRef) {
      await txnRef.update({ status: "failed", error: e.message }).catch(() => {});
    }
    return res.status(500).json({ error: e.response?.data?.message || e.message || "Failed" });
  }
}
