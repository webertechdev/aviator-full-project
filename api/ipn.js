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

const PESAPAL_KEY    = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_BASE   = process.env.PESAPAL_BASE_URL;
  const { orderTrackingId, orderMerchantReference } = { ...req.body, ...req.query };
  if (!orderTrackingId || !orderMerchantReference)
    return res.status(400).json({ error: "Missing IPN params" });

  try {
    const authRes = await axios.post(
      `${PESAPAL_BASE}/api/Auth/RequestToken`,
      { consumer_key: PESAPAL_KEY, consumer_secret: PESAPAL_SECRET },
      { headers: { "Content-Type": "application/json", Accept: "application/json" } }
    );
    const token = authRes.data.token;

    const statusRes = await axios.get(
      `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    const statusData = statusRes.data;
   const isPaid = statusData.payment_status_description === "Completed";
    const txnRef = db.collection("transactions").doc(orderMerchantReference);
    const txnDoc = await txnRef.get();
    if (!txnDoc.exists) return res.status(404).json({ error: "Transaction not found" });
    const txn = txnDoc.data();

    await txnRef.update({
      status: isPaid ? "success" : "failed",
      pesapalStatus: statusData,
      updatedAt: new Date().toISOString(),
    });

    // Credit user balance on successful deposit
    if (isPaid && txn.type === "deposit") {
      await db.collection("users").doc(txn.uid).update({
        balance: FieldValue.increment(txn.amount),
      });
    }

    return res.status(200).json({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId,
      orderMerchantReference,
      status: "200",
    });
  } catch (e) {
    console.error("IPN error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
