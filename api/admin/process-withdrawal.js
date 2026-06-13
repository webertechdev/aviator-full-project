import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import IntaSend from "intasend-node";

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

const INTASEND_PUBLISHABLE_KEY = process.env.INTASEND_PUBLISHABLE_KEY;
const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY;
const INTASEND_TEST_MODE = process.env.INTASEND_TEST_MODE === "true";

const intasend = new IntaSend(
  INTASEND_PUBLISHABLE_KEY,
  INTASEND_SECRET_KEY,
  INTASEND_TEST_MODE
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { adminUid, transactionId, action, note } = req.body;

  if (!adminUid || !transactionId || !action) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = getFirebaseAdmin();

    const adminUserRef = db.collection("users").doc(adminUid);
    const adminUserSnap = await adminUserRef.get();
    if (!adminUserSnap.exists || adminUserSnap.data().role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const txnRef = db.collection("transactions").doc(transactionId);
    const txnSnap = await txnRef.get();

    if (!txnSnap.exists) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const txn = txnSnap.data();

    if (txn.type !== "withdraw" || txn.status !== "pending") {
      return res.status(400).json({ error: "Transaction is not a pending withdrawal" });
    }

    if (action === "approve") {
      // Decrement user balance and initiate IntaSend B2C payout
      await db.runTransaction(async (t) => {
        const userRef = db.collection("users").doc(txn.uid);
        const userSnap = await t.get(userRef);
        const currentBalance = userSnap.data().balance || 0;

        if (currentBalance < txn.amount) {
          throw new Error("Insufficient user balance for withdrawal");
        }

        t.update(userRef, { balance: FieldValue.increment(-txn.amount) });
        t.update(txnRef, {
          status: "approved",
          adminUid,
          adminNote: note,
          processedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // Initiate IntaSend B2C Payout
      const payout = intasend.payout();
      const result = await payout.send({
        phone_number: txn.phoneNumber,
        amount: txn.amount,
        currency: txn.currency,
        api_ref: transactionId,
      });

      if (result.status === "success") {
        await txnRef.update({
          intasendPayoutId: result.tracking_id,
          intasendStatus: result.status,
          status: "processing", // Status will be updated by IPN webhook
          updatedAt: serverTimestamp(),
        });
        return res.status(200).json({ message: "Withdrawal approved and payout initiated", trackingId: result.tracking_id });
      } else {
        // If IntaSend payout fails, refund the user and mark transaction as failed
        await db.collection("users").doc(txn.uid).update({
          balance: FieldValue.increment(txn.amount),
        });
        await txnRef.update({
          status: "failed",
          adminNote: (note || "") + "\nIntaSend payout failed: " + (result.message || "Unknown error"),
          updatedAt: serverTimestamp(),
        });
        return res.status(500).json({ error: result.message || "IntaSend payout failed" });
      }

    } else if (action === "decline") {
      await txnRef.update({
        status: "declined",
        adminUid,
        adminNote: note,
        processedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return res.status(200).json({ message: "Withdrawal declined" });
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
  } catch (e) {
    console.error("Process Withdrawal API error:", e.message, e.stack);
    return res.status(500).json({ error: e.message || "An unexpected error occurred" });
  }
}
