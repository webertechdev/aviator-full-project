import { useState } from "react";
import { Link } from "react-router-dom";

const PAST = ["2.14x","1.03x","5.67x","218.49x","1.31x","3.80x","13.85x","1.15x","6.03x","1.70x"];

export default function Landing() {
  const [tick, setTick] = useState(0);

  return (
    <div className="landing-page">
      {/* TOP NAV */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <span className="logo-plane">✈</span>
          <span className="logo-text">Aviator</span>
        </div>
        <div className="landing-nav-links">
          <Link to="/login" className="btn-login">Login</Link>
          <Link to="/register" className="btn-register">Register</Link>
        </div>
      </nav>

      {/* HERO */}
      <div className="landing-hero">
        <div className="hero-multipliers">
          {PAST.map((m,i) => (
            <span key={i} className={`hero-mult ${parseFloat(m)>=10?"gold":parseFloat(m)>=2?"blue":"red"}`}>{m}</span>
          ))}
        </div>

        <div className="hero-game-preview">
          <div className="preview-label">FUN MODE PREVIEW</div>
          <div className="preview-canvas">
            <div className="preview-curve"></div>
            <div className="preview-plane">✈</div>
            <div className="preview-multiplier">6.80x</div>
          </div>
        </div>

        <div className="hero-cta">
          <h1 className="hero-title">
            <span className="hero-title-red">AVIATOR</span>
            <span className="hero-title-white"> — Cash Out Before It Flies Away</span>
          </h1>
          <p className="hero-sub">Play with real money or try the demo. M-PESA deposits in seconds.</p>
          <div className="hero-btns">
            <Link to="/register" className="hero-btn-play">Play Now</Link>
            <Link to="/register?demo=1" className="hero-btn-demo">Try Demo Free</Link>
          </div>
          <div className="hero-features">
            <span>✅ Free Demo Account (50,000 KES)</span>
            <span>✅ M-PESA Deposits</span>
            <span>✅ Instant Cashout</span>
            <span>✅ Kenya · Tanzania · Uganda</span>
          </div>
        </div>
      </div>
    </div>
  );
}
