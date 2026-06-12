
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
  // Intasend webhooks typically send data in the request body
  const { invoice_id, state, api_ref, tracking_id, transaction_type } = req.body;

  // For deposit webhooks, we expect invoice_id and api_ref (our transaction ID)
  // For withdrawal webhooks (B2C), we expect tracking_id and transaction_type

  try {
    let txnRef;
    let isDeposit = false;
    let isWithdrawal = false;

    if (invoice_id && api_ref) { // Likely a deposit webhook
      txnRef = db.collection("transactions").doc(api_ref);
      isDeposit = true;
    } else if (tracking_id && transaction_type === "MPESA_B2C") { // Likely a withdrawal webhook
      // For withdrawals, the tracking_id from Intasend should match our transaction ID
      txnRef = db.collection("transactions").doc(tracking_id);
      isWithdrawal = true;
    } else {
      console.warn("Unknown Intasend webhook payload structure:", req.body);
      return res.status(400).json({ error: "Unknown webhook payload" });
    }

    const txnDoc = await txnRef.get();
    if (!txnDoc.exists) {
      console.error("Transaction not found for webhook:", req.body);
      return res.status(404).json({ error: "Transaction not found" });
    }
    const txn = txnDoc.data();

    let newStatus = "pending";
    if (state === "COMPLETE" || state === "SUCCESS") {
      newStatus = "success";
    } else if (state === "FAILED" || state === "CANCELLED") {
      newStatus = "failed";
    }

    await txnRef.update({
      status: newStatus,
      intasendStatus: state, // Store raw Intasend status
      updatedAt: new Date().toISOString(),
    });

    // Credit user balance on successful deposit
    if (isDeposit && newStatus === "success" && txn.type === "deposit") {
      await db.collection("users").doc(txn.uid).update({
        balance: FieldValue.increment(txn.amount),
      });
    }

    // For successful withdrawals, the balance would have been decremented already (held)
    // If a withdrawal fails, we need to refund the user.
    if (isWithdrawal && newStatus === "failed" && txn.type === "withdraw") {
      // Only refund if the transaction was previously marked as 'approved' or 'pending' for payout
      // and the balance was already decremented.
      // This logic assumes the balance is decremented at the time of admin approval.
      // If the original withdrawal request decremented the balance, then refund here.
      // Given the new flow, balance is decremented on admin approval, so if Intasend fails, we refund.
      if (txn.status === "approved" || txn.status === "processing") { // Assuming 'approved' means balance was held
        await db.collection("users").doc(txn.uid).update({
          balance: FieldValue.increment(txn.amount),
        });
        await txnRef.update({ adminNote: (txn.adminNote || "") + "\nRefunded due to Intasend payout failure." });
      }
    }

    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (e) {
    console.error("Intasend IPN error:", e.message, req.body);
    return res.status(500).json({ error: e.message || "Failed to process webhook" });
  }
}
