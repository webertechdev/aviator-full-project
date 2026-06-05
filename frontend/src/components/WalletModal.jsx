import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE || "https://us-central1-aviator-6827d.cloudfunctions.net";

const MIN = { KES: 100, TZS: 10000, UGX: 3000 };
const CURRENCY_MAP = { KE: "KES", TZ: "TZS", UG: "UGX" };

export default function WalletModal({ mode, onClose }) {
  const { user, profile } = useAuth();
  const currency = CURRENCY_MAP[profile?.country] || "KES";
  const min = MIN[currency];

  const [amount, setAmount] = useState(min);
  const [phone, setPhone] = useState(profile?.phone || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function submit() {
    setLoading(true);
    setResult(null);
    try {
      const endpoint = mode === "deposit" ? "deposit" : "withdraw";
      const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, amount, phoneNumber: phone, currency }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult({ success: true, msg: mode === "deposit"
        ? `STK push sent to ${phone}. Check your phone to confirm payment.`
        : `Withdrawal of ${amount} ${currency} is processing.`
      });
    } catch (e) {
      setResult({ success: false, msg: e.message });
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>{mode === "deposit" ? "💳 Deposit" : "💸 Withdraw"}</h2>
        <p className="modal-sub">Via M-PESA · {currency}</p>

        <label>Amount ({currency}, min {min.toLocaleString()})</label>
        <input
          type="number"
          value={amount}
          min={min}
          step={10}
          onChange={(e) => setAmount(Math.round(Number(e.target.value) / 10) * 10)}
        />

        <label>M-PESA Phone Number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. 254700000000"
        />

        {result && (
          <div className={`modal-result ${result.success ? "success" : "error"}`}>
            {result.msg}
          </div>
        )}

        <button className="modal-btn" onClick={submit} disabled={loading || amount < min}>
          {loading ? "Processing..." : mode === "deposit" ? "Send STK Push" : "Request Withdrawal"}
        </button>
      </div>
    </div>
  );
}
