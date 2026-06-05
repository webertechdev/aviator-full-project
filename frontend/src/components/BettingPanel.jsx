import { useState } from "react";
import { useGame } from "../hooks/useGame";
import { useAuth } from "../context/AuthContext";

const QUICK_STAKES = [50, 100, 200, 500, 1000];

export default function BettingPanel({ onWin }) {
  const { profile } = useAuth();
  const { gamePhase, activeBet, placeBet, cashout, error } = useGame();
  const [stake, setStake] = useState(100);
  const [autoCashout, setAutoCashout] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const currency = profile?.country === "TZ" ? "TZS" : profile?.country === "UG" ? "UGX" : "KES";
  const minStake = currency === "TZS" ? 10000 : currency === "UGX" ? 3000 : 100;

  async function handleBet() {
    if (stake < minStake) {
      setFeedback({ type: "error", msg: `Minimum stake is ${minStake} ${currency}` });
      return;
    }
    await placeBet(stake, autoEnabled ? parseFloat(autoCashout) : null);
  }

  async function handleCashout() {
    const winnings = await cashout();
    if (winnings) {
      setFeedback({ type: "win", msg: `+${winnings} ${currency} cashed out!` });
      onWin?.(winnings);
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  const canBet = gamePhase === "waiting" && !activeBet;
  const canCashout = gamePhase === "flying" && activeBet;

  return (
    <div className="betting-panel">
      <div className="balance-bar">
        <span>Balance</span>
        <strong>{(profile?.balance || 0).toLocaleString()} {currency}</strong>
      </div>

      {feedback && (
        <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>
      )}
      {error && <div className="feedback error">{error}</div>}

      <div className="stake-row">
        <label>Stake ({currency})</label>
        <input
          type="number"
          value={stake}
          min={minStake}
          step={10}
          onChange={(e) => setStake(Number(e.target.value))}
          disabled={!!activeBet}
        />
      </div>

      <div className="quick-stakes">
        {QUICK_STAKES.map((s) => (
          <button
            key={s}
            className={`quick-btn ${stake === s ? "active" : ""}`}
            onClick={() => setStake(s)}
            disabled={!!activeBet}
          >
            {s.toLocaleString()}
          </button>
        ))}
      </div>

      <div className="auto-row">
        <label>
          <input
            type="checkbox"
            checked={autoEnabled}
            onChange={(e) => setAutoEnabled(e.target.checked)}
            disabled={!!activeBet}
          />
          Auto Cashout at
        </label>
        <input
          type="number"
          value={autoCashout}
          min="1.1"
          step="0.1"
          placeholder="e.g. 2.0"
          onChange={(e) => setAutoCashout(e.target.value)}
          disabled={!autoEnabled || !!activeBet}
          style={{ width: 80 }}
        />
        <span>x</span>
      </div>

      {canCashout ? (
        <button className="action-btn cashout" onClick={handleCashout}>
          💰 CASH OUT
          <span className="multiplier-hint">@ current multiplier</span>
        </button>
      ) : (
        <button
          className="action-btn bet"
          onClick={handleBet}
          disabled={!canBet}
        >
          {activeBet ? "⏳ Bet Placed" : gamePhase === "flying" ? "✈️ Round in Progress" : "🎰 Place Bet"}
        </button>
      )}

      {activeBet && gamePhase === "flying" && (
        <div className="active-bet-info">
          Bet: {activeBet.stake.toLocaleString()} {currency}
          {activeBet.autoCashout && ` | Auto @ ${activeBet.autoCashout}x`}
        </div>
      )}
    </div>
  );
}
