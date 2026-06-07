import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";

const MIN = { KES: 100, TZS: 10000, UGX: 3000 };
const CURRENCY = { KE: "KES", TZ: "TZS", UG: "UGX" };

export default function WalletModal({ mode, onClose }) {
  const { user, profile } = useAuth();
  const currency = CURRENCY[profile?.country] || "KES";
  const min = MIN[currency];

  const [amount, setAmount] = useState(min);
  const [phone, setPhone] = useState(profile?.phone || "");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("form"); // form | stk-sent | success | error
  const [message, setMessage] = useState("");
  const [txHistory, setTxHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  function loadHistory() {
    const q = query(collection(db, "transactions"), where("uid", "==", user.uid), orderBy("timestamp", "desc"), limit(10));
    const unsub = onSnapshot(q, snap => setTxHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    setShowHistory(true);
    return unsub;
  }

  const rounded = Math.round(amount / 10) * 10;

  async function handleDeposit() {
    if (rounded < min) { setMessage(`Minimum deposit is ${min.toLocaleString()} ${currency}`); return; }
    setLoading(true);
    try {
      // Call Vercel serverless API
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, amount: rounded, currency, phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deposit failed");

      // Log to Firestore
      await addDoc(collection(db, "transactions"), {
        uid: user.uid, type: "deposit", amount: rounded, currency,
        phoneNumber: phone, status: "pending",
        transactionId: data.transactionId || null,
        timestamp: serverTimestamp(),
      });

      setStage("stk-sent");
    } catch (e) {
      setMessage(e.message);
      setStage("error");
    }
    setLoading(false);
  }

  async function handleWithdraw() {
    if (rounded < min) { setMessage(`Minimum withdrawal is ${min.toLocaleString()} ${currency}`); return; }
    const bal = profile?.balance || 0;
    if (rounded > bal) { setMessage("Insufficient balance"); return; }
    setLoading(true);
    try {
      // Save withdrawal request — admin must approve
      await addDoc(collection(db, "transactions"), {
        uid: user.uid, type: "withdraw", amount: rounded, currency,
        phoneNumber: phone, status: "pending",
        fullName: profile?.fullName || "",
        timestamp: serverTimestamp(),
      });
      setStage("success");
      setMessage(`Withdrawal request of ${rounded.toLocaleString()} ${currency} submitted. Pending admin approval.`);
    } catch (e) {
      setMessage(e.message);
      setStage("error");
    }
    setLoading(false);
  }

  function statusColor(s) {
    if (s === "success" || s === "approved") return "#00e676";
    if (s === "declined" || s === "failed") return "#ff1744";
    return "#ffc107";
  }
  function statusLabel(s) {
    if (s === "pending") return "⏳ Pending";
    if (s === "approved" || s === "success") return "✅ Approved";
    if (s === "declined" || s === "failed") return "❌ Declined";
    return s;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <h2>{mode === "deposit" ? "💳 Deposit" : "💸 Withdraw"}</h2>
          <p className="modal-sub">Via M-PESA · {currency}</p>
        </div>

        {stage === "form" && (
          <>
            <label className="modal-label">Amount ({currency}, min {min.toLocaleString()})</label>
            <div className="modal-amount-row">
              <button onClick={() => setAmount(a => Math.max(min, Math.round((a - 100) / 10) * 10))}>−</button>
              <input type="number" value={amount} min={min} step={10}
                onChange={e => setAmount(Number(e.target.value))} />
              <button onClick={() => setAmount(a => Math.round((a + 100) / 10) * 10)}>+</button>
            </div>
            <div className="modal-quick">
              {[min, min*2, min*5, min*10].map(q => (
                <button key={q} className={`quick-modal-btn ${amount === q ? "active" : ""}`}
                  onClick={() => setAmount(q)}>{q.toLocaleString()}</button>
              ))}
            </div>

            <label className="modal-label">M-PESA Phone Number</label>
            <input className="modal-input" type="tel" value={phone}
              onChange={e => setPhone(e.target.value)} placeholder="254712345678" />

            {message && <div className="modal-error">{message}</div>}

            <button className="modal-action-btn" disabled={loading || rounded < min}
              onClick={mode === "deposit" ? handleDeposit : handleWithdraw}>
              {loading ? "Processing..." : mode === "deposit" ? "Send STK Push" : "Request Withdrawal"}
            </button>
          </>
        )}

        {stage === "stk-sent" && (
          <div className="modal-stk-sent">
            <div className="stk-icon">📱</div>
            <h3>STK Push Sent!</h3>
            <p className="stk-msg">
              An M-PESA payment request of <strong>{rounded.toLocaleString()} {currency}</strong> has been sent to <strong>{phone}</strong>.
            </p>
            <div className="stk-steps">
              <div className="stk-step">1. Check your phone for the M-PESA prompt</div>
              <div className="stk-step">2. Enter your <strong>M-PESA PIN</strong> to confirm</div>
              <div className="stk-step">3. Your balance will update automatically</div>
            </div>
            <button className="modal-action-btn" onClick={onClose}>Done</button>
          </div>
        )}

        {stage === "success" && (
          <div className="modal-success-state">
            <div className="success-icon">✅</div>
            <p>{message}</p>
            <div className="withdraw-status-guide">
              <div className="status-item"><span style={{color:"#ffc107"}}>⏳ Pending</span> — Request received, awaiting admin review</div>
              <div className="status-item"><span style={{color:"#00e676"}}>✅ Approved</span> — Funds sent to your M-PESA</div>
              <div className="status-item"><span style={{color:"#ff1744"}}>❌ Declined</span> — Contact support for assistance</div>
            </div>
            <button className="modal-action-btn" onClick={onClose}>Close</button>
          </div>
        )}

        {stage === "error" && (
          <div className="modal-error-state">
            <div className="error-icon">❌</div>
            <p>{message}</p>
            <button className="modal-action-btn" onClick={() => setStage("form")}>Try Again</button>
          </div>
        )}

        {/* Transaction history toggle */}
        <button className="history-toggle" onClick={loadHistory}>
          {showHistory ? "Hide" : "View"} Transaction History
        </button>
        {showHistory && (
          <div className="tx-history">
            {txHistory.map(tx => (
              <div key={tx.id} className="tx-row">
                <span className={`tx-type ${tx.type}`}>{tx.type}</span>
                <span>{tx.amount?.toLocaleString()} {tx.currency}</span>
                <span style={{ color: statusColor(tx.status), fontSize: 12 }}>{statusLabel(tx.status)}</span>
              </div>
            ))}
            {!txHistory.length && <div className="empty-state">No transactions yet</div>}
          </div>
        )}
      </div>
    </div>
  );
}
