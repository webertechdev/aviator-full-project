import { useState, useEffect, useRef } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function ChatPanel() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  const canChat = profile?.chatEnabled || profile?.role === "admin";

  useEffect(() => {
    const q = query(collection(db, "chat"), orderBy("createdAt", "asc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return unsub;
  }, []);

  async function send() {
    if (!text.trim() || !canChat) return;
    await addDoc(collection(db, "chat"), {
      uid: user.uid,
      email: user.email,
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
    setText("");
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="chat-panel">
      <h3 className="feed-title">💬 Chat</h3>
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.uid === user?.uid ? "own" : ""}`}>
            <span className="chat-name">{maskEmail(m.email)}</span>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {canChat ? (
        <div className="chat-input-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message..."
            maxLength={200}
          />
          <button onClick={send}>Send</button>
        </div>
      ) : (
        <div className="chat-locked">🔒 Chat access restricted. Contact admin.</div>
      )}
    </div>
  );
}

function maskEmail(email) {
  if (!email) return "User";
  const [user] = email.split("@");
  return user.length > 4 ? user.slice(0, 3) + "***" : user + "***";
}
