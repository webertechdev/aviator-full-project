import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../hooks/useGame";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import GameCanvas from "../components/GameCanvas";
import BettingPanel from "../components/BettingPanel";
import LeftPanel from "../components/LeftPanel";
import WalletModal from "../components/WalletModal";
import { useNavigate } from "react-router-dom";

function MultiplierBadge({ value }) {
  const v = parseFloat(value);
  const cls = v >= 10 ? "mult-badge gold" : v >= 2 ? "mult-badge blue" : "mult-badge red";
  return <span className={cls}>{value.toFixed ? value.toFixed(2) : value}x</span>;
}

export default function Game() {
  const { profile, logout, user } = useAuth();
  const { multiplier, gamePhase, pastMultipliers, currency, activeBalance } = useGame();
  const [walletMode, setWalletMode] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const navigate = useNavigate();

  async function toggleMode() {
    if (!user) return;
    const newMode = profile?.mode === "demo" ? "real" : "demo";
    await updateDoc(doc(db, "users", user.uid), { mode: newMode });
    window.location.reload();
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const multColor = gamePhase === "crashed" ? "#ff1744"
    : multiplier >= 10 ? "#ffd700"
    : multiplier >= 3 ? "#00e5ff"
    : "#ffffff";

  return (
    <div className={`game-page ${darkMode ? "dark-mode" : "light-mode"}`}>

      {/* TOP NAV */}
      <nav className="game-nav">
        <div className="nav-logo">
          <span className="logo-plane-nav">✈</span>
          <span className="logo-word">Aviator</span>
        </div>

        {/* Past multipliers scroll */}
        <div className="nav-history">
          {pastMultipliers.map((m, i) => <MultiplierBadge key={i} value={m} />)}
        </div>

        <div className="nav-right">
          {/* Mode toggle */}
          <button className={`mode-toggle ${profile?.mode === "demo" ? "demo-active" : "real-active"}`}
            onClick={toggleMode} title="Switch between Demo and Real">
            {profile?.mode === "demo" ? "🎮 Demo" : "💰 Real"}
          </button>

          {/* Balance */}
          <div className="nav-balance-wrap">
            <span className="nav-bal-label">{profile?.mode === "demo" ? "Demo" : "Balance"}</span>
            <span className="nav-balance">{activeBalance.toLocaleString()} {currency}</span>
          </div>

          {/* Dark/Light toggle */}
          <button className="dark-toggle" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
            {darkMode ? "☀️" : "🌙"}
          </button>

          {/* Deposit / Withdraw */}
          {profile?.mode !== "demo" && (
            <>
              <button className="btn-deposit" onClick={() => setWalletMode("deposit")}>+ Deposit</button>
              <button className="btn-withdraw" onClick={() => setWalletMode("withdraw")}>Withdraw</button>
            </>
          )}

          {/* User info */}
          <div className="nav-user">
            <span className="nav-username">{profile?.fullName?.split(" ")[0] || "Player"}</span>
            <button className="btn-logout" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      {/* Demo banner */}
      {profile?.mode === "demo" && (
        <div className="demo-mode-bar">
          🎮 FUN MODE &nbsp;|&nbsp; Demo balance: {(profile?.demoBalance || 0).toLocaleString()} {currency}
          &nbsp;|&nbsp; <button className="demo-switch-btn" onClick={toggleMode}>Switch to Real Money →</button>
        </div>
      )}

      {/* MAIN BODY */}
      <div className="game-body">

        {/* LEFT PANEL */}
        <div className="game-left">
          <LeftPanel />
        </div>

        {/* CENTER: Canvas + Betting */}
        <div className="game-center">
          {/* Multiplier display */}
          <div className="multiplier-display" style={{ color: multColor }}>
            {gamePhase === "crashed"
              ? `FLEW AWAY @ ${multiplier.toFixed(2)}x`
              : gamePhase === "waiting"
              ? <span className="waiting-text">Waiting for next round...</span>
              : `${multiplier.toFixed(2)}x`}
          </div>

          {/* Canvas */}
          <div className="canvas-wrap">
            <GameCanvas multiplier={multiplier} gamePhase={gamePhase} />
            {/* Provably fair badge */}
            <div className="provably-fair">🔒 Provably Fair Game</div>
          </div>

          {/* Betting panel */}
          <BettingPanel />
        </div>
      </div>

      {walletMode && <WalletModal mode={walletMode} onClose={() => setWalletMode(null)} />}
    </div>
  );
}
