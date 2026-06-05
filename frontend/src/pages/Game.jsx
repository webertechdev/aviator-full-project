import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../hooks/useGame";
import GameCanvas from "../components/GameCanvas";
import BettingPanel from "../components/BettingPanel";
import LiveBetsFeed from "../components/LiveBetsFeed";
import ChatPanel from "../components/ChatPanel";
import WalletModal from "../components/WalletModal";

export default function Game() {
  const { profile, logout } = useAuth();
  const { multiplier, gamePhase, pastMultipliers } = useGame();
  const [walletMode, setWalletMode] = useState(null);
  const navigate = useNavigate();

  function multiplierColor(m) {
    if (m >= 10) return "#ffd700";
    if (m >= 3) return "#00ff96";
    return "#ff6b6b";
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const currency = { KE: "KES", TZ: "TZS", UG: "UGX" }[profile?.country] || "KES";

  return (
    <div className="game-page">
      {/* Top Nav */}
      <nav className="game-nav">
        <div className="nav-logo">✈️ AVIATOR</div>
        <div className="nav-center">
          {pastMultipliers.map((m, i) => (
            <span key={i} className="past-mult" style={{ color: multiplierColor(m) }}>
              {m.toFixed(2)}x
            </span>
          ))}
        </div>
        <div className="nav-right">
          <span className="nav-balance">{(profile?.balance || 0).toLocaleString()} {currency}</span>
          <button className="nav-btn green" onClick={() => setWalletMode("deposit")}>+ Deposit</button>
          <button className="nav-btn red" onClick={() => setWalletMode("withdraw")}>Withdraw</button>
          <button className="nav-btn ghost" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="game-body">
        {/* Left: Canvas + Betting */}
        <div className="game-main">
          <div className="multiplier-display" style={{ color: gamePhase === "crashed" ? "#ff3c3c" : "#00ff96" }}>
            {gamePhase === "crashed"
              ? `CRASHED @ ${multiplier.toFixed(2)}x`
              : gamePhase === "waiting"
              ? "NEXT ROUND STARTING..."
              : `${multiplier.toFixed(2)}x`}
          </div>
          <div className="canvas-wrap">
            <GameCanvas multiplier={multiplier} gamePhase={gamePhase} />
          </div>
          <BettingPanel />
        </div>

        {/* Right: Live bets + Chat */}
        <div className="game-sidebar">
          <LiveBetsFeed />
          <ChatPanel />
        </div>
      </div>

      {walletMode && <WalletModal mode={walletMode} onClose={() => setWalletMode(null)} />}
    </div>
  );
}
