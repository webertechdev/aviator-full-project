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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const {
      adminUid,
      transactionId,
      action,
      note,
    } = req.body;

    if (!adminUid || !transactionId || !action) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const adminDoc = await db
      .collection("users")
      .doc(adminUid)
      .get();

    if (!adminDoc.exists) {
      return res.status(404).json({
        error: "Admin not found",
      });
    }

    if (adminDoc.data().role !== "admin") {
      return res.status(403).json({
        error: "Unauthorized",
      });
    }

    const txnRef = db
      .collection("transactions")
      .doc(transactionId);

    const txnSnap = await txnRef.get();

    if (!txnSnap.exists) {
      return res.status(404).json({
        error: "Transaction not found",
      });
    }

    const txn = txnSnap.data();

    if (txn.type !== "withdraw") {
      return res.status(400).json({
        error: "Not a withdrawal request",
      });
    }

    if (txn.status !== "pending") {
      return res.status(400).json({
        error: "Already processed",
      });
    }

    if (action === "approve") {
      await txnRef.update({
        status: "approved",
        approvedBy: adminUid,
        approvedAt: new Date().toISOString(),
        adminNote: note || "",
      });

      return res.status(200).json({
        success: true,
        message: "Withdrawal approved",
      });
    }

    if (action === "decline") {
      await txnRef.update({
        status: "declined",
        approvedBy: adminUid,
        approvedAt: new Date().toISOString(),
        adminNote: note || "",
      });

      return res.status(200).json({
        success: true,
        message: "Withdrawal declined",
      });
    }

    return res.status(400).json({
      error: "Invalid action",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message,
    });
  }
}
