import { useGame } from "../hooks/useGame";

export default function LiveBetsFeed() {
  const { liveBets } = useGame();

  return (
    <div className="live-feed">
      <h3 className="feed-title">🔴 Live Bets</h3>
      <div className="feed-header">
        <span>Player</span>
        <span>Stake</span>
        <span>Cashout</span>
        <span>Profit</span>
      </div>
      <div className="feed-rows">
        {liveBets.length === 0 && (
          <div className="feed-empty">Waiting for bets...</div>
        )}
        {liveBets.map((bet) => (
          <div key={bet.id} className={`feed-row ${bet.result || ""}`}>
            <span className="player-name">{maskEmail(bet.email)}</span>
            <span>{bet.stake?.toLocaleString()}</span>
            <span>{bet.cashoutMultiplier ? `${bet.cashoutMultiplier}x` : "—"}</span>
            <span className={bet.result === "win" ? "win-text" : bet.result === "lose" ? "lose-text" : ""}>
              {bet.result === "win"
                ? `+${bet.winnings?.toLocaleString()}`
                : bet.result === "lose"
                ? `-${bet.stake?.toLocaleString()}`
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function maskEmail(email) {
  if (!email) return "Player";
  const [user] = email.split("@");
  return user.length > 4 ? user.slice(0, 3) + "***" : user + "***";
}
