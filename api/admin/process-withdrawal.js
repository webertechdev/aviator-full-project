
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
    return res.status(400).json({ error: "action must be \'approve\' or \'decline\'" });

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
    // Refund held balance back to user (if it was held, which it isn't in the new flow)
    // In the new flow, balance is only decremented on successful payout.
    // So, for decline, we just update the transaction status.
    await txnRef.update({
      status: "declined",
      adminNote: note || null,
      processedAt: new Date().toISOString(),
      processedBy: adminUid,
    });
    return res.status(200).json({ status: "declined", message: "Withdrawal declined." });
  }

  // approve — trigger Intasend payout and decrement user balance
  try {
    // First, decrement the user's balance
    const userRef = db.collection("users").doc(txn.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new Error("User not found for withdrawal");
    const user = userDoc.data();

    if (txn.amount > (user.balance || 0)) {
      // This should ideally not happen if frontend validates, but as a safeguard
      await txnRef.update({
        status: "failed",
        adminNote: (note || "") + "\nFailed: Insufficient user balance at time of approval.",
        processedAt: new Date().toISOString(),
        processedBy: adminUid,
      });
      return res.status(400).json({ error: "Insufficient user balance for payout." });
    }

    await userRef.update({ balance: FieldValue.increment(-txn.amount) });

    // Then, initiate Intasend B2C payout
    const payouts = intasend.payouts();
    const payoutRes = await payouts.mpesa({
      currency: txn.currency,
      requires_approval: "NO", // Admin has already approved
      transactions: [{
        name: txn.fullName || "Player",
        account: txn.phoneNumber,
        amount: txn.amount,
        narrative: `Aviator withdrawal for ${txn.fullName || txn.uid}`,
      }],
    });

    if (payoutRes.status === "success") {
      await txnRef.update({
        status: "approved", // Status is approved, actual payout status will be updated by IPN
        adminNote: note || null,
        processedAt: new Date().toISOString(),
        processedBy: adminUid,
        intasendTrackingId: payoutRes.tracking_id, // Store Intasend tracking ID
      });
      return res.status(200).json({ status: "approved", message: "Payout initiated via Intasend." });
    } else {
      // If Intasend initiation fails, refund the user and mark transaction as failed
      await userRef.update({ balance: FieldValue.increment(txn.amount) }); // Refund
      await txnRef.update({
        status: "failed",
        adminNote: (note || "") + `\nIntasend payout initiation failed: ${payoutRes.message || "Unknown error"}`,
        processedAt: new Date().toISOString(),
        processedBy: adminUid,
      });
      throw new Error(payoutRes.message || "Intasend payout initiation failed");
    }

  } catch (e) {
    console.error("Payout error:", e.message);
    return res.status(500).json({ error: "Payout failed: " + (e.message || "Unknown error") });
  }
}
