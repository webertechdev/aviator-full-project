import { useState, useEffect } from "react";
import { useGame } from "../hooks/useGame";
import { useAuth } from "../context/AuthContext";

const QUICK = [100, 200, 500, 10000];

function BetSlot({ slotIdx }) {
  const { gameState, gamePhase, bets, placeBet, cashout, currency, activeBalance, error } = useGame();
  const { profile } = useAuth();
  const [tab, setTab] = useState("manual"); // manual | auto
  const [stake, setStake] = useState(10);
  const [autoCashout, setAutoCashout] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);

  const min = { KES: 10, TZS: 1000, UGX: 500 }[currency] || 10;
  const bet = bets[slotIdx];

  // A bet can be placed if no bet exists in this slot AND game is waiting or flying (for early bet)
  const canPlaceNewBet = !bet && (gamePhase === "waiting" || gamePhase === "flying");
  // A bet can be cashed out if it's active, not cashed out, not lost, and game is flying
  const canCashout = bet && bet.status === "active" && !bet.cashedOut && !bet.lost && gamePhase === "flying";

  const potentialWin = bet && bet.status === "active" ? (bet.stake * (autoEnabled && bet.autoCashout ? bet.autoCashout : 1)).toFixed(2) : null;

  useEffect(() => {
    // Reset stake and auto-cashout when a bet is placed or round ends
    if (!bet) {
      setStake(10);
      setAutoCashout("");
      setAutoEnabled(false);
    }
  }, [bet]);

  function adjustStake(delta) {
    setStake(s => Math.max(min, Math.round((s + delta) / 10) * 10));
  }

  async function handleBet() {
    if (stake < min) return;
    await placeBet(slotIdx, stake, autoEnabled && autoCashout ? parseFloat(autoCashout) : null);
  }

  // Determine button text based on bet status and game phase
  let buttonText = "Bet";
  let buttonSubText = `${stake.toLocaleString()} ${currency}`;
  let buttonClass = "btn-bet";
  let buttonDisabled = !canPlaceNewBet || stake < min;

  if (bet) {
    if (bet.status === "pending_next_round") {
      buttonText = "Next Round Bet";
      buttonSubText = `${bet.stake.toLocaleString()} ${currency}`;
      buttonClass = "btn-bet-pending";
      buttonDisabled = true;
    } else if (bet.status === "active") {
      buttonText = "Bet Placed";
      buttonSubText = `${bet.stake.toLocaleString()} ${currency}`;
      buttonClass = "btn-bet-active";
      buttonDisabled = true;
    } else if (bet.status === "cashed_out") {
      buttonText = "✅ Cashed Out";
      buttonSubText = `${bet.winnings.toLocaleString()} ${currency}`;
      buttonClass = "btn-cashout-success";
      buttonDisabled = true;
    } else if (bet.status === "lost") {
      buttonText = "❌ Lost";
      buttonSubText = `${bet.stake.toLocaleString()} ${currency}`;
      buttonClass = "btn-bet-lost";
      buttonDisabled = true;
    }
  }

  return (
    <div className={`bet-slot ${bet ? "active-slot" : ""} ${bet?.lost ? "lost-slot" : ""} ${bet?.cashedOut ? "won-slot" : ""}`}>
      {/* Tabs */}
      <div className="bet-tabs">
        <button className={`bet-tab ${tab === "manual" ? "active" : ""}`} onClick={() => setTab("manual")}>Bet</button>
        <button className={`bet-tab ${tab === "auto" ? "active" : ""}`} onClick={() => setTab("auto")}>Auto</button>
      </div>

      {/* Stake control */}
      <div className="stake-control">
        <button className="stake-adj" onClick={() => adjustStake(-10)} disabled={!!bet}>−</button>
        <div className="stake-input-wrap">
          <input
            type="number" value={stake} min={min} step={10}
            onChange={e => setStake(Number(e.target.value))}
            disabled={!!bet}
          />
          <span className="stake-currency">{currency}</span>
        </div>
        <button className="stake-adj" onClick={() => adjustStake(10)} disabled={!!bet}>+</button>
      </div>

      {/* Quick amounts */}
      <div className="quick-amounts">
        {QUICK.map(q => (
          <button key={q} className="quick-amt" onClick={() => setStake(q)} disabled={!!bet}>
            {q.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Auto cashout toggle (in auto tab) */}
      {tab === "auto" && (
        <div className="auto-cashout-row">
          <label className="auto-label">
            <input type="checkbox" checked={autoEnabled}
              onChange={e => setAutoEnabled(e.target.checked)} disabled={!!bet} />
            Auto Cash Out at
          </label>
          <input
            type="number" className="auto-input" value={autoCashout} min="1.1" step="0.1"
            placeholder="2.00" onChange={e => setAutoCashout(e.target.value)}
            disabled={!autoEnabled || !!bet}
          />
          <span className="auto-x">✕</span>
        </div>
      )}

      {/* Main action button */}
      {canCashout ? (
        <button className="btn-cashout" onClick={() => cashout(slotIdx)}>
          <span>Cash Out</span>
          <span className="cashout-amount">{(bet.stake * multiplier).toFixed(2)} {currency}</span>
        </button>
      ) : (
        <button className={buttonClass} onClick={handleBet} disabled={buttonDisabled}>
          <span>{buttonText}</span>
          {!bet && <span className="bet-amount">{buttonSubText}</span>}
        </button>
      )}
    </div>
  );
}

export default function BettingPanel() {
  const { error, winNotif, currency } = useGame();
  return (
    <div className="betting-panel">
      {winNotif && (
        <div className="win-notif">
          🎉 Slot {winNotif.slotIdx + 1}: +{winNotif.winnings.toLocaleString()} {currency} @ {winNotif.mult.toFixed(2)}x
        </div>
      )}
      {error && <div className="bet-error">{error}</div>}
      <div className="bet-slots">
        <BetSlot slotIdx={0} />
        <BetSlot slotIdx={1} />
      </div>
    </div>
  );
}
