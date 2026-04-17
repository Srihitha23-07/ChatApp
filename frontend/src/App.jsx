import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API = "http://localhost:8081";
// BUG FIX #1: WS variable was declared but used inconsistently — SockJS requires
// a plain http:// URL (it handles the ws:// upgrade internally). Made explicit.
const WS_ENDPOINT = "http://localhost:8081/chat";

const EMOJIS = ["😀","😂","😍","🔥","👋","💯","🎉","❤️","👍","😎","🤔","✨","🚀","💬","😊","🥳","😢","😡","🙏","👏","🤝","💪","🎊","🌟","⚡","🎯","🔑","💡","🌈","🍀"];
const AVATAR_COLORS = ["#00d4aa","#ff6b6b","#ffd93d","#a29bfe","#fd79a8","#74b9ff","#55efc4","#e17055"];

const fmtTime = (ts) => {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const fmtLastSeen = (ts) => {
  if (!ts || ts === "") return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)    return "Last seen just now";
  if (diff < 3600)  return `Last seen ${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `Last seen ${Math.floor(diff/3600)}h ago`;
  return `Last seen ${d.toLocaleDateString()}`;
};
const statusDot = (s) => ({ online:"#00d4aa", away:"#ffd93d", offline:"#636e72" }[s] || "#636e72");

// ─── STYLES ───────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #080810; color: #e0e0f0; height: 100vh; overflow: hidden; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes bounce   { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes msgIn    { from{opacity:0;transform:translateY(8px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

  /* ── AUTH ── */
  .auth-root { display:flex; height:100vh; overflow:hidden; }
  .auth-left {
    width:440px; min-width:440px; background:#0c0c1a; border-right:1px solid #1a1a2e;
    display:flex; flex-direction:column; justify-content:center; padding:60px 52px;
    position:relative; overflow:hidden;
  }
  .auth-left::before { content:''; position:absolute; top:-100px; left:-100px; width:360px; height:360px; border-radius:50%; background:radial-gradient(circle,#00d4aa14 0%,transparent 70%); pointer-events:none; }
  .auth-left::after  { content:''; position:absolute; bottom:-80px; right:-80px; width:280px; height:280px; border-radius:50%; background:radial-gradient(circle,#0097a714 0%,transparent 70%); pointer-events:none; }
  .auth-logo { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:4px; text-transform:uppercase; color:#00d4aa; margin-bottom:48px; display:flex; align-items:center; gap:10px; }
  .auth-logo-dot { width:8px; height:8px; border-radius:50%; background:#00d4aa; animation:pulse 1.8s ease infinite; }
  .auth-heading { font-size:34px; font-weight:600; line-height:1.2; margin-bottom:12px; color:#f0f0ff; letter-spacing:-0.5px; }
  .auth-heading span { background:linear-gradient(90deg,#00d4aa,#0097a7,#00d4aa); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:shimmer 3s linear infinite; }
  .auth-subheading { font-size:14px; color:#636e72; line-height:1.7; margin-bottom:40px; }
  .auth-form { display:flex; flex-direction:column; gap:16px; animation:fadeUp 0.4s ease; }
  .form-group { display:flex; flex-direction:column; gap:6px; }
  .form-label { font-size:11px; font-family:'JetBrains Mono',monospace; letter-spacing:1.5px; text-transform:uppercase; color:#8892b0; }
  .form-input { background:#10102a; border:1px solid #22223a; border-radius:10px; padding:12px 14px; color:#e0e0f0; font-family:'DM Sans',sans-serif; font-size:14px; outline:none; transition:border-color .2s,box-shadow .2s; }
  .form-input:focus { border-color:#00d4aa55; box-shadow:0 0 0 3px #00d4aa0e; }
  .form-input::placeholder { color:#383856; }
  .form-input.error { border-color:#ff6b6b55; }
  .form-error { font-size:11px; color:#ff6b6b; margin-top:2px; }
  .password-wrap { position:relative; }
  .password-wrap .form-input { padding-right:44px; width:100%; }
  .eye-btn { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#636e72; cursor:pointer; font-size:16px; transition:color .15s; line-height:1; }
  .eye-btn:hover { color:#e0e0f0; }
  .auth-btn { margin-top:4px; padding:14px; border-radius:10px; background:linear-gradient(135deg,#00d4aa,#0097a7); border:none; color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; cursor:pointer; transition:opacity .2s,transform .1s; display:flex; align-items:center; justify-content:center; gap:8px; }
  .auth-btn:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); }
  .auth-btn:disabled { opacity:.5; cursor:default; transform:none; }
  .auth-spinner { width:16px; height:16px; border:2px solid #ffffff44; border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; display:inline-block; }
  .auth-divider { display:flex; align-items:center; gap:12px; margin:4px 0; color:#383856; font-size:12px; }
  .auth-divider::before,.auth-divider::after { content:''; flex:1; height:1px; background:#1a1a2e; }
  .auth-switch { text-align:center; font-size:13px; color:#636e72; }
  .auth-switch button { background:none; border:none; color:#00d4aa; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; padding:0 2px; }
  .auth-switch button:hover { text-decoration:underline; }
  .auth-alert { padding:10px 14px; border-radius:8px; font-size:12px; display:flex; align-items:center; gap:8px; }
  .auth-alert.success { background:#00d4aa15; border:1px solid #00d4aa30; color:#00d4aa; }
  .auth-alert.danger  { background:#ff6b6b15; border:1px solid #ff6b6b30; color:#ff6b6b; }
  .auth-right { flex:1; background:#080810; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
  .auth-right-bg { position:absolute; inset:0; background:radial-gradient(ellipse at 30% 20%,#00d4aa09 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,#0097a709 0%,transparent 50%); }
  .auth-preview { position:relative; z-index:1; background:#0c0c1a; border:1px solid #1a1a2e; border-radius:20px; width:320px; overflow:hidden; box-shadow:0 32px 80px #00000066; animation:fadeUp 0.6s ease 0.2s both; }
  .preview-header { padding:14px 16px; background:#10102a; border-bottom:1px solid #1a1a2e; display:flex; align-items:center; gap:10px; }
  .preview-avatar { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
  .preview-name { font-size:13px; font-weight:600; }
  .preview-status { font-size:10px; }
  .preview-messages { padding:16px; display:flex; flex-direction:column; gap:10px; }
  .preview-msg { padding:9px 12px; border-radius:12px; font-size:12px; max-width:80%; line-height:1.5; }
  .preview-msg.left  { background:#181830; align-self:flex-start; }
  .preview-msg.right { background:linear-gradient(135deg,#00d4aa,#0097a7); color:#fff; align-self:flex-end; border-bottom-right-radius:3px; }
  .preview-input { margin:0 16px 16px; background:#10102a; border:1px solid #22223a; border-radius:10px; padding:10px 12px; font-size:11px; color:#383856; display:flex; align-items:center; justify-content:space-between; }
  .preview-send { width:28px; height:28px; border-radius:7px; background:linear-gradient(135deg,#00d4aa,#0097a7); display:flex; align-items:center; justify-content:center; font-size:12px; color:#fff; }
  .strength-bar { display:flex; gap:4px; margin-top:6px; }
  .strength-seg { height:3px; flex:1; border-radius:2px; background:#1a1a2e; transition:background .3s; }
  .strength-label { font-size:10px; margin-top:4px; font-family:'JetBrains Mono',monospace; }

  /* ── CHAT LAYOUT ── */
  .layout { display:flex; height:100vh; background:#080810; }

  /* ── SIDEBAR ── */
  .sidebar { width:290px; background:#0c0c1a; border-right:1px solid #1a1a2e; display:flex; flex-direction:column; flex-shrink:0; }
  .sidebar-header { padding:16px 16px 12px; border-bottom:1px solid #1a1a2e; }
  .sidebar-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .sidebar-title { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#00d4aa; }
  .sidebar-actions { display:flex; gap:6px; }
  .icon-btn { width:30px; height:30px; border-radius:8px; background:#181830; border:1px solid #22223a; color:#8892b0; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; transition:all .15s; }
  .icon-btn:hover { background:#22223a; color:#e0e0f0; }
  .me-chip { display:flex; align-items:center; gap:8px; padding:8px 10px; background:#10102a; border-radius:10px; border:1px solid #1a1a2e; cursor:pointer; transition:border-color .15s; }
  .me-chip:hover { border-color:#00d4aa33; }
  .me-avatar { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0; }
  .me-info { flex:1; min-width:0; }
  .me-name { font-size:13px; font-weight:600; color:#e0e0f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .me-status { font-size:10px; color:#00d4aa; margin-top:1px; }
  .ws-badge { display:inline-flex; align-items:center; gap:5px; font-size:10px; font-family:'JetBrains Mono',monospace; margin-top:8px; }
  .ws-dot { width:5px; height:5px; border-radius:50%; background:currentColor; animation:pulse 1.5s ease infinite; }
  .search-wrap { padding:10px 16px; border-bottom:1px solid #1a1a2e; }
  .search-input { width:100%; background:#10102a; border:1px solid #22223a; border-radius:10px; padding:8px 12px; color:#e0e0f0; font-family:'DM Sans',sans-serif; font-size:13px; outline:none; transition:border-color .2s; }
  .search-input:focus { border-color:#00d4aa33; }
  .search-input::placeholder { color:#383856; }
  .section-label { padding:10px 16px 4px; font-size:9px; font-family:'JetBrains Mono',monospace; letter-spacing:2px; text-transform:uppercase; color:#383856; }
  .contact-list { flex:1; overflow-y:auto; padding-bottom:8px; }
  .contact-list::-webkit-scrollbar { width:3px; }
  .contact-list::-webkit-scrollbar-thumb { background:#22223a; border-radius:3px; }
  .contact-item { display:flex; align-items:center; gap:10px; padding:10px 16px; cursor:pointer; transition:background .15s; border-left:2px solid transparent; position:relative; }
  .contact-item:hover { background:#10102a; }
  .contact-item.active { background:#10102a; border-left-color:#00d4aa; }
  .c-avatar { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; position:relative; flex-shrink:0; }
  .c-dot { position:absolute; bottom:-2px; right:-2px; width:11px; height:11px; border-radius:50%; border:2px solid #0c0c1a; }
  .c-info { flex:1; min-width:0; }
  .c-name { font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .c-preview { font-size:11px; color:#636e72; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
  .unread-badge { background:linear-gradient(135deg,#00d4aa,#0097a7); color:#fff; font-size:10px; font-weight:700; min-width:18px; height:18px; padding:0 4px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'JetBrains Mono',monospace; }

  /* ── CHAT AREA ── */
  .chat-area { flex:1; display:flex; flex-direction:column; background:#080810; position:relative; min-width:0; }
  .chat-header { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; background:#0c0c1a; border-bottom:1px solid #1a1a2e; }
  .header-left { display:flex; align-items:center; gap:12px; }
  .header-title { font-size:15px; font-weight:600; }
  .header-sub { font-size:11px; color:#636e72; margin-top:1px; }
  .header-actions { display:flex; gap:8px; }
  .chat-messages { flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:4px; }
  .chat-messages::-webkit-scrollbar { width:4px; }
  .chat-messages::-webkit-scrollbar-thumb { background:#22223a; border-radius:4px; }
  .date-divider { text-align:center; font-size:10px; font-family:'JetBrains Mono',monospace; letter-spacing:2px; color:#383856; margin:12px 0; text-transform:uppercase; }
  .msg-row { display:flex; align-items:flex-end; gap:8px; animation:msgIn .22s ease; position:relative; margin-bottom:2px; }
  .msg-row.mine { flex-direction:row-reverse; }
  .msg-row:hover .msg-actions { opacity:1; }
  .msg-avatar { width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0; }
  .msg-bubble { max-width:58%; padding:9px 13px 6px; border-radius:16px; font-size:13.5px; line-height:1.55; position:relative; word-break:break-word; }
  .msg-bubble.theirs { background:#181830; border-bottom-left-radius:4px; }
  .msg-bubble.mine   { background:linear-gradient(135deg,#00c49a,#0090a0); border-bottom-right-radius:4px; color:#fff; }
  .msg-bubble.deleted { opacity:.45; font-style:italic; }
  .msg-meta { display:flex; align-items:center; gap:4px; margin-top:4px; font-size:10px; color:rgba(255,255,255,0.45); justify-content:flex-end; }
  .msg-bubble.theirs .msg-meta { color:#636e72; }
  .msg-edited { font-size:9px; opacity:.7; font-style:italic; }
  .msg-actions { position:absolute; top:-30px; opacity:0; transition:opacity .15s; display:flex; gap:4px; z-index:5; }
  .msg-row.mine  .msg-actions { right:0; }
  .msg-row.theirs .msg-actions { left:36px; }
  .msg-action-btn { width:26px; height:26px; border-radius:7px; background:#1a1a2e; border:1px solid #22223a; color:#8892b0; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px; transition:all .15s; }
  .msg-action-btn:hover { background:#22223a; color:#e0e0f0; }

  .edit-overlay { background:#181830; border:1px solid #00d4aa33; border-radius:8px; padding:6px 12px; margin:4px 16px 0; font-size:12px; color:#636e72; display:flex; align-items:center; justify-content:space-between; }
  .edit-overlay button { background:none; border:none; color:#ff6b6b; cursor:pointer; font-size:14px; padding:0 2px; }

  .ctx-menu { position:fixed; background:#181830; border:1px solid #22223a; border-radius:10px; padding:6px; z-index:100; box-shadow:0 8px 32px #00000088; animation:fadeIn .1s ease; min-width:150px; }
  .ctx-item { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:13px; color:#e0e0f0; transition:background .1s; }
  .ctx-item:hover { background:#22223a; }
  .ctx-item.danger { color:#ff6b6b; }
  .ctx-item.danger:hover { background:#ff6b6b10; }

  .typing-indicator { display:flex; align-items:center; gap:8px; padding:0 24px 8px; font-size:12px; color:#636e72; height:28px; }
  .typing-dots { display:flex; gap:4px; }
  .typing-dots span { width:5px; height:5px; border-radius:50%; background:#00d4aa; animation:bounce 1s ease infinite; }
  .typing-dots span:nth-child(2) { animation-delay:.15s; }
  .typing-dots span:nth-child(3) { animation-delay:.3s; }

  .chat-input-area { padding:10px 16px 14px; background:#0c0c1a; border-top:1px solid #1a1a2e; }
  .input-row { display:flex; align-items:center; gap:8px; background:#10102a; border:1px solid #22223a; border-radius:14px; padding:6px 8px; transition:border-color .2s; }
  .input-row:focus-within { border-color:#00d4aa33; }
  .input-field { flex:1; background:transparent; border:none; outline:none; color:#e0e0f0; font-family:'DM Sans',sans-serif; font-size:13.5px; padding:5px 6px; }
  .input-field::placeholder { color:#383856; }
  .action-btn { width:32px; height:32px; border-radius:8px; background:transparent; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; color:#636e72; transition:color .15s,background .15s; flex-shrink:0; }
  .action-btn:hover { color:#e0e0f0; background:#1a1a2e; }
  .send-btn { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#00d4aa,#0097a7); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:15px; color:#fff; transition:transform .1s,opacity .2s; flex-shrink:0; }
  .send-btn:hover:not(:disabled) { transform:scale(1.05); }
  .send-btn:disabled { opacity:.35; cursor:default; transform:none; }

  .emoji-panel { position:absolute; bottom:82px; left:16px; background:#10102a; border:1px solid #22223a; border-radius:14px; padding:10px; display:grid; grid-template-columns:repeat(8,1fr); gap:4px; z-index:10; animation:fadeUp .15s ease; box-shadow:0 8px 32px #00000088; }
  .emoji-btn { width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:8px; cursor:pointer; border:none; background:transparent; font-size:18px; transition:background .1s,transform .1s; }
  .emoji-btn:hover { background:#1a1a2e; transform:scale(1.2); }

  .conn-banner { background:#ffd93d18; border-bottom:1px solid #ffd93d33; padding:5px; text-align:center; font-size:11px; color:#ffd93d; font-family:'JetBrains Mono',monospace; letter-spacing:1px; }
  .empty-chat { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:#383856; }

  .modal-overlay { position:fixed; inset:0; background:#00000088; z-index:200; display:flex; align-items:center; justify-content:center; animation:fadeIn .15s ease; backdrop-filter:blur(4px); }
  .modal { background:#0c0c1a; border:1px solid #1a1a2e; border-radius:16px; width:370px; max-height:90vh; overflow-y:auto; padding:24px; animation:fadeUp .2s ease; }
  .modal::-webkit-scrollbar { width:3px; }
  .modal::-webkit-scrollbar-thumb { background:#22223a; border-radius:3px; }
  .modal-title { font-size:16px; font-weight:600; margin-bottom:20px; display:flex; align-items:center; gap:10px; }
  .modal-close { margin-left:auto; background:none; border:none; color:#636e72; cursor:pointer; font-size:18px; line-height:1; }
  .modal-close:hover { color:#e0e0f0; }
  .modal-section { margin-bottom:18px; }
  .modal-label { font-size:11px; font-family:'JetBrains Mono',monospace; letter-spacing:1.5px; text-transform:uppercase; color:#8892b0; margin-bottom:6px; display:block; }
  .modal-input { width:100%; background:#10102a; border:1px solid #22223a; border-radius:10px; padding:10px 12px; color:#e0e0f0; font-family:'DM Sans',sans-serif; font-size:13px; outline:none; transition:border-color .2s; }
  .modal-input:focus { border-color:#00d4aa55; }
  .modal-btn { width:100%; padding:11px; border-radius:10px; background:linear-gradient(135deg,#00d4aa,#0097a7); border:none; color:#fff; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:opacity .2s; margin-top:4px; display:flex; align-items:center; justify-content:center; gap:8px; }
  .modal-btn:hover:not(:disabled) { opacity:.9; }
  .modal-btn:disabled { opacity:.5; cursor:default; }
  .modal-btn.danger { background:linear-gradient(135deg,#ff6b6b,#e17055); }
  .color-picker { display:flex; gap:8px; flex-wrap:wrap; }
  .color-swatch { width:28px; height:28px; border-radius:8px; cursor:pointer; border:2px solid transparent; transition:transform .1s,border-color .1s; }
  .color-swatch:hover { transform:scale(1.15); }
  .color-swatch.selected { border-color:#fff; }
  .modal-alert { padding:8px 12px; border-radius:8px; font-size:12px; margin-bottom:12px; }
  .modal-alert.success { background:#00d4aa15; border:1px solid #00d4aa30; color:#00d4aa; }
  .modal-alert.danger  { background:#ff6b6b15; border:1px solid #ff6b6b30; color:#ff6b6b; }

  .tick-sent      { color:rgba(255,255,255,.4); font-size:11px; }
  .tick-delivered { color:rgba(255,255,255,.4); font-size:11px; }
  .tick-read      { color:#a0f4e8; font-size:11px; }
`;

const StatusIcon = ({ status }) => {
  if (status === "read")      return <span className="tick-read">✓✓</span>;
  if (status === "delivered") return <span className="tick-delivered">✓✓</span>;
  return <span className="tick-sent">✓</span>;
};

const Spinner = () => (
  <span style={{width:14,height:14,border:"2px solid #ffffff44",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin .6s linear infinite"}} />
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin, onGotoSignup }) {
  const [form, setForm]       = useState({ username:"", password:"" });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [alert, setAlert]     = useState(null);

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = "Username is required";
    if (!form.password)        e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Minimum 6 characters";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setLoading(true); setAlert(null);
    try {
      const res  = await fetch(`${API}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ username:form.username.trim(), password:form.password }) });
      const data = await res.json();
      if (!res.ok) { setAlert({ type:"danger", msg:data.error || "Login failed" }); return; }
      // BUG FIX #2: avatarColor and about were not guarded with defaults.
      // If missing from response (older accounts), accessing them caused crashes.
      onLogin({ username:data.username, id:data.id, avatarColor:data.avatarColor || "#00d4aa", about:data.about || "" });
    } catch {
      setAlert({ type:"danger", msg:"Cannot reach server. Is the backend running?" });
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="auth-root">
        <div className="auth-left">
          <div className="auth-logo"><span className="auth-logo-dot"/> ChatApp</div>
          <h1 className="auth-heading">Welcome back to <span>ChatApp</span></h1>
          <p className="auth-subheading">Sign in to continue your conversations.</p>
          {alert && <div className={`auth-alert ${alert.type}`} style={{marginBottom:16}}>{alert.msg}</div>}
          <div className="auth-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className={`form-input${errors.username?" error":""}`} placeholder="Enter your username"
                value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&handleSubmit()} autoFocus/>
              {errors.username && <span className="form-error">⚠ {errors.username}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-wrap">
                <input className={`form-input${errors.password?" error":""}`} type={showPw?"text":"password"}
                  placeholder="Enter your password" value={form.password}
                  onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
                <button className="eye-btn" type="button" onClick={()=>setShowPw(v=>!v)}>{showPw?"🙈":"👁"}</button>
              </div>
              {errors.password && <span className="form-error">⚠ {errors.password}</span>}
            </div>
            <button className="auth-btn" onClick={handleSubmit} disabled={loading}>{loading?<><Spinner/> Signing in...</>:"Sign In →"}</button>
            <div className="auth-divider">or</div>
            <div className="auth-switch">Don't have an account? <button type="button" onClick={onGotoSignup}>Create one</button></div>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-right-bg"/>
          <div className="auth-preview">
            <div className="preview-header">
              <div className="preview-avatar" style={{background:"#00d4aa22",color:"#00d4aa"}}>A</div>
              <div><div className="preview-name">Alice</div><div className="preview-status" style={{color:"#00d4aa"}}>● Active now</div></div>
            </div>
            <div className="preview-messages">
              <div className="preview-msg left">Hey! You made it 👋</div>
              <div className="preview-msg right">Finally logged in!</div>
              <div className="preview-msg left">The team is waiting 🚀</div>
            </div>
            <div className="preview-input"><span>Type a message...</span><div className="preview-send">➤</div></div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
function SignupPage({ onSignup, onGotoLogin }) {
  const [form, setForm]       = useState({ username:"", email:"", password:"", confirm:"" });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.username.trim())         e.username = "Username is required";
    else if (form.username.length < 3) e.username = "Minimum 3 characters";
    if (!form.email.trim())            e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password)                e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Minimum 6 characters";
    if (form.confirm !== form.password) e.confirm = "Passwords do not match";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setLoading(true);
    try {
      const res  = await fetch(`${API}/auth/register`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ username:form.username.trim(), email:form.email.trim(), password:form.password }) });
      const data = await res.json();
      if (!res.ok) { setErrors({ username: data.error || "Registration failed" }); return; }
      setSuccess(true);
      // BUG FIX #3: Signup passed user to chat without avatarColor, causing
      // undefined avatar rendering and potential crashes in components.
      setTimeout(() => onSignup({ username:data.username, id:data.id, avatarColor:data.avatarColor || "#00d4aa", about:"" }), 1500);
    } catch {
      setErrors({ username:"Cannot reach server." });
    } finally { setLoading(false); }
  };

  const strength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : 3;
  const strengthColors = ["","#ff6b6b","#ffd93d","#00d4aa"];

  return (
    <>
      <style>{STYLES}</style>
      <div className="auth-root">
        <div className="auth-left">
          <div className="auth-logo"><span className="auth-logo-dot"/> ChatApp</div>
          <h1 className="auth-heading">Create your <span>account</span></h1>
          <p className="auth-subheading">Join ChatApp and start messaging instantly.</p>
          {success && <div className="auth-alert success" style={{marginBottom:16}}>✓ Account created! Redirecting...</div>}
          <div className="auth-form">
            {[["username","Username","Choose a username"],["email","Email","you@example.com"]].map(([key,label,ph])=>(
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input className={`form-input${errors[key]?" error":""}`} type={key==="email"?"email":"text"} placeholder={ph}
                  value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
                {errors[key] && <span className="form-error">⚠ {errors[key]}</span>}
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-wrap">
                <input className={`form-input${errors.password?" error":""}`} type={showPw?"text":"password"} placeholder="Create a password"
                  value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
                <button className="eye-btn" type="button" onClick={()=>setShowPw(v=>!v)}>{showPw?"🙈":"👁"}</button>
              </div>
              {form.password && (
                <>
                  <div className="strength-bar">{[1,2,3].map(i=><div key={i} className="strength-seg" style={{background:i<=strength?strengthColors[strength]:"#1a1a2e"}}/>)}</div>
                  <div className="strength-label" style={{color:strengthColors[strength]}}>{"Weak Fair Strong".split(" ")[strength-1]||""}</div>
                </>
              )}
              {errors.password && <span className="form-error">⚠ {errors.password}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="password-wrap">
                <input className={`form-input${errors.confirm?" error":""}`} type={showPw?"text":"password"} placeholder="Repeat your password"
                  value={form.confirm} onChange={e=>setForm(f=>({...f,confirm:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
              </div>
              {errors.confirm && <span className="form-error">⚠ {errors.confirm}</span>}
            </div>
            <button className="auth-btn" onClick={handleSubmit} disabled={loading||success}>{loading?<><Spinner/> Creating...</>:"Create Account →"}</button>
            <div className="auth-divider">or</div>
            <div className="auth-switch">Already have an account? <button type="button" onClick={onGotoLogin}>Sign in</button></div>
          </div>
        </div>
        <div className="auth-right"><div className="auth-right-bg"/>
          <div className="auth-preview">
            <div className="preview-header">
              <div className="preview-avatar" style={{background:"#a29bfe22",color:"#a29bfe"}}>B</div>
              <div><div className="preview-name">Bob</div><div className="preview-status" style={{color:"#a29bfe"}}>● Active now</div></div>
            </div>
            <div className="preview-messages">
              <div className="preview-msg left">Welcome to the team! 🎉</div>
              <div className="preview-msg right">Thanks, excited to be here!</div>
              <div className="preview-msg left">Hop in #general 👇</div>
            </div>
            <div className="preview-input"><span>Type a message...</span><div className="preview-send">➤</div></div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── PROFILE MODAL ────────────────────────────────────────────────────────────
function ProfileModal({ currentUser, onClose, onUpdated, onDeleted }) {
  const [tab, setTab]               = useState("profile");
  const [form, setForm]             = useState({ about: currentUser.about || "", avatarColor: currentUser.avatarColor || "#00d4aa", email:"", newUsername:"" });
  const [pwForm, setPwForm]         = useState({ current:"", next:"", confirm:"" });
  const [loading, setLoading]       = useState(false);
  const [alert, setAlert]           = useState(null);
  const [showPw, setShowPw]         = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const saveProfile = async () => {
    setLoading(true); setAlert(null);
    try {
      const body = { about: form.about, avatarColor: form.avatarColor };
      if (form.email.trim())       body.email       = form.email.trim();
      if (form.newUsername.trim()) body.newUsername = form.newUsername.trim();
      const res  = await fetch(`${API}/users/${currentUser.username}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setAlert({ type:"danger", msg:data.error || "Update failed" }); return; }
      setAlert({ type:"success", msg:"Profile updated!" });
      onUpdated({ ...currentUser, username:data.username || currentUser.username, about:data.about, avatarColor:data.avatarColor });
    } catch { setAlert({ type:"danger", msg:"Network error" }); }
    finally { setLoading(false); }
  };

  const changePassword = async () => {
    // BUG FIX #4: Missing validation for empty current password field.
    if (!pwForm.current)                { setAlert({ type:"danger", msg:"Enter your current password" }); return; }
    if (pwForm.next !== pwForm.confirm) { setAlert({ type:"danger", msg:"Passwords don't match" }); return; }
    if (pwForm.next.length < 6)         { setAlert({ type:"danger", msg:"Min 6 characters" }); return; }
    setLoading(true); setAlert(null);
    try {
      const res  = await fetch(`${API}/users/${currentUser.username}/password`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ currentPassword:pwForm.current, newPassword:pwForm.next }) });
      const data = await res.json();
      if (!res.ok) { setAlert({ type:"danger", msg:data.error || "Password change failed" }); return; }
      setAlert({ type:"success", msg:"Password changed!" });
      setPwForm({ current:"", next:"", confirm:"" });
    } catch { setAlert({ type:"danger", msg:"Network error" }); }
    finally { setLoading(false); }
  };

  const deleteAccount = async () => {
    if (!deletePassword) { setAlert({ type:"danger", msg:"Enter your password to confirm" }); return; }
    setLoading(true); setAlert(null);
    try {
      const res  = await fetch(`${API}/users/${currentUser.username}`, { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ password:deletePassword }) });
      const data = await res.json();
      if (!res.ok) { setAlert({ type:"danger", msg:data.error || "Deletion failed" }); return; }
      onDeleted();
    } catch { setAlert({ type:"danger", msg:"Network error" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target.className==="modal-overlay"&&onClose()}>
      <div className="modal">
        <div className="modal-title">
          ⚙️ Settings
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:20}}>
          {[["profile","👤 Profile"],["password","🔑 Password"],["danger","⚠️ Account"]].map(([t,label])=>(
            <button key={t} type="button" onClick={()=>{setTab(t);setAlert(null);}} style={{flex:1,padding:"7px 4px",borderRadius:8,border:"1px solid",borderColor:tab===t?"#00d4aa33":"#22223a",background:tab===t?"#00d4aa15":"transparent",color:tab===t?"#00d4aa":"#636e72",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all .15s"}}>{label}</button>
          ))}
        </div>
        {alert && <div className={`modal-alert ${alert.type}`}>{alert.msg}</div>}

        {tab === "profile" && (
          <>
            <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
              <div style={{width:64,height:64,borderRadius:18,background:form.avatarColor+"33",color:form.avatarColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:700}}>
                {currentUser.username[0].toUpperCase()}
              </div>
            </div>
            <div className="modal-section">
              <label className="modal-label">Avatar Color</label>
              <div className="color-picker">
                {AVATAR_COLORS.map(c=><div key={c} className={`color-swatch${form.avatarColor===c?" selected":""}`} style={{background:c}} onClick={()=>setForm(f=>({...f,avatarColor:c}))}/>)}
              </div>
            </div>
            <div className="modal-section">
              <label className="modal-label">About</label>
              <input className="modal-input" placeholder="Hey there! I am using ChatApp." value={form.about} onChange={e=>setForm(f=>({...f,about:e.target.value}))} maxLength={100}/>
            </div>
            <div className="modal-section">
              <label className="modal-label">Change Username</label>
              <input className="modal-input" placeholder={currentUser.username} value={form.newUsername} onChange={e=>setForm(f=>({...f,newUsername:e.target.value}))}/>
            </div>
            <div className="modal-section">
              <label className="modal-label">Change Email</label>
              <input className="modal-input" type="email" placeholder="New email address" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
            </div>
            <button className="modal-btn" onClick={saveProfile} disabled={loading}>{loading?<Spinner/>:"Save Changes"}</button>
          </>
        )}

        {tab === "password" && (
          <>
            {[["current","Current Password","Current password"],["next","New Password","New password"],["confirm","Confirm New Password","Repeat new password"]].map(([key,label,ph])=>(
              <div className="modal-section" key={key}>
                <label className="modal-label">{label}</label>
                <div className="password-wrap">
                  <input className="modal-input" type={showPw?"text":"password"} placeholder={ph}
                    value={pwForm[key]} onChange={e=>setPwForm(f=>({...f,[key]:e.target.value}))} style={{paddingRight:38}}/>
                  <button className="eye-btn" type="button" onClick={()=>setShowPw(v=>!v)} style={{right:8}}>{showPw?"🙈":"👁"}</button>
                </div>
              </div>
            ))}
            <button className="modal-btn" onClick={changePassword} disabled={loading}>{loading?<Spinner/>:"Change Password"}</button>
          </>
        )}

        {tab === "danger" && (
          <>
            <div style={{padding:"12px",background:"#ff6b6b10",border:"1px solid #ff6b6b25",borderRadius:10,marginBottom:16,fontSize:12,color:"#ff6b6b",lineHeight:1.6}}>
              ⚠️ Deleting your account is permanent. All your messages will be deleted. This cannot be undone.
            </div>
            <div className="modal-section">
              <label className="modal-label">Confirm Password</label>
              <input className="modal-input" type="password" placeholder="Enter your password" value={deletePassword} onChange={e=>setDeletePassword(e.target.value)}/>
            </div>
            <button className="modal-btn danger" onClick={deleteAccount} disabled={loading}>{loading?<Spinner/>:"🗑 Delete My Account"}</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CONTEXT MENU ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, msg, currentUser, onEdit, onDelete, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // BUG FIX #5: Context menu rendered off-screen at edges. Clamp to viewport.
  const menuW = 160, menuH = 90;
  const clampedX = Math.min(x, window.innerWidth - menuW - 8);
  const clampedY = Math.min(y, window.innerHeight - menuH - 8);

  const canEdit   = msg.sender === currentUser && !msg.deleted;
  const canDelete = msg.sender === currentUser && !msg.deleted;

  return (
    <div ref={ref} className="ctx-menu" style={{ top:clampedY, left:clampedX }}>
      {canEdit   && <div className="ctx-item" onClick={()=>{onEdit(msg);onClose();}}>✏️ Edit</div>}
      {canDelete && <div className="ctx-item danger" onClick={()=>{onDelete(msg);onClose();}}>🗑 Delete</div>}
      {!canEdit && !canDelete && <div className="ctx-item" style={{color:"#636e72",cursor:"default",fontSize:12}}>No actions available</div>}
    </div>
  );
}

// ─── CHAT PAGE ────────────────────────────────────────────────────────────────
function ChatPage({ currentUser: initUser, onLogout }) {
  const [currentUser, setCurrentUser] = useState(initUser);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [showEmoji, setShowEmoji]     = useState(false);
  const [activeUser, setActiveUser]   = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [allUsers, setAllUsers]       = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [editingMsg, setEditingMsg]   = useState(null);
  const [ctxMenu, setCtxMenu]         = useState(null);
  const [search, setSearch]           = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [typingTimer, setTypingTimer] = useState(null);
  const [isTypingSent, setIsTypingSent] = useState(false);

  const stompRef       = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  // BUG FIX #6: Original used useEffect to sync activeUserRef which caused a
  // one-render lag. Assigning directly at render time is correct for refs.
  const activeUserRef  = useRef(null);
  activeUserRef.current = activeUser;

  const loadUsers = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/users?exclude=${currentUser.username}`);
      if (!res.ok) return;
      const data = await res.json();
      setAllUsers(Array.isArray(data) ? data : []);
    } catch {}
  }, [currentUser.username]);

  const loadUnread = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/messages/${currentUser.username}/unread`);
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCounts(data);
    } catch {}
  }, [currentUser.username]);

  const loadHistory = useCallback(async (peer) => {
    try {
      const res  = await fetch(`${API}/messages/${currentUser.username}/${peer.username}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages((Array.isArray(data) ? data : []).map(m => ({ ...m, time: fmtTime(m.timestamp) })));
      // Mark read
      await fetch(`${API}/messages/read/${peer.username}/${currentUser.username}`, { method:"PUT" });
      setUnreadCounts(p => { const n = {...p}; delete n[peer.username]; return n; });
    } catch {}
  }, [currentUser.username]);

  const selectUser = useCallback((u) => {
    // Reset typing state from previous conversation
    setTypingUsers({});
    // Assign ref synchronously so the WS handler immediately knows the new peer
    // before React's state re-render propagates activeUser to activeUserRef.current.
    activeUserRef.current = u;
    setActiveUser(u);
    setMessages([]);
    setEditingMsg(null);
    setInput("");
    loadHistory(u);
  }, [loadHistory]);

  // ── WebSocket setup ──
  useEffect(() => {
    let mounted = true;

    const loadStomp = () => new Promise(res => {
      if (window.Stomp && window.SockJS) { res(); return; }
      const s1 = document.createElement("script");
      s1.src = "https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js";
      s1.onload = () => {
        const s2 = document.createElement("script");
        s2.src = "https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js";
        s2.onload = res;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });

    loadStomp().then(() => {
      if (!mounted) return;
      const socket = new window.SockJS(WS_ENDPOINT);
      const client = window.Stomp.over(socket);
      client.debug = () => {};

      // BUG FIX #8: Original set stompRef.current = client BEFORE the connect
      // callback, so other code could attempt to send on a not-yet-connected client.
      // Now we only assign stompRef inside the success callback.
      // FIX (Issue 4): Pass username as a STOMP connect header so the server
      // interceptor can bind it as the WebSocket Principal for user-targeted delivery.
      client.connect({ username: currentUser.username }, () => {
        if (!mounted) { client.disconnect(); return; }
        setWsConnected(true);
        stompRef.current = client;

        client.send("/app/user.join", {}, JSON.stringify({ username: currentUser.username }));

        // Online users broadcast — now includes ALL users with their current status
        // FIX (Issue 3): Backend sends all users; merge into local state preserving
        // any fields not included in the broadcast.
        client.subscribe("/topic/online-users", msg => {
          const users = JSON.parse(msg.body);
          setAllUsers(
            users
              .filter(u => u.username !== currentUser.username)
              .map(u => ({
                ...u,
                lastSeen: u.lastSeen || null,
              }))
          );
        });

        // Private message queue — only this user's session receives this
        client.subscribe(`/user/queue/messages`, msg => {
          const incoming = JSON.parse(msg.body);
          const peer = activeUserRef.current;

          setMessages(prev => {
            // ── Case 1: Update existing message (edit / soft-delete / status) ──
            const idx = prev.findIndex(m => m.id === incoming.id);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...incoming, time: fmtTime(incoming.timestamp) };
              return updated;
            }

            // ── Case 2: Deleted message not yet in local list — do not append ──
            // Happens when the sender deletes a message they sent while we were
            // in a different conversation. Appending it would show a ghost "deleted"
            // bubble that was never visible as a normal message.
            if (incoming.deleted) return prev;

            // ── Case 3: Echo of our own optimistic message — swap in real server ID ──
            if (incoming.sender === currentUser.username) {
              const tempIdx = prev.findIndex(m =>
                typeof m.id === "number" &&
                m.sender   === incoming.sender &&
                m.receiver === incoming.receiver &&
                m.content  === incoming.content
              );
              if (tempIdx !== -1) {
                const updated = [...prev];
                updated[tempIdx] = { ...incoming, time: fmtTime(incoming.timestamp) };
                return updated;
              }
              return prev; // genuine duplicate echo, ignore
            }

            // ── Case 4: Message from another user ──
            // Show in list only if we're in that conversation, otherwise badge.
            if (!peer || incoming.sender !== peer.username) {
              setUnreadCounts(p => ({ ...p, [incoming.sender]: (p[incoming.sender] || 0) + 1 }));
              return prev;
            }
            // In the conversation — auto-mark read
            fetch(`${API}/messages/read/${incoming.sender}/${currentUser.username}`, { method: "PUT" }).catch(() => {});
            return [...prev, { ...incoming, time: fmtTime(incoming.timestamp) }];
          });
        });

        // FIX (Issue 1 & 2): Typing events are now routed privately
        client.subscribe(`/user/queue/typing`, msg => {
          const { sender, typing } = JSON.parse(msg.body);
          setTypingUsers(p => ({ ...p, [sender]: typing }));
        });

        // FIX (Issue 1 & 2): Read receipts routed privately to sender
        client.subscribe(`/user/queue/read`, msg => {
          const { reader } = JSON.parse(msg.body);
          setMessages(prev => prev.map(m =>
            m.sender === currentUser.username && m.receiver === reader ? { ...m, status:"read" } : m
          ));
        });

        loadUsers();
        loadUnread();

      }, () => { if (mounted) setWsConnected(false); });
    });

    return () => {
      mounted = false;
      if (stompRef.current?.connected) {
        try {
          stompRef.current.send("/app/user.leave", {}, JSON.stringify({ username: currentUser.username }));
          stompRef.current.disconnect();
        } catch {}
      }
      stompRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.username]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  // ── Send message ──
  const sendMessage = () => {
    const content = input.trim();
    if (!content || !activeUser) return;

    if (editingMsg) {
      // BUG FIX #10: Edit was fire-and-forget with no optimistic update.
      // If network was slow the user saw no feedback. Now update immediately.
      const originalContent = editingMsg.content;
      const targetId = editingMsg.id;
      setMessages(p => p.map(m => m.id === targetId ? { ...m, content, edited:true } : m));
      setEditingMsg(null);
      setInput("");
      fetch(`${API}/messages/${targetId}`, {
        method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ username: currentUser.username, content })
      }).catch(() => {
        // Roll back on failure
        setMessages(p => p.map(m => m.id === targetId ? { ...m, content:originalContent, edited:m.edited } : m));
      });
      return;
    }

    const tempId = Date.now();
    const newMsg = {
      id:       tempId,
      sender:   currentUser.username,
      receiver: activeUser.username,
      content,
      time:     fmtTime(Date.now()),
      status:   "sent",
      type:     "text",
      deleted:  false,
      edited:   false,
    };
    setMessages(p => [...p, newMsg]);
    setInput(""); setShowEmoji(false);

    if (stompRef.current?.connected) {
      stompRef.current.send("/app/chat", {}, JSON.stringify({
        sender:   currentUser.username,
        receiver: activeUser.username,
        content,
        type:     "text",
      }));
    } else {
      // BUG FIX #11: Delivery simulation ran even when WS was connected,
      // creating fake "delivered" status before the server confirmed it.
      // Now only simulate offline fallback.
      setTimeout(() => setMessages(p => p.map(m => m.id===tempId ? {...m,status:"delivered"} : m)), 900);
    }
  };

  // ── Typing events ──
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!activeUser || !stompRef.current?.connected) return;
    if (!isTypingSent) {
      setIsTypingSent(true);
      stompRef.current.send("/app/typing", {}, JSON.stringify({ sender:currentUser.username, receiver:activeUser.username, typing:true }));
    }
    if (typingTimer) clearTimeout(typingTimer);
    setTypingTimer(setTimeout(() => {
      setIsTypingSent(false);
      if (stompRef.current?.connected)
        stompRef.current.send("/app/typing", {}, JSON.stringify({ sender:currentUser.username, receiver:activeUser.username, typing:false }));
    }, 2000));
  };

  // ── Delete message ──
  const deleteMessage = async (msg) => {
    // BUG FIX #12: Delete only relied on WebSocket broadcast for UI update.
    // If WS was slow the delete looked frozen. Apply optimistic update first.
    const targetId = msg.id;
    setMessages(p => p.map(m => m.id === targetId ? { ...m, deleted:true, content:"This message was deleted" } : m));
    try {
      await fetch(`${API}/messages/${targetId}`, {
        method:"DELETE", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ username: currentUser.username })
      });
    } catch {}
  };

  const startEdit = (msg) => {
    setEditingMsg(msg);
    setInput(msg.content);
    inputRef.current?.focus();
  };

  const cancelEdit = () => { setEditingMsg(null); setInput(""); };

  const clearConversation = async () => {
    if (!activeUser) return;
    if (!window.confirm("Clear this entire conversation?")) return;
    try {
      await fetch(`${API}/messages/conversation/${currentUser.username}/${activeUser.username}?requestingUser=${currentUser.username}`, { method:"DELETE" });
      setMessages([]);
    } catch {}
  };

  const handleLogout = async () => {
    // BUG FIX #13: Typing timer leaked on logout. Must clear it.
    if (typingTimer) clearTimeout(typingTimer);
    if (stompRef.current?.connected) {
      try {
        stompRef.current.send("/app/user.leave", {}, JSON.stringify({ username: currentUser.username }));
        stompRef.current.disconnect();
      } catch {}
    }
    await fetch(`${API}/auth/logout`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ username: currentUser.username }) }).catch(()=>{});
    onLogout();
  };

  const filteredUsers = allUsers.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const isPeerTyping = activeUser && typingUsers[activeUser.username];

  // BUG FIX #14: Date divider was hardcoded as "Today" regardless of actual
  // message date. Now grouped properly by actual date.
  const buildGrouped = () => {
    const groups = [];
    let lastDate = null;
    for (const msg of messages) {
      const d = msg.timestamp ? new Date(msg.timestamp) : new Date();
      const today = new Date();
      const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
      const isToday = d.toDateString() === today.toDateString();
      const isYesterday = d.toDateString() === yesterday.toDateString();
      const dateLabel = isToday ? "Today" : isYesterday ? "Yesterday" : d.toLocaleDateString();
      if (dateLabel !== lastDate) { groups.push({ type:"divider", label:dateLabel }); lastDate = dateLabel; }
      groups.push({ type:"message", msg });
    }
    return groups;
  };
  const grouped = buildGrouped();

  return (
    <>
      <style>{STYLES}</style>
      <div className="layout" onClick={()=>{ setCtxMenu(null); setShowEmoji(false); }}>

        {/* SIDEBAR */}
        <div className="sidebar" onClick={e=>e.stopPropagation()}>
          <div className="sidebar-header">
            <div className="sidebar-top">
              <div className="sidebar-title">ChatApp</div>
              <div className="sidebar-actions">
                <button className="icon-btn" title="Sign out" onClick={handleLogout}>⎋</button>
              </div>
            </div>
            <div className="me-chip" onClick={()=>setShowProfile(true)}>
              <div className="me-avatar" style={{background:currentUser.avatarColor+"33",color:currentUser.avatarColor}}>
                {currentUser.username[0].toUpperCase()}
              </div>
              <div className="me-info">
                <div className="me-name">{currentUser.username}</div>
                <div className="me-status">🟢 You</div>
              </div>
              <span style={{color:"#636e72",fontSize:12}}>⚙️</span>
            </div>
            <div className="ws-badge" style={{color:wsConnected?"#00d4aa":"#ffd93d",marginTop:8}}>
              <span className="ws-dot"/> {wsConnected?"Connected":"Connecting..."}
            </div>
          </div>

          <div className="search-wrap">
            <input className="search-input" placeholder="🔍  Search contacts..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>

          <div className="section-label">Contacts ({filteredUsers.length})</div>
          <div className="contact-list">
            {filteredUsers.length === 0 ? (
              <div style={{padding:"24px 16px",textAlign:"center",color:"#383856"}}>
                <div style={{fontSize:28,marginBottom:8}}>👥</div>
                <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>
                  {wsConnected ? (search?"No results":"No users online") : "Connecting..."}
                </div>
              </div>
            ) : filteredUsers.map(u => {
              const unread = unreadCounts[u.username] || 0;
              return (
                <div key={u.id||u.username} className={`contact-item${activeUser?.username===u.username?" active":""}`} onClick={()=>selectUser(u)}>
                  <div className="c-avatar" style={{background:(u.avatarColor||"#00d4aa")+"33",color:u.avatarColor||"#00d4aa"}}>
                    {u.username[0].toUpperCase()}
                    <span className="c-dot" style={{background:statusDot(u.status)}}/>
                  </div>
                  <div className="c-info">
                    <div className="c-name">{u.username}</div>
                    <div className="c-preview">{u.status==="online"?"🟢 Online": fmtLastSeen(u.lastSeen)}</div>
                  </div>
                  {/* BUG FIX #15: Badge capped at "9+" but should support larger counts. */}
                  {unread > 0 && <div className="unread-badge">{unread > 99?"99+":unread}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* CHAT AREA */}
        <div className="chat-area">
          {!wsConnected && <div className="conn-banner">⚠ Establishing WebSocket connection...</div>}

          {!activeUser ? (
            <div className="empty-chat">
              <div style={{fontSize:60}}>💬</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#22223a"}}>No chat open</div>
              <div style={{fontSize:13,color:"#636e72",textAlign:"center",maxWidth:240,lineHeight:1.7}}>
                Select a contact from the sidebar to start chatting.
              </div>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div className="header-left">
                  <div className="c-avatar" style={{background:(activeUser.avatarColor||"#00d4aa")+"33",color:activeUser.avatarColor||"#00d4aa",width:38,height:38,borderRadius:10}}>
                    {activeUser.username[0].toUpperCase()}
                    <span className="c-dot" style={{background:statusDot(activeUser.status),border:"2px solid #0c0c1a"}}/>
                  </div>
                  <div>
                    <div className="header-title">{activeUser.username}</div>
                    <div className="header-sub">
                      {isPeerTyping
                        ? <span style={{color:"#00d4aa"}}>typing...</span>
                        : activeUser.status==="online" ? "Active now" : fmtLastSeen(activeUser.lastSeen)}
                    </div>
                  </div>
                </div>
                <div className="header-actions">
                  <button className="icon-btn" title="Clear conversation" onClick={clearConversation}>🗑</button>
                </div>
              </div>

              <div className="chat-messages">
                {messages.length === 0 && (
                  <div style={{textAlign:"center",color:"#383856",marginTop:60}}>
                    <div style={{fontSize:36,marginBottom:10}}>👋</div>
                    <div style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>Start the conversation!</div>
                  </div>
                )}
                {grouped.map((item, i) => {
                  if (item.type === "divider") return <div key={`div-${i}`} className="date-divider">{item.label}</div>;
                  const { msg } = item;
                  const isMine = msg.sender === currentUser.username;
                  return (
                    <div key={msg.id} className={`msg-row${isMine?" mine":""}`}
                      onContextMenu={e=>{ e.preventDefault(); setCtxMenu({ x:e.clientX, y:e.clientY, msg }); }}>
                      {isMine && !msg.deleted && (
                        <div className="msg-actions">
                          <button className="msg-action-btn" title="Edit"   onClick={()=>startEdit(msg)}>✏️</button>
                          <button className="msg-action-btn" title="Delete" onClick={()=>deleteMessage(msg)}>🗑</button>
                        </div>
                      )}
                      {!isMine && (
                        <div className="msg-avatar" style={{background:(activeUser.avatarColor||"#00d4aa")+"33",color:activeUser.avatarColor||"#00d4aa"}}>
                          {msg.sender[0].toUpperCase()}
                        </div>
                      )}
                      <div className={`msg-bubble${isMine?" mine":" theirs"}${msg.deleted?" deleted":""}`}>
                        {msg.content}
                        <div className="msg-meta">
                          {msg.edited && !msg.deleted && <span className="msg-edited">edited</span>}
                          {msg.time}
                          {isMine && <StatusIcon status={msg.status}/>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef}/>
              </div>

              <div className="typing-indicator">
                {isPeerTyping && (
                  <><div className="typing-dots"><span/><span/><span/></div><span>{activeUser.username} is typing...</span></>
                )}
              </div>

              {editingMsg && (
                <div className="edit-overlay">
                  <span>✏️ Editing: <em style={{color:"#e0e0f0"}}>{editingMsg.content.slice(0,40)}{editingMsg.content.length>40?"...":""}</em></span>
                  <button type="button" onClick={cancelEdit}>✕</button>
                </div>
              )}

              <div className="chat-input-area" onClick={e=>e.stopPropagation()}>
                {showEmoji && (
                  <div className="emoji-panel">
                    {EMOJIS.map(e=>(
                      <button key={e} className="emoji-btn" type="button" onClick={()=>{ setInput(v=>v+e); inputRef.current?.focus(); }}>{e}</button>
                    ))}
                  </div>
                )}
                <div className="input-row">
                  <button className="action-btn" type="button" onClick={()=>setShowEmoji(v=>!v)}>😀</button>
                  <input
                    ref={inputRef}
                    className="input-field"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(); } }}
                    placeholder={editingMsg?"Edit your message...":"Type a message..."}
                  />
                  <button className="send-btn" type="button" onClick={sendMessage} disabled={!input.trim()}>
                    {editingMsg ? "✓" : "➤"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y} msg={ctxMenu.msg}
          currentUser={currentUser.username}
          onEdit={startEdit}
          onDelete={deleteMessage}
          onClose={()=>setCtxMenu(null)}
        />
      )}

      {showProfile && (
        <ProfileModal
          currentUser={currentUser}
          onClose={()=>setShowProfile(false)}
          onUpdated={(updated)=>{ setCurrentUser(updated); setShowProfile(false); }}
          onDeleted={handleLogout}
        />
      )}
    </>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]               = useState("login");
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogin  = (user) => { setCurrentUser(user); setPage("chat"); };
  const handleSignup = (user) => { setCurrentUser(user); setPage("chat"); };
  const handleLogout = ()     => { setCurrentUser(null); setPage("login"); };

  if (page === "login")  return <LoginPage  onLogin={handleLogin}   onGotoSignup={()=>setPage("signup")} />;
  if (page === "signup") return <SignupPage onSignup={handleSignup} onGotoLogin={()=>setPage("login")} />;
  return <ChatPage currentUser={currentUser} onLogout={handleLogout} />;
}
