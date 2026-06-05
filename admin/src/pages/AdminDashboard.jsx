import { useEffect, useState } from "react";
import {
  collection, getDocs, onSnapshot, query,
  orderBy, limit, where, doc, updateDoc, Timestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAdminAuth } from "../hooks/useAdminAuth";

const API_BASE = "https://us-central1-aviator-6827d.cloudfunctions.net";

export default function AdminDashboard() {
  const { admin, logout } = useAdminAuth();
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [bets, setBets] = useState([]);
  const [stats, setStats] = useState({ deposits: 0, withdrawals: 0, activeUsers: 0, betVolume: 0 });
  const [chatFilter, setChatFilter] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [uSnap, tSnap, rSnap, bSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(200))),
      getDocs(query(collection(db, "rounds"), orderBy("startTime", "desc"), limit(50))),
      getDocs(query(collection(db, "bets"), orderBy("timestamp", "desc"), limit(200))),
    ]);

    const usersData = uSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const txns = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const roundsData = rSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const betsData = bSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    setUsers(usersData);
    setTransactions(txns);
    setRounds(roundsData);
    setBets(betsData);

    const deps = txns.filter((t) => t.type === "deposit" && t.status === "success");
    const wds = txns.filter((t) => t.type === "withdraw" && t.status === "success");
    const yesterday = Date.now() - 86400000;
    const active = new Set(betsData.filter((b) => b.timestamp?.toMillis?.() > yesterday).map((b) => b.uid));

    setStats({
      deposits: deps.reduce((s, t) => s + t.amount, 0),
      withdrawals: wds.reduce((s, t) => s + t.amount, 0),
      activeUsers: active.size,
      betVolume: betsData.reduce((s, b) => s + (b.stake || 0), 0),
    });
  }

  async function toggleChat(uid, current) {
    await updateDoc(doc(db, "users", uid), { chatEnabled: !current });
    setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, chatEnabled: !current } : u));
  }

  async function triggerRound() {
    await fetch(`${API_BASE}/startRound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId: admin.uid }),
    });
    alert("Round started!");
  }

  const countryBreakdown = users.reduce((acc, u) => {
    acc[u.country] = (acc[u.country] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navLogo}>✈️ AVIATOR ADMIN</span>
        <div style={styles.navTabs}>
          {["overview", "users", "transactions", "rounds", "bets"].map((t) => (
            <button key={t} style={{ ...styles.tabBtn, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => setTab(t)}>{t.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={styles.roundBtn} onClick={triggerRound}>▶ Start Round</button>
          <button style={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div style={styles.content}>
        {/* OVERVIEW */}
        {tab === "overview" && (
          <div>
            <h2 style={styles.heading}>Analytics Overview</h2>
            <div style={styles.statsGrid}>
              <StatCard label="Total Deposits" value={`KES ${stats.deposits.toLocaleString()}`} color="#00ff96" />
              <StatCard label="Total Withdrawals" value={`KES ${stats.withdrawals.toLocaleString()}`} color="#ff3c3c" />
              <StatCard label="Active Users (24h)" value={stats.activeUsers} color="#ffd700" />
              <StatCard label="Bet Volume" value={`KES ${stats.betVolume.toLocaleString()}`} color="#a78bfa" />
            </div>

            <h3 style={styles.subheading}>Country Breakdown</h3>
            <div style={styles.statsGrid}>
              {Object.entries(countryBreakdown).map(([c, n]) => (
                <StatCard key={c} label={c} value={`${n} users`} color="#60a5fa" />
              ))}
            </div>

            <h3 style={styles.subheading}>Recent Round Multipliers</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {rounds.slice(0, 20).map((r) => (
                <span key={r.id} style={{
                  ...styles.multBadge,
                  color: r.crashMultiplier >= 10 ? "#ffd700" : r.crashMultiplier >= 3 ? "#00ff96" : "#ff6b6b"
                }}>{r.crashMultiplier?.toFixed(2)}x</span>
              ))}
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === "users" && (
          <div>
            <h2 style={styles.heading}>Users ({users.length})</h2>
            <input style={styles.search} placeholder="Filter by email..."
              value={chatFilter} onChange={(e) => setChatFilter(e.target.value)} />
            <table style={styles.table}>
              <thead><tr>
                {["Email", "Phone", "Country", "Balance", "Role", "Chat", "Actions"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {users.filter((u) => !chatFilter || u.email?.includes(chatFilter)).map((u) => (
                  <tr key={u.id} style={styles.tr}>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>{u.phone}</td>
                    <td style={styles.td}>{u.country}</td>
                    <td style={styles.td}>{u.balance?.toLocaleString()}</td>
                    <td style={styles.td}>
                      <span style={{ color: u.role === "admin" ? "#ffd700" : "#a0aec0" }}>{u.role}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: u.chatEnabled ? "#00ff96" : "#ff3c3c" }}>
                        {u.chatEnabled ? "✓ Yes" : "✗ No"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button style={styles.actionBtn} onClick={() => toggleChat(u.id, u.chatEnabled)}>
                        {u.chatEnabled ? "Revoke Chat" : "Allow Chat"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TRANSACTIONS */}
        {tab === "transactions" && (
          <div>
            <h2 style={styles.heading}>Transactions ({transactions.length})</h2>
            <table style={styles.table}>
              <thead><tr>
                {["ID", "UID", "Type", "Amount", "Currency", "Phone", "Status", "Time"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} style={styles.tr}>
                    <td style={styles.td}>{t.id?.slice(0, 8)}...</td>
                    <td style={styles.td}>{t.uid?.slice(0, 8)}...</td>
                    <td style={styles.td}>
                      <span style={{ color: t.type === "deposit" ? "#00ff96" : "#ff3c3c" }}>
                        {t.type}
                      </span>
                    </td>
                    <td style={styles.td}>{t.amount?.toLocaleString()}</td>
                    <td style={styles.td}>{t.currency}</td>
                    <td style={styles.td}>{t.phoneNumber}</td>
                    <td style={styles.td}>
                      <span style={{ color: t.status === "success" ? "#00ff96" : t.status === "failed" ? "#ff3c3c" : "#ffd700" }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={styles.td}>{t.timestamp?.toDate?.()?.toLocaleString() || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ROUNDS */}
        {tab === "rounds" && (
          <div>
            <h2 style={styles.heading}>Round History ({rounds.length})</h2>
            <table style={styles.table}>
              <thead><tr>
                {["Round ID", "Crash Multiplier", "Phase", "Start", "End"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}>{r.id?.slice(0, 10)}...</td>
                    <td style={styles.td}>
                      <span style={{ color: r.crashMultiplier >= 10 ? "#ffd700" : r.crashMultiplier >= 3 ? "#00ff96" : "#ff6b6b", fontWeight: "bold" }}>
                        {r.crashMultiplier?.toFixed(2)}x
                      </span>
                    </td>
                    <td style={styles.td}>{r.phase}</td>
                    <td style={styles.td}>{r.startTime?.toDate?.()?.toLocaleString() || "—"}</td>
                    <td style={styles.td}>{r.endTime?.toDate?.()?.toLocaleString() || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BETS */}
        {tab === "bets" && (
          <div>
            <h2 style={styles.heading}>Bets ({bets.length})</h2>
            <table style={styles.table}>
              <thead><tr>
                {["Bet ID", "Email", "Round", "Stake", "Auto Cashout", "Result", "Multiplier", "Winnings"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {bets.map((b) => (
                  <tr key={b.id} style={styles.tr}>
                    <td style={styles.td}>{b.id?.slice(0, 8)}...</td>
                    <td style={styles.td}>{b.email}</td>
                    <td style={styles.td}>{b.roundId?.slice(0, 8)}...</td>
                    <td style={styles.td}>{b.stake?.toLocaleString()}</td>
                    <td style={styles.td}>{b.autoCashout ? `${b.autoCashout}x` : "—"}</td>
                    <td style={styles.td}>
                      <span style={{ color: b.result === "win" ? "#00ff96" : b.result === "lose" ? "#ff3c3c" : "#ffd700" }}>
                        {b.result}
                      </span>
                    </td>
                    <td style={styles.td}>{b.cashoutMultiplier ? `${b.cashoutMultiplier}x` : "—"}</td>
                    <td style={styles.td}>{b.winnings?.toLocaleString() || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#111422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'Orbitron', sans-serif" }}>{value}</div>
    </div>
  );
}

const styles = {
  page: { background: "#0a0c14", minHeight: "100vh", color: "#e8eaf0", fontFamily: "'Share Tech Mono', monospace" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", background: "#111422", borderBottom: "1px solid rgba(255,255,255,0.07)", gap: 12, flexWrap: "wrap" },
  navLogo: { fontFamily: "'Orbitron', sans-serif", color: "#00ff96", fontWeight: 900, fontSize: 18, letterSpacing: 2 },
  navTabs: { display: "flex", gap: 4 },
  tabBtn: { background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "6px 12px", borderRadius: 6, fontSize: 11, letterSpacing: 1, fontFamily: "inherit" },
  tabActive: { background: "rgba(255,255,255,0.08)", color: "#fff" },
  roundBtn: { background: "#00ff96", color: "#000", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontWeight: "bold", fontFamily: "inherit" },
  logoutBtn: { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" },
  content: { padding: 24 },
  heading: { fontFamily: "'Orbitron', sans-serif", marginBottom: 20, letterSpacing: 2 },
  subheading: { fontFamily: "'Orbitron', sans-serif", marginTop: 28, marginBottom: 14, fontSize: 14, color: "rgba(255,255,255,0.6)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 20 },
  multBadge: { background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontFamily: "'Orbitron', sans-serif" },
  search: { background: "#111422", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0", padding: "8px 14px", borderRadius: 8, fontFamily: "inherit", marginBottom: 16, width: 300, fontSize: 13 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { background: "#111422", padding: "10px 12px", textAlign: "left", color: "rgba(255,255,255,0.5)", borderBottom: "1px solid rgba(255,255,255,0.07)", letterSpacing: 1 },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.04)" },
  td: { padding: "10px 12px", color: "#e8eaf0" },
  actionBtn: { background: "#1a1e30", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit" },
};
