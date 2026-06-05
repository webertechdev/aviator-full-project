const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const { db, admin } = require("./admin");
const pesapal = require("./pesapal");
const { generateMultiplier, calculateWinnings, roundDuration } = require("./gameEngine");

const CALLBACK_BASE = "https://us-central1-aviator-6827d.cloudfunctions.net";
const FRONTEND_URL = "https://aviator-6827d.web.app"; // update after Vercel deploy

// ─── Helper ────────────────────────────────────────────────
function validateAmount(amount, currency) {
  const rounded = Math.round(amount / 10) * 10;
  const mins = { KES: 100, TZS: 10000, UGX: 3000 };
  const min = mins[currency];
  if (!min) throw { code: 400, message: `Unsupported currency: ${currency}` };
  if (rounded < min) throw { code: 400, message: `Minimum is ${min} ${currency}` };
  return rounded;
}

function wrap(fn) {
  return (req, res) => cors(req, res, async () => {
    try {
      await fn(req, res);
    } catch (e) {
      const code = e.code || 500;
      const message = e.message || "Internal error";
      functions.logger.error("Function error:", e);
      res.status(code).json({ error: message });
    }
  });
}

// ─── DEPOSIT ───────────────────────────────────────────────
exports.deposit = functions.https.onRequest(wrap(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { uid, amount, currency, phoneNumber } = req.body;

  if (!uid || !amount || !currency) return res.status(400).json({ error: "Missing fields" });

  // Validate user
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: "User not found" });
  const user = userSnap.data();

  const rounded = validateAmount(amount, currency);
  const phone = phoneNumber || user.phone;
  if (!phone) return res.status(400).json({ error: "No phone number on record" });

  const txnRef = db.collection("transactions").doc();
  const txnId = txnRef.id;

  // Save pending transaction
  await txnRef.set({
    id: txnId,
    uid,
    type: "deposit",
    amount: rounded,
    currency,
    phoneNumber: phone,
    status: "pending",
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Get IPN ID
  const ipnId = await pesapal.registerIPN(`${CALLBACK_BASE}/pesapalIPN`);

  // Trigger STK push
  const pesapalRes = await pesapal.submitStkPush({
    amount: rounded,
    currency,
    phoneNumber: phone,
    description: `Aviator deposit - ${uid}`,
    callbackUrl: `${FRONTEND_URL}/payment-callback`,
    ipnId,
    referenceId: txnId,
  });

  // Update with tracking ID
  await txnRef.update({
    orderTrackingId: pesapalRes.order_tracking_id,
    pesapalRef: pesapalRes,
  });

  res.json({ status: "pending", transactionId: txnId, phoneNumber: phone, currency });
}));

