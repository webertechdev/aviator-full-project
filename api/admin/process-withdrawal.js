import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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

const PESAPAL_KEY    = process.env.PESAPAL_CONSUMER_KEY    || "KLg8UrH2NzfTvfeC4DuDXBQo2OPohmgH";
const PESAPAL_SECRET = process.env.PESAPAL_CONSUMER_SECRET || "EA1hRGKSXVrIdahZmOLE8uG3ZK8=";
const PESAPAL_BASE   = process.env.PESAPAL_BASE_URL        || "https://cybqa.pesapal.com/pesapalv3";

let _token = null, _expiry = 0;
async function getToken() {
  if (_token && Date.now() < _expiry) return _token;
  const r = await axios.post(
    `${PESAPAL_BASE}/api/Auth/RequestToken`,
    { consumer_key: PESAPAL_KEY, consumer_secret: PESAPAL_SECRET },
    { headers: { "Content-Type": "application/json", Accept: "application/json" } }
  );
  _token = r.data.token;
  _expiry = Date.now() + 4 * 60 * 1000;
  return _token;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { adminUid, transactionId, action, note } = req.body;
  if (!adminUid || !transactionId || !action)
    return res.status(400).json({ error: "Missing fields: adminUid, transactionId, action" });
  if (!["approve","decline"].includes(action))
    return res.status(400).json({ error: "action must be 'approve' or 'decline'" });

  // Verify admin role
  const adminDoc = await db.collection("users").doc(adminUid).get();
  if (!adminDoc.exists || adminDoc.data().role !== "admin")
    return res.status(403).json({ error: "Unauthorized — not an admin" });

  const txnRef = db.collection("transactions").doc(transactionId);
  const txnDoc = await txnRef.get();
  if (!txnDoc.exists) return res.status(404).json({ error: "Transaction not found" });

  const txn = txnDoc.data();
  if (txn.type !== "withdraw") return res.status(400).json({ error: "Not a withdrawal transaction" });
  if (txn.status !== "pending") return res.status(400).json({ error: `Already ${txn.status}` });

  if (action === "decline") {
    // Refund held balance back to user
    await db.collection("users").doc(txn.uid).update({
      balance: FieldValue.increment(txn.amount),
    });
    await txnRef.update({
      status: "declined",
      adminNote: note || null,
      processedAt: new Date().toISOString(),
      processedBy: adminUid,
    });
    return res.status(200).json({ status: "declined", message: "Withdrawal declined. Balance refunded." });
  }

  // approve — trigger Pesapal payout
  try {
    const token = await getToken();
    const appUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://your-app.vercel.app";

    const ipnRes = await axios.post(
      `${PESAPAL_BASE}/api/URLSetup/RegisterIPN`,
      { url: `${appUrl}/api/ipn`, ipn_notification_type: "POST" },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } }
    );

    await axios.post(
      `${PESAPAL_BASE}/api/Transactions/SubmitDisbursementRequest`,
      {
        id: transactionId,
        currency: txn.currency,
        amount: txn.amount,
        description: `Aviator withdrawal payout`,
        callback_url: `${appUrl}/api/ipn`,
        notification_id: ipnRes.data.ipn_id,
        disbursement_account: {
          account_number: txn.phoneNumber,
          account_name: txn.fullName || "Player",
          account_type: "MPESA",
        },
      },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" } }
    );

    await txnRef.update({
      status: "approved",
      adminNote: note || null,
      processedAt: new Date().toISOString(),
      processedBy: adminUid,
    });

    return res.status(200).json({ status: "approved", message: "Payout initiated via Pesapal." });
  } catch (e) {
    console.error("Payout error:", e.response?.data || e.message);
    return res.status(500).json({ error: "Payout failed: " + (e.response?.data?.message || e.message) });
  }
}
