import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount, currency, phoneNumber } = req.body;

  if (!uid || !amount || !currency || !phoneNumber) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (isNaN(amount) || amount <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const min = MIN[currency];
  if (!min) return res.status(400).json({ error: `Unsupported currency: ${currency}` });
  const rounded = Math.round(amount / 10) * 10;
  if (rounded < min)
    return res.status(400).json({ error: `Minimum deposit is ${min.toLocaleString()} ${currency}` });

  if (!INTASEND_PUBLISHABLE_KEY) {
    console.error("INTASEND_PUBLISHABLE_KEY is not set.");
    return res.status(500).json({ error: "Server configuration error: Intasend key missing." });
  }

  let transactionRef;
  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    transactionRef = db.collection("transactions").doc();
    const transactionId = transactionRef.id;

    // Create a pending transaction in Firestore
    await transactionRef.set({
      id: transactionId,
      uid,
      amount: rounded,
      phoneNumber,
      country: userDoc.data().country, // Use country from user profile
      type: "deposit",
      status: "pending",
      currency,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Initiate Intasend STK Push
    const collection = intasend.collection();
    const response = await collection.mpesaStkPush({
      phone_number: phoneNumber,
      api_ref: transactionId, // Use our transaction ID as API reference
      amount: rounded,
      currency,
      details: {
        name: userDoc.data().fullName || "",
        email: userDoc.data().email || "",
      },
      host: req.headers.origin || "https://aviator-full-project.vercel.app", // Use request origin or default
    });

    // Update transaction with Intasend details
    if (response.status === "success") {
      await transactionRef.update({
        intasendCollectionId: response.collection_id,
        intasendInvoiceId: response.invoice_id,
        intasendStatus: response.status,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ message: "STK Push initiated", transactionId, intasendResponse: response });
    } else {
      throw new Error(response.message || "Intasend STK Push failed");
    }

  } catch (e) {
    console.error("Deposit API error:", e.message, e.response?.data);
    if (transactionRef) {
      await transactionRef.update({ status: "failed", error: e.message }).catch(() => {});
    }
    return res.status(500).json({ error: e.message || "Failed to initiate deposit" });
  }
}
