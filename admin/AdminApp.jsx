import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import {
  getFirestore, collection, getDocs, doc, getDoc,
  onSnapshot, query, orderBy, limit, where, updateDoc, addDoc, serverTimestamp
} from "firebase/firestore";

// ── Firebase config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAvZEzj4bGQMIjLu5Z5o8lq_nm7M8Es8s4",
  authDomain: "aviator-6827d.firebaseapp.com",
  projectId: "aviator-6827d",
  storageBucket: "aviator-6827d.firebasestorage.app",
  messagingSenderId: "183407795313",
  appId: "1:183407795313:web:f4af116bd1cdc7ee604fd0",
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── Helpers ──────────────────────────────────────────────────
function statusColor(s) {
  if (s === "success" || s === "approved") return "#00e676";
  if (s === "declined" || s === "failed") return "#ff1744";
  return "#ffc107";
}
function statusLabel(s) {
  const m = { pending:"⏳ Pending", approved:"✅ Approved", declined:"❌ Declined", success:"✅ Success", failed:"❌ Failed", processing:"🔄 Processing" };
  return m[s] || s;
}
function fmt(n) { return (n||0).toLocaleString(); }

// ── Login Screen ─────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists() || snap.data().role !== "admin") {
        await signOut(auth);
        throw new Error("Not an admin account");
      }
      onLogin(snap.data());
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={s.loginPage}>
      <div style={s.loginCard}>
        <div style={s.loginLogo}>✈ AVIATOR ADMIN</div>
        <h2 style={s.loginTitle}>Admin Portal</h2>
        {err && <div style={s.errBox}>{err}</div>}
        <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:12}}>
          <input style={s.input} type="email" placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} required />
          <button style={s.btn} type="submit" disabled={loading}>{loading?"Signing in...":"Sign In"}</button>
        </form>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color="#00e676", icon }) {
  return (
    <div style={{...s.statCard, borderColor: color+"33"}}>
      <div style={{fontSize:28,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label}</div>
      <div style={{fontSize:26,fontWeight:900,color,fontFamily:"'Orbitron',sans-serif"}}>{value}</div>
      {sub && <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:4}}>{sub}</div>}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────
function Overview({ users, transactions, rounds, bets }) {
  const deps = transactions.filter(t=>t.type==="deposit"&&(t.status==="success"||t.status==="approved"));
  const wds  = transactions.filter(t=>t.type==="withdraw"&&(t.status==="approved"||t.status==="success"));
  const yesterday = Date.now()-86400000;
  const active = new Set(bets.filter(b=>new Date(b.timestamp||0).getTime()>yesterday).map(b=>b.uid));
  const totalDeposits = deps.reduce((s,t)=>s+(t.amount||0),0);
  const totalWithdraws = wds.reduce((s,t)=>s+(t.amount||0),0);
  const revenue = totalDeposits - totalWithdraws;
  const byCountry = users.reduce((a,u)=>{a[u.country]=(a[u.country]||0)+1;return a},{});
  const pending = transactions.filter(t=>t.type==="withdraw"&&t.status==="pending");

  return (
    <div>
      <div style={s.statsGrid}>
        <StatCard icon="💰" label="Total Deposits" value={`KES ${fmt(totalDeposits)}`} color="#00e676"/>
        <StatCard icon="💸" label="Total Withdrawals" value={`KES ${fmt(totalWithdraws)}`} color="#ff6b8a"/>
        <StatCard icon="📈" label="Net Revenue" value={`KES ${fmt(revenue)}`} color="#ffd700"/>
        <StatCard icon="👥" label="Total Users" value={users.length} color="#00e5ff"/>
        <StatCard icon="🎮" label="Active (24h)" value={active.size} color="#a78bfa"/>
        <StatCard icon="🎲" label="Total Rounds" value={rounds.length} color="#fb923c"/>
        <StatCard icon="🎯" label="Total Bets" value={bets.length} color="#34d399"/>
        <StatCard icon="⏳" label="Pending Withdrawals" value={pending.length} color="#ffc107" sub="Awaiting approval"/>
      </div>

      <h3 style={s.sectionTitle}>🌍 Country Breakdown</h3>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:28}}>
        {Object.entries(byCountry).map(([c,n])=>(
          <div key={c} style={{background:"#1e1940",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"14px 24px",textAlign:"center"}}>
            <div style={{fontSize:24}}>{c==="KE"?"🇰🇪":c==="TZ"?"🇹🇿":"🇺🇬"}</div>
            <div style={{fontWeight:700,fontSize:20,color:"#fff"}}>{n}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{c==="KE"?"Kenya":c==="TZ"?"Tanzania":"Uganda"}</div>
          </div>
        ))}
      </div>

      <h3 style={s.sectionTitle}>✈ Recent Round Multipliers</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {rounds.slice(0,30).map((r,i)=>{
          const m=r.crashMultiplier||0;
          const col=m>=10?"#ffd700":m>=3?"#00e5ff":"#ff6b8a";
          return <span key={i} style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${col}44`,borderRadius:20,padding:"4px 12px",fontSize:12,fontFamily:"'Orbitron',sans-serif",color:col}}>{m.toFixed(2)}x</span>;
        })}
      </div>
    </div>
  );
}

// ── Withdrawals Tab (admin approval) ─────────────────────────
function Withdrawals({ transactions, adminUid, reload }) {
  const [note, setNote] = useState({});
  const [loading, setLoading] = useState({});
  const pending = transactions.filter(t=>t.type==="withdraw"&&t.status==="pending");
  const processed = transactions.filter(t=>t.type==="withdraw"&&t.status!=="pending");

  async function process(txnId, action) {
    setLoading(l=>({...l,[txnId]:true}));
    try {
      const res = await fetch("/api/admin/process-withdrawal", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ adminUid, transactionId:txnId, action, note:note[txnId]||"" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      alert(`Withdrawal ${action}d successfully`);
      reload();
    } catch(e) { alert("Error: "+e.message); }
    setLoading(l=>({...l,[txnId]:false}));
  }

  return (
    <div>
      <h3 style={s.sectionTitle}>⏳ Pending Withdrawals ({pending.length})</h3>
      {pending.length===0 && <div style={s.empty}>No pending withdrawals</div>}
      {pending.map(t=>(
        <div key={t.id} style={s.withdrawCard}>
          <div style={s.withdrawHeader}>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:"#fff"}}>{t.fullName||"—"}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{t.email}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:20,fontWeight:900,color:"#ffc107"}}>{fmt(t.amount)} {t.currency}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{t.phoneNumber}</div>
            </div>
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:10}}>
            Requested: {t.requestedAt ? new Date(t.requestedAt).toLocaleString() : "—"}
          </div>
          <input style={{...s.input,marginBottom:8,fontSize:12}}
            placeholder="Add note (optional)"
            value={note[t.id]||""}
            onChange={e=>setNote(n=>({...n,[t.id]:e.target.value}))}/>
          <div style={{display:"flex",gap:8}}>
            <button style={{...s.btn,background:"#00e676",color:"#000",flex:1}} disabled={loading[t.id]}
              onClick={()=>process(t.id,"approve")}>
              {loading[t.id]?"Processing...":"✅ Approve & Pay"}
            </button>
            <button style={{...s.btn,background:"#ff1744",color:"#fff",flex:1}} disabled={loading[t.id]}
              onClick={()=>process(t.id,"decline")}>
              ❌ Decline
            </button>
          </div>
        </div>
      ))}

      <h3 style={{...s.sectionTitle,marginTop:32}}>📋 Processed Withdrawals</h3>
      <table style={s.table}>
        <thead><tr>{["Name","Amount","Phone","Status","Note","Date"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
        <tbody>
          {processed.map(t=>(
            <tr key={t.id} style={s.tr}>
              <td style={s.td}>{t.fullName||"—"}</td>
              <td style={s.td}>{fmt(t.amount)} {t.currency}</td>
              <td style={s.td}>{t.phoneNumber}</td>
              <td style={s.td}><span style={{color:statusColor(t.status)}}>{statusLabel(t.status)}</span></td>
              <td style={s.td}>{t.adminNote||"—"}</td>
              <td style={s.td}>{t.processedAt?new Date(t.processedAt).toLocaleDateString():"—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────
function Users({ users, reload }) {
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState({});

  async function toggleChat(uid, current) {
    setLoading(l=>({...l,[uid]:true}));
    await updateDoc(doc(db,"users",uid),{chatEnabled:!current});
    reload();
    setLoading(l=>({...l,[uid]:false}));
  }

  async function toggleRole(uid, current) {
    const newRole = current==="admin"?"user":"admin";
    if (!confirm(`Change role to ${newRole}?`)) return;
    await updateDoc(doc(db,"users",uid),{role:newRole});
    reload();
  }

  const filtered = users.filter(u=>!filter||(u.email||"").includes(filter)||(u.fullName||"").toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{...s.sectionTitle,margin:0}}>👥 Users ({users.length})</h3>
        <input style={{...s.input,width:260,margin:0}} placeholder="Search by name or email..." value={filter} onChange={e=>setFilter(e.target.value)}/>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Full Name","Email","Phone","Country","Balance","Demo Bal","Mode","Role","Chat","Actions"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(u=>(
              <tr key={u.uid||u.id} style={s.tr}>
                <td style={s.td}>{u.fullName||"—"}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}>{u.phone}</td>
                <td style={s.td}>{u.country==="KE"?"🇰🇪 Kenya":u.country==="TZ"?"🇹🇿 Tanzania":"🇺🇬 Uganda"}</td>
                <td style={s.td}>{fmt(u.balance)} {u.country==="KE"?"KES":u.country==="TZ"?"TZS":"UGX"}</td>
                <td style={s.td}>{fmt(u.demoBalance)}</td>
                <td style={s.td}><span style={{color:u.mode==="demo"?"#ffc107":"#00e676",fontSize:11,fontWeight:700}}>{u.mode||"real"}</span></td>
                <td style={s.td}><span style={{color:u.role==="admin"?"#ffd700":"rgba(255,255,255,0.4)",fontSize:11,fontWeight:700}}>{u.role}</span></td>
                <td style={s.td}><span style={{color:u.chatEnabled?"#00e676":"#ff6b8a",fontSize:11}}>{u.chatEnabled?"✓ Yes":"✗ No"}</span></td>
                <td style={s.td}>
                  <div style={{display:"flex",gap:4}}>
                    <button style={{...s.smallBtn,background:u.chatEnabled?"rgba(255,23,68,0.2)":"rgba(0,230,118,0.2)",color:u.chatEnabled?"#ff6b8a":"#00e676"}}
                      disabled={loading[u.uid]} onClick={()=>toggleChat(u.uid,u.chatEnabled)}>
                      {u.chatEnabled?"Revoke Chat":"Allow Chat"}
                    </button>
                    <button style={{...s.smallBtn,background:"rgba(255,215,0,0.1)",color:"#ffd700"}}
                      onClick={()=>toggleRole(u.uid,u.role)}>
                      {u.role==="admin"?"→ User":"→ Admin"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Transactions Tab ──────────────────────────────────────────
function Transactions({ transactions }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter==="all"?transactions:transactions.filter(t=>t.type===filter);
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["all","deposit","withdraw"].map(f=>(
          <button key={f} style={{...s.filterBtn,background:filter===f?"rgba(232,0,61,0.2)":"rgba(255,255,255,0.05)",color:filter===f?"#ff6b8a":"rgba(255,255,255,0.5)",borderColor:filter===f?"rgba(232,0,61,0.4)":"rgba(255,255,255,0.1)"}}
            onClick={()=>setFilter(f)}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
        ))}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Type","Amount","Currency","Phone","Status","Date"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(t=>(
              <tr key={t.id} style={s.tr}>
                <td style={s.td}><span style={{color:t.type==="deposit"?"#00e676":"#ff6b8a",fontWeight:700,textTransform:"uppercase",fontSize:11}}>{t.type}</span></td>
                <td style={s.td}>{fmt(t.amount)}</td>
                <td style={s.td}>{t.currency}</td>
                <td style={s.td}>{t.phoneNumber||"—"}</td>
                <td style={s.td}><span style={{color:statusColor(t.status)}}>{statusLabel(t.status)}</span></td>
                <td style={s.td}>{t.timestamp?new Date(t.timestamp).toLocaleString():"—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Rounds Tab ────────────────────────────────────────────────
function Rounds({ rounds }) {
  return (
    <div>
      <h3 style={s.sectionTitle}>✈ Round History ({rounds.length})</h3>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Round ID","Crash Multiplier","Phase","Started","Ended"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {rounds.map(r=>{
              const m=r.crashMultiplier||0;
              const col=m>=10?"#ffd700":m>=3?"#00e5ff":"#ff6b8a";
              return (
                <tr key={r.id} style={s.tr}>
                  <td style={{...s.td,fontSize:11,opacity:.6}}>{r.id?.slice(0,12)}...</td>
                  <td style={s.td}><span style={{color:col,fontWeight:900,fontFamily:"'Orbitron',sans-serif"}}>{m.toFixed(2)}x</span></td>
                  <td style={s.td}>{r.phase}</td>
                  <td style={s.td}>{r.startTime?.toDate?.()?.toLocaleString()||"—"}</td>
                  <td style={s.td}>{r.endTime?.toDate?.()?.toLocaleString()||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Bets Tab ──────────────────────────────────────────────────
function Bets({ bets }) {
  return (
    <div>
      <h3 style={s.sectionTitle}>🎯 All Bets ({bets.length})</h3>
      <div style={{overflowX:"auto"}}>
        <table style={s.table}>
          <thead><tr>{["Player","Stake","Currency","Auto Cashout","Result","Multiplier","Winnings","Mode"].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {bets.map(b=>(
              <tr key={b.id} style={s.tr}>
                <td style={s.td}>{b.fullName||b.email||"—"}</td>
                <td style={s.td}>{fmt(b.stake)}</td>
                <td style={s.td}>{b.currency}</td>
                <td style={s.td}>{b.autoCashout?`${b.autoCashout}x`:"Manual"}</td>
                <td style={s.td}><span style={{color:b.result==="win"?"#00e676":b.result==="lose"?"#ff6b8a":"#ffc107"}}>{b.result||"pending"}</span></td>
                <td style={s.td}>{b.cashoutMultiplier?`${b.cashoutMultiplier}x`:"—"}</td>
                <td style={s.td}>{b.winnings?fmt(b.winnings):"—"}</td>
                <td style={s.td}><span style={{fontSize:11,color:b.mode==="demo"?"#ffc107":"#00e676"}}>{b.mode||"real"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Admin App ────────────────────────────────────────────
export default function AdminApp() {
  const [adminUser, setAdminUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [bets, setBets] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(()=>{
    return onAuthStateChanged(auth, async u=>{
      if (u) {
        const snap = await getDoc(doc(db,"users",u.uid));
        if (snap.exists() && snap.data().role==="admin") setAdminUser({uid:u.uid,...snap.data()});
        else { await signOut(auth); setAdminUser(null); }
      } else setAdminUser(null);
      setAuthLoading(false);
    });
  },[]);

  useEffect(()=>{ if(adminUser) loadAll(); },[adminUser]);

  async function loadAll() {
    setDataLoading(true);
    const [uSnap,tSnap,rSnap,bSnap] = await Promise.all([
      getDocs(collection(db,"users")),
      getDocs(query(collection(db,"transactions"),orderBy("timestamp","desc"),limit(300))),
      getDocs(query(collection(db,"rounds"),orderBy("startTime","desc"),limit(100))),
      getDocs(query(collection(db,"bets"),orderBy("timestamp","desc"),limit(300))),
    ]);
    setUsers(uSnap.docs.map(d=>({id:d.id,...d.data()})));
    setTransactions(tSnap.docs.map(d=>({id:d.id,...d.data()})));
    setRounds(rSnap.docs.map(d=>({id:d.id,...d.data()})));
    setBets(bSnap.docs.map(d=>({id:d.id,...d.data()})));
    setDataLoading(false);
  }

  const pendingCount = transactions.filter(t=>t.type==="withdraw"&&t.status==="pending").length;

  if (authLoading) return <div style={{...s.page,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)"}}>Loading...</div>;
  if (!adminUser) return <AdminLogin onLogin={u=>{setAdminUser(u);}} />;

  const TABS = [
    {k:"overview",l:"📊 Overview"},
    {k:"withdrawals",l:`💸 Withdrawals${pendingCount>0?` (${pendingCount})`:""}`},
    {k:"users",l:"👥 Users"},
    {k:"transactions",l:"💳 Transactions"},
    {k:"rounds",l:"✈ Rounds"},
    {k:"bets",l:"🎯 Bets"},
  ];

  return (
    <div style={s.page}>
      {/* Top nav */}
      <nav style={s.nav}>
        <div style={s.navLogo}>✈ AVIATOR ADMIN</div>
        <div style={s.navTabs}>
          {TABS.map(({k,l})=>(
            <button key={k} style={{...s.navTab,background:tab===k?"rgba(232,0,61,0.15)":"transparent",color:tab===k?"#ff6b8a":"rgba(255,255,255,0.45)",borderBottom:tab===k?"2px solid #e8003d":"2px solid transparent"}}
              onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>👤 {adminUser.fullName||adminUser.email}</span>
          <button style={{...s.smallBtn,color:"rgba(255,255,255,0.4)"}} onClick={()=>signOut(auth)}>Logout</button>
          <button style={{...s.smallBtn,background:"rgba(0,229,255,0.1)",color:"#00e5ff"}} onClick={loadAll}>↻ Refresh</button>
        </div>
      </nav>

      {/* Content */}
      <div style={s.content}>
        {dataLoading && <div style={s.loadingBar}>Loading data...</div>}
        {tab==="overview"    && <Overview users={users} transactions={transactions} rounds={rounds} bets={bets}/>}
        {tab==="withdrawals" && <Withdrawals transactions={transactions} adminUid={adminUser.uid} reload={loadAll}/>}
        {tab==="users"       && <Users users={users} reload={loadAll}/>}
        {tab==="transactions"&& <Transactions transactions={transactions}/>}
        {tab==="rounds"      && <Rounds rounds={rounds}/>}
        {tab==="bets"        && <Bets bets={bets}/>}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  page:{background:"#0e0b1e",minHeight:"100vh",color:"#e8e8f0",fontFamily:"'Inter',sans-serif"},
  nav:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",background:"#1a1535",borderBottom:"1px solid rgba(255,255,255,0.07)",height:52,gap:12,flexWrap:"wrap"},
  navLogo:{fontFamily:"'Orbitron',sans-serif",color:"#e8003d",fontWeight:900,fontSize:16,letterSpacing:2,flexShrink:0},
  navTabs:{display:"flex",gap:2,flex:1,overflowX:"auto"},
  navTab:{padding:"0 14px",height:52,border:"none",background:"transparent",cursor:"pointer",fontSize:12,fontWeight:600,letterSpacing:0.3,whiteSpace:"nowrap",fontFamily:"'Inter',sans-serif",transition:"all 0.2s"},
  content:{padding:24,maxWidth:1400,margin:"0 auto"},
  loadingBar:{background:"rgba(0,229,255,0.08)",border:"1px solid rgba(0,229,255,0.2)",color:"#00e5ff",padding:"8px 16px",borderRadius:8,marginBottom:20,fontSize:12},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14,marginBottom:28},
  statCard:{background:"#1e1940",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"18px 20px",transition:"border-color 0.2s"},
  sectionTitle:{fontFamily:"'Orbitron',sans-serif",fontSize:14,letterSpacing:1,color:"rgba(255,255,255,0.7)",marginBottom:16,marginTop:0},
  table:{width:"100%",borderCollapse:"collapse",fontSize:12,background:"#1a1535",borderRadius:10,overflow:"hidden"},
  th:{background:"#16122e",padding:"10px 14px",textAlign:"left",color:"rgba(255,255,255,0.4)",fontSize:10,letterSpacing:1,textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.06)"},
  tr:{borderBottom:"1px solid rgba(255,255,255,0.04)"},
  td:{padding:"10px 14px",color:"#e8e8f0",verticalAlign:"middle"},
  empty:{padding:32,textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:13},
  withdrawCard:{background:"#1e1940",border:"1px solid rgba(255,193,7,0.25)",borderRadius:12,padding:18,marginBottom:12},
  withdrawHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10},
  loginPage:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"radial-gradient(ellipse at top,#1a0a35,#0e0b1e)"},
  loginCard:{background:"#1e1940",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"40px 36px",width:360,display:"flex",flexDirection:"column",gap:16},
  loginLogo:{fontFamily:"'Orbitron',sans-serif",color:"#e8003d",fontSize:22,fontWeight:900,letterSpacing:3,textAlign:"center"},
  loginTitle:{textAlign:"center",fontFamily:"'Orbitron',sans-serif",fontSize:15,color:"rgba(255,255,255,0.7)",margin:0},
  input:{background:"#16122e",border:"1px solid rgba(255,255,255,0.1)",color:"#e8e8f0",padding:"10px 14px",borderRadius:8,fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"'Inter',sans-serif"},
  btn:{padding:"12px 0",background:"#e8003d",color:"#fff",border:"none",borderRadius:8,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Orbitron',sans-serif",letterSpacing:1},
  smallBtn:{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"},
  filterBtn:{padding:"6px 14px",border:"1px solid",borderRadius:20,cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:600},
  errBox:{background:"rgba(255,23,68,0.1)",border:"1px solid rgba(255,23,68,0.25)",color:"#ff6b8a",padding:"10px 14px",borderRadius:8,fontSize:12,textAlign:"center"},
};
