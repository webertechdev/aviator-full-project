import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Robust Firebase Initialization
function getFirebaseAdmin() {
  if (getApps().length) return getFirestore();
  
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Decode the base64 encoded private key
  const privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase credentials: Check project_id, client_email, and private_key_base64.");
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return getFirestore();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, amount, currency, phoneNumber, fullName, email } = req.body;

  if (!uid || !amount || !currency || !phoneNumber || !fullName || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    const db = getFirebaseAdmin();

    // Check if user exists and has sufficient balance
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "User not found" });
    }
    const currentBalance = userSnap.data().balance || 0;

    // In the new flow, balance is only decremented on admin approval and successful payout.
    // Here, we just create a pending transaction.
    const transactionRef = db.collection("transactions").doc();
    await transactionRef.set({
      id: transactionRef.id,
      uid,
      type: "withdraw",
      amount: parseFloat(amount),
      currency,
      phoneNumber,
      fullName,
      email,
      status: "pending", // Mark as pending for admin approval
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return res.status(200).json({ message: "Withdrawal request submitted for approval", transactionId: transactionRef.id });
  } catch (e) {
    console.error("Withdraw API error:", e.message, e.stack);
    return res.status(500).json({ error: e.message || "An unexpected error occurred" });
  }
}