// ─── WITHDRAW ──────────────────────────────────────────────
exports.withdraw = functions.https.onRequest(wrap(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { uid, amount, currency, phoneNumber } = req.body;

  if (!uid || !amount || !currency) return res.status(400).json({ error: "Missing fields" });

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: "User not found" });
  const user = userSnap.data();

  const rounded = validateAmount(amount, currency);
  if (rounded > user.balance) return res.status(400).json({ error: "Insufficient balance" });

  const phone = phoneNumber || user.phone;

  const txnRef = db.collection("transactions").doc();
  const txnId = txnRef.id;

  // Deduct balance atomically
  await db.runTransaction(async (t) => {
    const snap = await t.get(db.collection("users").doc(uid));
    const bal = snap.data().balance;
    if (rounded > bal) throw { code: 400, message: "Insufficient balance" };
    t.update(db.collection("users").doc(uid), { balance: bal - rounded });
    t.set(txnRef, {
      id: txnId, uid, type: "withdraw", amount: rounded, currency,
      phoneNumber: phone, status: "processing",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  const ipnId = await pesapal.registerIPN(`${CALLBACK_BASE}/pesapalIPN`);
  await pesapal.submitPayout({
    amount: rounded, currency, phoneNumber: phone,
    referenceId: txnId, description: `Aviator withdrawal - ${uid}`,
    callbackUrl: `${FRONTEND_URL}/payment-callback`, ipnId,
  });

  res.json({ status: "processing", transactionId: txnId });
}));

// ─── PESAPAL IPN CALLBACK ──────────────────────────────────
exports.pesapalIPN = functions.https.onRequest(wrap(async (req, res) => {
  const { orderTrackingId, orderMerchantReference } = req.body;
  if (!orderTrackingId) return res.status(400).json({ error: "Missing tracking ID" });

  const status = await pesapal.getTransactionStatus(orderTrackingId);
  const txnSnap = await db.collection("transactions").doc(orderMerchantReference).get();
  if (!txnSnap.exists) return res.status(404).json({ error: "Transaction not found" });

  const txn = txnSnap.data();
  const isPaid = status.payment_status_description === "Completed";

  await txnSnap.ref.update({ status: isPaid ? "success" : "failed", pesapalStatus: status });

  // Credit balance on successful deposit
  if (isPaid && txn.type === "deposit") {
    await db.collection("users").doc(txn.uid).update({
      balance: admin.firestore.FieldValue.increment(txn.amount),
    });
  }

  // Refund on failed withdrawal
  if (!isPaid && txn.type === "withdraw" && txn.status === "processing") {
    await db.collection("users").doc(txn.uid).update({
      balance: admin.firestore.FieldValue.increment(txn.amount),
    });
  }

  res.json({ orderNotificationType: "IPNCHANGE", orderTrackingId, orderMerchantReference, status: "200" });
}));

// ─── START ROUND (admin only) ──────────────────────────────
exports.startRound = functions.https.onRequest(wrap(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { adminId } = req.body;

  const adminSnap = await db.collection("users").doc(adminId).get();
  if (!adminSnap.exists || adminSnap.data().role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const crashMultiplier = generateMultiplier();
  const roundRef = db.collection("rounds").doc();
  const roundId = roundRef.id;
  const duration = roundDuration(crashMultiplier);

  // Set game state to flying
  await db.collection("gameState").doc("current").set({
    roundId,
    phase: "flying",
    crashMultiplier,
    startTime: admin.firestore.FieldValue.serverTimestamp(),
  });

  await roundRef.set({
    id: roundId,
    crashMultiplier,
    phase: "flying",
    startTime: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Schedule crash
  setTimeout(async () => {
    await db.collection("gameState").doc("current").update({
      phase: "crashed",
      endTime: admin.firestore.FieldValue.serverTimestamp(),
    });
    await roundRef.update({
      phase: "crashed",
      endTime: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Auto-lose all uncashed bets for this round
    const betsSnap = await db.collection("bets")
      .where("roundId", "==", roundId)
      .where("result", "==", "pending")
      .get();

    const batch = db.batch();
    betsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { result: "lose", cashoutMultiplier: null });
    });
    await batch.commit();

    // Wait 5s then set waiting phase
    setTimeout(async () => {
      await db.collection("gameState").doc("current").update({ phase: "waiting" });
    }, 5000);
  }, duration);

  res.json({ roundId, crashMultiplier, status: "started", durationMs: duration });
}));

// ─── PLACE BET ─────────────────────────────────────────────
exports.placeBet = functions.https.onRequest(wrap(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { uid, roundId, stake, autoCashout } = req.body;

  if (!uid || !roundId || !stake) return res.status(400).json({ error: "Missing fields" });

  // Validate round is in waiting phase
  const gameState = await db.collection("gameState").doc("current").get();
  if (!gameState.exists || gameState.data().phase !== "waiting") {
    return res.status(400).json({ error: "Round not accepting bets" });
  }

  const betRef = db.collection("bets").doc();
  const betId = betRef.id;

  await db.runTransaction(async (t) => {
    const userSnap = await t.get(db.collection("users").doc(uid));
    const bal = userSnap.data().balance;
    if (stake > bal) throw { code: 400, message: "Insufficient balance" };
    t.update(db.collection("users").doc(uid), { balance: bal - stake });
    t.set(betRef, {
      id: betId, uid, roundId, stake, autoCashout: autoCashout || null,
      result: "pending", cashoutMultiplier: null, winnings: null,
      email: userSnap.data().email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  res.json({ betId, status: "accepted" });
}));

// ─── CASHOUT ───────────────────────────────────────────────
exports.cashout = functions.https.onRequest(wrap(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { uid, betId, roundId } = req.body;

  const gameState = await db.collection("gameState").doc("current").get();
  if (!gameState.exists || gameState.data().phase !== "flying") {
    return res.status(400).json({ error: "Round not in flight" });
  }
  if (gameState.data().roundId !== roundId) {
    return res.status(400).json({ error: "Round mismatch" });
  }

  // Compute current multiplier server-side
  const startMs = gameState.data().startTime?.toMillis?.() || Date.now();
  const elapsed = (Date.now() - startMs) / 1000;
  const currentMultiplier = Math.min(
    Math.round(Math.pow(Math.E, 0.06 * elapsed) * 100) / 100,
    gameState.data().crashMultiplier
  );

  const betSnap = await db.collection("bets").doc(betId).get();
  if (!betSnap.exists || betSnap.data().uid !== uid) {
    return res.status(404).json({ error: "Bet not found" });
  }
  if (betSnap.data().result !== "pending") {
    return res.status(400).json({ error: "Bet already settled" });
  }

  const winnings = calculateWinnings(betSnap.data().stake, currentMultiplier);

  await db.runTransaction(async (t) => {
    t.update(db.collection("bets").doc(betId), {
      result: "win", cashoutMultiplier: currentMultiplier, winnings,
    });
    t.update(db.collection("users").doc(uid), {
      balance: admin.firestore.FieldValue.increment(winnings),
    });
  });

  res.json({ status: "success", winnings, cashoutMultiplier: currentMultiplier });
}));

// ─── HISTORY ───────────────────────────────────────────────
exports.history = functions.https.onRequest(wrap(async (req, res) => {
  const uid = req.params[0]?.replace(/^\//, "") || req.query.uid;
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  const [betsSnap, txnSnap] = await Promise.all([
    db.collection("bets").where("uid", "==", uid).orderBy("timestamp", "desc").limit(50).get(),
    db.collection("transactions").where("uid", "==", uid).orderBy("timestamp", "desc").limit(50).get(),
  ]);

  res.json({
    bets: betsSnap.docs.map((d) => d.data()),
    transactions: txnSnap.docs.map((d) => d.data()),
  });
}));

// ─── AUTO ROUND SCHEDULER (Pub/Sub, every minute) ─────────
exports.autoStartRound = functions.pubsub.schedule("every 1 minutes").onRun(async () => {
  const gameState = await db.collection("gameState").doc("current").get();
  if (gameState.exists && gameState.data().phase !== "waiting") return null;

  const crashMultiplier = generateMultiplier();
  const roundRef = db.collection("rounds").doc();
  const roundId = roundRef.id;
  const duration = roundDuration(crashMultiplier);

  await db.collection("gameState").doc("current").set({
    roundId, phase: "flying", crashMultiplier,
    startTime: admin.firestore.FieldValue.serverTimestamp(),
  });
  await roundRef.set({
    id: roundId, crashMultiplier, phase: "flying",
    startTime: admin.firestore.FieldValue.serverTimestamp(),
  });

  setTimeout(async () => {
    await db.collection("gameState").doc("current").update({
      phase: "crashed", endTime: admin.firestore.FieldValue.serverTimestamp(),
    });
    await roundRef.update({ phase: "crashed", endTime: admin.firestore.FieldValue.serverTimestamp() });

    const betsSnap = await db.collection("bets")
      .where("roundId", "==", roundId).where("result", "==", "pending").get();
    const batch = db.batch();
    betsSnap.docs.forEach((doc) => batch.update(doc.ref, { result: "lose" }));
    await batch.commit();

    setTimeout(async () => {
      await db.collection("gameState").doc("current").update({ phase: "waiting" });
    }, 5000);
  }, duration);

  return null;
});
