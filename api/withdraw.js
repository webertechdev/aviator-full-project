
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

const MIN = { KES: 100, TZS: 10000, UGX: 3000 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, amount, currency, phoneNumber } = req.body;
  if (!uid || !amount || !currency || !phoneNumber)
    return res.status(400).json({ error: "Missing required fields" });

  if (isNaN(amount) || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const min = MIN[currency];
  if (!min) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
  const rounded = Math.round(amount / 10) * 10;
  if (rounded < min)
    return res.status(400).json({ error: `Minimum withdrawal is ${min.toLocaleString()} ${currency}` });

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
    const user = userDoc.data();

    // Check if user has sufficient balance for the withdrawal request
    const userBalance = user.balance || 0;
    if (rounded > userBalance) {
      return res.status(400).json({ error: "Insufficient balance for withdrawal request" });
    }

    // Create a pending withdrawal transaction. Balance is NOT decremented here.
    // It will be decremented upon admin approval and successful Intasend payout.
    const txnRef = db.collection("transactions").doc();
    await txnRef.set({
      id: txnRef.id, uid, type: "withdraw", amount: rounded,
      currency, phoneNumber, status: "pending",
      fullName: user.fullName || "",
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({
      status: "pending",
      transactionId: txnRef.id,
      message: `Withdrawal request of ${rounded.toLocaleString()} ${currency} submitted. Pending admin approval.`,
    });
  } catch (e) {
    console.error("Withdrawal request error:", e.message);
    return res.status(500).json({ error: e.message || "Failed to submit withdrawal request" });
  }
}
