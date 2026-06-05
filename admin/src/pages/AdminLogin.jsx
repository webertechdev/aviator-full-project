import { useState } from "react";
import { useAdminAuth } from "../hooks/useAdminAuth";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err.message || "Login failed"); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0c14" }}>
      <div style={{ background: "#111422", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 40, width: 360, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'Orbitron', sans-serif", color: "#00ff96", fontSize: 24, textAlign: "center", letterSpacing: 4 }}>✈️ ADMIN</div>
        <h2 style={{ textAlign: "center", fontFamily: "'Orbitron', sans-serif", fontSize: 16 }}>Admin Portal</h2>
        {error && <div style={{ background: "rgba(255,60,60,0.1)", color: "#ff3c3c", padding: 10, borderRadius: 8, fontSize: 12 }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input style={inputStyle} type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button style={btnStyle} type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = { background: "#1a1e30", border: "1px solid rgba(255,255,255,0.08)", color: "#e8eaf0", padding: "10px 14px", borderRadius: 8, fontFamily: "'Share Tech Mono', monospace", fontSize: 14 };
const btnStyle = { background: "#00ff96", color: "#000", border: "none", padding: 14, borderRadius: 8, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: 2 };
