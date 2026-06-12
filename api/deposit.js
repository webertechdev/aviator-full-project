
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import IntaSend from "intasend-node";

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

const INTASEND_PUBLISHABLE_KEY = process.env.INTASEND_PUBLISHABLE_KEY;
const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY;
const INTASEND_TEST_MODE = process.env.INTASEND_TEST_MODE === "true";

const intasend = new IntaSend(
  INTASEND_PUBLISHABLE_KEY,
  INTASEND_SECRET_KEY,
  INTASEND_TEST_MODE
);

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
    return res.status(400).json({ error: `Minimum deposit is ${min.toLocaleString()} ${currency}` });

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

    const collection = intasend.collection();
    const stkPushRes = await collection.mpesaStkPush({
      first_name: user.fullName?.split(" ")[0] || "Player",
      last_name: user.fullName?.split(" ")[1] || "",
      email: user.email || "",
      host: req.headers.origin || "https://aviator-full-project.vercel.app", // Use request origin or default
      amount: rounded,
      phone_number: phoneNumber,
      api_ref: txnRef.id, // Use Firestore transaction ID as API reference
    });

    if (stkPushRes.status === "success") {
      await txnRef.update({ intasendInvoiceId: stkPushRes.invoice_id });
      return res.status(200).json({
        status: "pending",
        transactionId: txnRef.id,
        message: `M-PESA STK push sent to ${phoneNumber}. Please enter your PIN to confirm.`,
      });
    } else {
      throw new Error(stkPushRes.message || "Intasend STK Push failed");
    }

  } catch (e) {
    console.error("Deposit error:", e.message);
    if (txnRef) {
      await txnRef.update({ status: "failed", error: e.message }).catch(() => {});
    }
    return res.status(500).json({ error: e.message || "Failed to initiate deposit" });
  }
}
