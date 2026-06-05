import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError("Invalid email or password.");
    }
    setLoading(false);
  }

  async function handleReset() {
    if (!email) { setError("Enter your email above first."); return; }
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      setError("Could not send reset email. Check the address.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">✈️ <span>AVIATOR</span></div>
        <h1>Welcome Back</h1>
        <p className="auth-sub">Sign in to your account</p>

        {error && <div className="auth-error">{error}</div>}
        {resetSent && <div className="auth-success">Reset link sent! Check your email.</div>}

        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Email address" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <button className="link-btn" onClick={handleReset}>Forgot password?</button>
        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
