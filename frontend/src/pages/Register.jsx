import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const COUNTRIES = [
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", phone: "", country: "KE" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field) { return (e) => setForm((f) => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.message || "Registration failed.");
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">✈️ <span>AVIATOR</span></div>
        <h1>Create Account</h1>
        <p className="auth-sub">Join thousands of players</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email address" value={form.email}
            onChange={update("email")} required />
          <input type="tel" placeholder="Phone (e.g. 254712345678)" value={form.phone}
            onChange={update("phone")} required />
          <select value={form.country} onChange={update("country")}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
          <input type="password" placeholder="Password (min 6 chars)" value={form.password}
            onChange={update("password")} required minLength={6} />
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
