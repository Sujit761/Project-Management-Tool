import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const API = "http://127.0.0.1:8000";
const WS_BASE = "ws://127.0.0.1:8000/ws";

const PRIORITY_CONFIG = {
    low: { label: "Low", color: "#22c55e", bg: "#052e16" },
    medium: { label: "Medium", color: "#f59e0b", bg: "#1c1003" },
    high: { label: "High", color: "#f97316", bg: "#1c0a00" },
    urgent: { label: "Urgent", color: "#ef4444", bg: "#1f0000" },
};

const PROJECT_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4", "#84cc16", "#f59e0b", "#e11d48", "#0ea5e9"];

// ─── API Helper ───────────────────────────────────────────────────────────────
function useApi() {
    const token = () => localStorage.getItem("pf_token");
    const headers = () => ({
        "Content-Type": "application/json",
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    });

    const request = async (method, path, body = null) => {
        const res = await fetch(`${API}${path}`, {
            method,
            headers: headers(),
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Unknown error" }));
            throw new Error(err.detail || "Request failed");
        }
        return res.json();
    };

    return {
        get: (path) => request("GET", path),
        post: (path, body) => request("POST", path, body),
        patch: (path, body) => request("PATCH", path, body),
        delete: (path) => request("DELETE", path),
        postForm: async (path, body) => {
            const res = await fetch(`${API}${path}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token()}` },
                body: new URLSearchParams(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Unknown error" }));
                throw new Error(err.detail || "Login failed");
            }
            return res.json();
        },
    };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useWebSocket(projectId, token, onMessage) {
    const wsRef = useRef(null);
    useEffect(() => {
        if (!projectId || !token) return;
        const ws = new WebSocket(`${WS_BASE}/${projectId}/${token}`);
        wsRef.current = ws;
        ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { } };
        ws.onclose = () => { wsRef.current = null; };
        const ping = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" })); }, 30000);
        return () => { clearInterval(ping); ws.close(); };
    }, [projectId, token]);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0a0a0f;
    --bg-1:     #111118;
    --bg-2:     #18181f;
    --bg-3:     #1f1f28;
    --bg-4:     #28282f;
    --border:   rgba(255,255,255,0.07);
    --border-h: rgba(255,255,255,0.14);
    --text:     #f1f0fb;
    --text-2:   #9b99b8;
    --text-3:   #5c5a78;
    --accent:   #7c6af7;
    --accent-h: #9b8dff;
    --accent-bg: rgba(124,106,247,0.12);
    --green:    #22c55e;
    --red:      #ef4444;
    --amber:    #f59e0b;
    --radius:   10px;
    --radius-lg: 16px;
    --shadow:   0 4px 24px rgba(0,0,0,0.4);
    --shadow-lg: 0 12px 48px rgba(0,0,0,0.6);
    --font: 'Outfit', sans-serif;
    --mono: 'JetBrains Mono', monospace;
  }

  html, body, #root { height: 100%; font-family: var(--font); background: var(--bg); color: var(--text); }
  * { scrollbar-width: thin; scrollbar-color: var(--bg-4) transparent; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-thumb { background: var(--bg-4); border-radius: 99px; }

  button { cursor: pointer; border: none; background: none; font-family: var(--font); }
  input, textarea, select { font-family: var(--font); }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }

  .fade-in { animation: fadeIn 0.25s ease forwards; }
  .scale-in { animation: scaleIn 0.2s ease forwards; }
  .slide-in { animation: slideIn 0.25s ease forwards; }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────
const Spinner = ({ size = 20 }) => (
    <div style={{
        width: size, height: size, border: `2px solid var(--bg-4)`,
        borderTopColor: "var(--accent)", borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
    }} />
);

const Avatar = ({ user, size = 32 }) => {
    if (!user) return null;
    const initials = user.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";
    return (
        <div title={user.full_name} style={{
            width: size, height: size, borderRadius: "50%",
            background: user.avatar_color || "#6366f1",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.38, fontWeight: 600, color: "#fff", flexShrink: 0,
            fontFamily: "var(--font)",
        }}>{initials}</div>
    );
};

const Badge = ({ label, color, bg }) => (
    <span style={{
        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
        background: bg || "var(--bg-3)", color: color || "var(--text-2)",
        letterSpacing: "0.03em", textTransform: "uppercase",
    }}>{label}</span>
);

const Input = ({ label, ...props }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {label && <label style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{label}</label>}
        <input style={{
            background: "var(--bg-3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
            color: "var(--text)", padding: "10px 14px", fontSize: 14, outline: "none",
            transition: "border-color 0.2s",
        }}
            onFocus={e => e.target.style.borderColor = "var(--accent)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
            {...props} />
    </div>
);

const Textarea = ({ label, ...props }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {label && <label style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{label}</label>}
        <textarea style={{
            background: "var(--bg-3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
            color: "var(--text)", padding: "10px 14px", fontSize: 14, outline: "none",
            resize: "vertical", minHeight: 80, transition: "border-color 0.2s",
        }}
            onFocus={e => e.target.style.borderColor = "var(--accent)"}
            onBlur={e => e.target.style.borderColor = "var(--border)"}
            {...props} />
    </div>
);

const Btn = ({ children, variant = "primary", size = "md", loading, style: s, ...props }) => {
    const sz = size === "sm" ? { padding: "7px 14px", fontSize: 13 } : size === "lg" ? { padding: "13px 28px", fontSize: 16 } : { padding: "10px 20px", fontSize: 14 };
    const vars = {
        primary: { background: "var(--accent)", color: "#fff" },
        secondary: { background: "var(--bg-3)", color: "var(--text)" },
        ghost: { background: "transparent", color: "var(--text-2)" },
        danger: { background: "rgba(239,68,68,0.15)", color: "#ef4444" },
    };
    return (
        <button style={{
            ...sz, fontWeight: 600, borderRadius: "var(--radius)", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.15s", fontFamily: "var(--font)",
            opacity: props.disabled || loading ? 0.6 : 1, ...vars[variant], ...s,
        }}
            onMouseEnter={e => { if (!props.disabled && !loading) e.currentTarget.style.filter = "brightness(1.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
            {...props}
            disabled={props.disabled || loading}
        >
            {loading ? <Spinner size={16} /> : children}
        </button>
    );
};

const Modal = ({ title, onClose, children, width = 480 }) => (
    <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
    }}>
        <div onClick={e => e.stopPropagation()} className="scale-in" style={{
            background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
            width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto",
            boxShadow: "var(--shadow-lg)",
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
                <button onClick={onClose} style={{ color: "var(--text-3)", fontSize: 20, cursor: "pointer", background: "none", border: "none", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>{children}</div>
        </div>
    </div>
);

// ─── Auth Page ─────────────────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
    const api = useApi();
    const [mode, setMode] = useState("login");
    const [form, setForm] = useState({ username: "demo", email: "", full_name: "", password: "demo123" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const submit = async () => {
        setError(""); setLoading(true);
        try {
            let data;
            if (mode === "login") {
                data = await api.postForm("/auth/login", { username: form.username, password: form.password });
            } else {
                data = await api.post("/auth/register", form);
            }
            localStorage.setItem("pf_token", data.access_token);
            onLogin(data.user, data.access_token);
        } catch (e) { setError(e.message); }
        setLoading(false);
    };

    return (
        <div style={{
            minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--bg)", padding: 16,
        }}>
            <style>{globalStyles}</style>
            {/* Background grid */}
            <div style={{
                position: "fixed", inset: 0, opacity: 0.04,
                backgroundImage: "linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
            }} />
            {/* Glow */}
            <div style={{ position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600, background: "radial-gradient(circle, rgba(124,106,247,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

            <div className="fade-in" style={{
                width: "100%", maxWidth: 420, background: "var(--bg-2)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                padding: 40, boxShadow: "var(--shadow-lg)", position: "relative", zIndex: 1,
            }}>
                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 36 }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: 14, background: "var(--accent)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 24, margin: "0 auto 16px", boxShadow: "0 0 32px rgba(124,106,247,0.4)",
                    }}>⚡</div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>ProjectFlow</h1>
                    <p style={{ color: "var(--text-3)", fontSize: 14, marginTop: 6 }}>Collaborative project management</p>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", background: "var(--bg-3)", borderRadius: "var(--radius)", padding: 4, marginBottom: 28, gap: 4 }}>
                    {["login", "register"].map(m => (
                        <button key={m} onClick={() => setMode(m)} style={{
                            flex: 1, padding: "8px 0", borderRadius: 7, fontSize: 14, fontWeight: 600,
                            background: mode === m ? "var(--bg-4)" : "transparent",
                            color: mode === m ? "var(--text)" : "var(--text-3)",
                            transition: "all 0.15s", cursor: "pointer", border: "none",
                        }}>{m === "login" ? "Sign In" : "Register"}</button>
                    ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <Input label="Username" value={form.username} onChange={set("username")} placeholder="your_username" />
                    {mode === "register" && <>
                        <Input label="Full Name" value={form.full_name} onChange={set("full_name")} placeholder="Your Name" />
                        <Input label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
                    </>}
                    <Input label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />

                    {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, color: "#ef4444" }}>{error}</div>}

                    <Btn onClick={submit} loading={loading} size="lg" style={{ marginTop: 4, width: "100%" }}>
                        {mode === "login" ? "Sign In" : "Create Account"}
                    </Btn>
                </div>

                <p style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12, marginTop: 24 }}>
                    Demo: <code style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 12 }}>demo / demo123</code>
                </p>
            </div>
        </div>
    );
}

// ─── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClick, members, onDragStart }) {
    const p = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
    const isOverdue = task.due_date && new Date(task.due_date) < new Date();
    const tags = task.tags ? task.tags.split(",").filter(Boolean) : [];

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={() => onClick(task)}
            className="fade-in"
            style={{
                background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
                padding: "14px 14px 12px", cursor: "pointer", transition: "all 0.15s",
                marginBottom: 8, userSelect: "none",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-h)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "var(--shadow)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
        >
            {/* Priority strip */}
            <div style={{ width: "100%", height: 2, borderRadius: 99, background: p.color, marginBottom: 10, opacity: 0.7 }} />

            <p style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, marginBottom: 10 }}>{task.title}</p>

            {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {tags.slice(0, 3).map(tag => (
                        <span key={tag} style={{
                            fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 99,
                            background: "var(--accent-bg)", color: "var(--accent-h)",
                        }}>{tag.trim()}</span>
                    ))}
                </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Badge label={p.label} color={p.color} bg={p.bg} />
                    {isOverdue && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>⚠ Overdue</span>}
                    {task.due_date && !isOverdue && (
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                            📅 {new Date(task.due_date).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {task.comment_count > 0 && (
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>💬 {task.comment_count}</span>
                    )}
                    {task.assignee ? <Avatar user={task.assignee} size={24} /> : (
                        <div style={{ width: 24, height: 24, borderRadius: "50%", border: "1.5px dashed var(--border-h)" }} />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Task Detail Modal ─────────────────────────────────────────────────────────
function TaskDetailModal({ task, onClose, onUpdate, onDelete, members, columns, api }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ ...task });
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get(`/tasks/${task.id}/comments`).then(setComments).catch(() => { });
    }, [task.id]);

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        setSaving(true);
        try {
            const updated = await api.patch(`/projects/${task.project_id}/tasks/${task.id}`, {
                title: form.title, description: form.description,
                priority: form.priority, tags: form.tags,
                assignee_id: form.assignee_id || null,
                due_date: form.due_date || null,
                column_id: form.column_id,
            });
            onUpdate(updated);
            setEditing(false);
        } catch (e) { alert(e.message); }
        setSaving(false);
    };

    const addComment = async () => {
        if (!newComment.trim()) return;
        setLoading(true);
        try {
            const c = await api.post(`/tasks/${task.id}/comments`, { content: newComment });
            setComments(cs => [...cs, c]);
            setNewComment("");
        } catch (e) { alert(e.message); }
        setLoading(false);
    };

    const deleteTask = async () => {
        if (!confirm("Delete this task?")) return;
        await api.delete(`/projects/${task.project_id}/tasks/${task.id}`);
        onDelete(task.id);
        onClose();
    };

    const p = PRIORITY_CONFIG[form.priority] || PRIORITY_CONFIG.medium;

    return (
        <Modal title="" onClose={onClose} width={680}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                        {editing ? (
                            <Input value={form.title} onChange={set("title")} />
                        ) : (
                            <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4 }}>{task.title}</h2>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {editing ? (
                            <>
                                <Btn variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Btn>
                                <Btn size="sm" onClick={save} loading={saving}>Save</Btn>
                            </>
                        ) : (
                            <>
                                <Btn variant="secondary" size="sm" onClick={() => setEditing(true)}>✏ Edit</Btn>
                                <Btn variant="danger" size="sm" onClick={deleteTask}>🗑 Delete</Btn>
                            </>
                        )}
                    </div>
                </div>

                {/* Meta grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, background: "var(--bg-3)", padding: 16, borderRadius: "var(--radius)" }}>
                    {/* Status */}
                    <div>
                        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Status</p>
                        {editing ? (
                            <select value={form.column_id} onChange={set("column_id")} style={{ background: "var(--bg-4)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 10px", fontSize: 13, width: "100%" }}>
                                {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: columns.find(c => c.id === task.column_id)?.color || "var(--text-3)" }} />
                                <span style={{ fontSize: 13, color: "var(--text)" }}>{columns.find(c => c.id === task.column_id)?.name || "Unknown"}</span>
                            </div>
                        )}
                    </div>

                    {/* Priority */}
                    <div>
                        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Priority</p>
                        {editing ? (
                            <select value={form.priority} onChange={set("priority")} style={{ background: "var(--bg-4)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 10px", fontSize: 13, width: "100%" }}>
                                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        ) : (
                            <Badge label={p.label} color={p.color} bg={p.bg} />
                        )}
                    </div>

                    {/* Assignee */}
                    <div>
                        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Assignee</p>
                        {editing ? (
                            <select value={form.assignee_id || ""} onChange={set("assignee_id")} style={{ background: "var(--bg-4)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 10px", fontSize: 13, width: "100%" }}>
                                <option value="">Unassigned</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                            </select>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {task.assignee ? <><Avatar user={task.assignee} size={24} /><span style={{ fontSize: 13 }}>{task.assignee.full_name}</span></> : <span style={{ fontSize: 13, color: "var(--text-3)" }}>Unassigned</span>}
                            </div>
                        )}
                    </div>

                    {/* Due date */}
                    <div>
                        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Due Date</p>
                        {editing ? (
                            <input type="datetime-local" value={form.due_date ? form.due_date.slice(0, 16) : ""} onChange={set("due_date")} style={{ background: "var(--bg-4)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 10px", fontSize: 13 }} />
                        ) : (
                            <span style={{ fontSize: 13, color: task.due_date && new Date(task.due_date) < new Date() ? "#ef4444" : "var(--text)" }}>
                                {task.due_date ? new Date(task.due_date).toLocaleString() : "No due date"}
                            </span>
                        )}
                    </div>

                    {/* Tags */}
                    <div>
                        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Tags</p>
                        {editing ? (
                            <input value={form.tags || ""} onChange={set("tags")} placeholder="tag1, tag2" style={{ background: "var(--bg-4)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 10px", fontSize: 13, width: "100%" }} />
                        ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {(task.tags || "").split(",").filter(Boolean).map(t => (
                                    <span key={t} style={{ fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 99, background: "var(--accent-bg)", color: "var(--accent-h)" }}>{t.trim()}</span>
                                ))}
                                {!task.tags && <span style={{ fontSize: 12, color: "var(--text-3)" }}>No tags</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <p style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>Description</p>
                    {editing ? (
                        <Textarea value={form.description || ""} onChange={set("description")} rows={4} />
                    ) : (
                        <p style={{ fontSize: 14, color: task.description ? "var(--text)" : "var(--text-3)", lineHeight: 1.7, background: "var(--bg-3)", padding: "12px 14px", borderRadius: "var(--radius)" }}>
                            {task.description || "No description added."}
                        </p>
                    )}
                </div>

                {/* Comments */}
                <div>
                    <p style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, marginBottom: 12, textTransform: "uppercase" }}>
                        Comments ({comments.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflow: "auto", marginBottom: 12 }}>
                        {comments.map(c => (
                            <div key={c.id} style={{ display: "flex", gap: 10, padding: "10px 12px", background: "var(--bg-3)", borderRadius: "var(--radius)" }}>
                                <Avatar user={c.user} size={28} />
                                <div>
                                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.user?.full_name}</span>
                                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{new Date(c.created_at).toLocaleString()}</span>
                                    </div>
                                    <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-2)" }}>{c.content}</p>
                                </div>
                            </div>
                        ))}
                        {comments.length === 0 && <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: 20 }}>No comments yet. Start the conversation.</p>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <textarea
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addComment(); }}
                            placeholder="Add a comment... (Cmd+Enter to submit)"
                            rows={2}
                            style={{ flex: 1, background: "var(--bg-3)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", padding: "10px 14px", fontSize: 13, resize: "none", outline: "none", fontFamily: "var(--font)" }}
                            onFocus={e => e.target.style.borderColor = "var(--accent)"}
                            onBlur={e => e.target.style.borderColor = "var(--border)"}
                        />
                        <Btn onClick={addComment} loading={loading} style={{ alignSelf: "flex-end" }}>Send</Btn>
                    </div>
                </div>

                <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right" }}>
                    Created {new Date(task.created_at).toLocaleString()} · Updated {new Date(task.updated_at).toLocaleString()}
                </p>
            </div>
        </Modal>
    );
}

// ─── Board Column ──────────────────────────────────────────────────────────────
function BoardColumn({ column, tasks, members, onTaskClick, onTaskDrop, onAddTask, onDeleteColumn, api, projectId }) {
    const [addingTask, setAddingTask] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [dragOver, setDragOver] = useState(false);

    const submit = async () => {
        if (!taskTitle.trim()) return;
        await onAddTask(column.id, taskTitle.trim());
        setTaskTitle("");
        setAddingTask(false);
    };

    return (
        <div
            style={{
                width: 280, flexShrink: 0, display: "flex", flexDirection: "column",
                background: "var(--bg-1)", borderRadius: "var(--radius-lg)",
                border: dragOver ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                transition: "border-color 0.15s", maxHeight: "calc(100vh - 160px)",
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const tid = e.dataTransfer.getData("taskId"); if (tid) onTaskDrop(parseInt(tid), column.id); }}
        >
            {/* Column header */}
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: column.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.01em" }}>{column.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-3)", background: "var(--bg-3)", borderRadius: 99, padding: "1px 7px", fontWeight: 600 }}>{tasks.length}</span>
                </div>
                <button onClick={() => onDeleteColumn(column.id)} style={{ fontSize: 14, color: "var(--text-3)", cursor: "pointer", background: "none", border: "none", opacity: 0.5, transition: "opacity 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                >✕</button>
            </div>

            {/* Tasks */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px 12px 4px" }}>
                {tasks.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        members={members}
                        onClick={onTaskClick}
                        onDragStart={(e) => { e.dataTransfer.setData("taskId", task.id); }}
                    />
                ))}

                {/* Add task inline */}
                {addingTask ? (
                    <div className="scale-in" style={{ background: "var(--bg-2)", border: "1.5px solid var(--accent)", borderRadius: "var(--radius)", padding: 12, marginBottom: 8 }}>
                        <textarea
                            autoFocus
                            value={taskTitle}
                            onChange={e => setTaskTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") setAddingTask(false); }}
                            placeholder="Task title..."
                            rows={2}
                            style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 14, resize: "none", fontFamily: "var(--font)" }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <Btn size="sm" onClick={submit}>Add</Btn>
                            <Btn variant="ghost" size="sm" onClick={() => setAddingTask(false)}>Cancel</Btn>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Footer */}
            {!addingTask && (
                <button onClick={() => setAddingTask(true)} style={{
                    margin: "8px 12px 12px", padding: "9px", borderRadius: "var(--radius)",
                    border: "1.5px dashed var(--border)", color: "var(--text-3)", fontSize: 13,
                    cursor: "pointer", background: "none", fontFamily: "var(--font)",
                    transition: "all 0.15s",
                }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-3)"; }}
                >+ Add task</button>
            )}
        </div>
    );
}

// ─── Board View ────────────────────────────────────────────────────────────────
function BoardView({ project, currentUser, api, token }) {
    const [columns, setColumns] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddColumn, setShowAddColumn] = useState(false);
    const [newColName, setNewColName] = useState("");
    const [showAddMember, setShowAddMember] = useState(false);
    const [userSearch, setUserSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]);

    // Load board data
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [cols, tks, mbs] = await Promise.all([
                    api.get(`/projects/${project.id}/columns`),
                    api.get(`/projects/${project.id}/tasks`),
                    api.get(`/projects/${project.id}/members`),
                ]);
                setColumns(cols);
                setTasks(tks);
                setMembers(mbs);
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        load();
    }, [project.id]);

    // WebSocket
    useWebSocket(project.id, token, (msg) => {
        if (msg.type === "task_created") setTasks(ts => [...ts, msg.data]);
        else if (msg.type === "task_updated") setTasks(ts => ts.map(t => t.id === msg.data.id ? msg.data : t));
        else if (msg.type === "task_deleted") setTasks(ts => ts.filter(t => t.id !== msg.data.id));
        else if (msg.type === "column_created") setColumns(cs => [...cs, msg.data]);
        else if (msg.type === "column_deleted") setColumns(cs => cs.filter(c => c.id !== msg.data.id));
        else if (msg.type === "user_joined") setOnlineUsers(u => [...new Set([...u, msg.data.user_id])]);
        else if (msg.type === "comment_added") {
            setTasks(ts => ts.map(t => t.id === msg.data.task_id ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t));
            if (selectedTask?.id === msg.data.task_id) setSelectedTask(st => ({ ...st, comment_count: (st.comment_count || 0) + 1 }));
        }
    });

    const addTask = async (columnId, title) => {
        const task = await api.post(`/projects/${project.id}/tasks`, { title, column_id: columnId });
        setTasks(ts => [...ts, task]);
    };

    const moveTask = async (taskId, newColumnId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.column_id === newColumnId) return;
        
        // Optimistic UI update
        const originalColumnId = task.column_id;
        setTasks(ts => ts.map(t => t.id === taskId ? { ...t, column_id: newColumnId } : t));
        
        try {
            await api.patch(`/projects/${project.id}/tasks/${taskId}`, { column_id: newColumnId });
        } catch (e) {
            // Revert on error
            setTasks(ts => ts.map(t => t.id === taskId ? { ...t, column_id: originalColumnId } : t));
            console.error(e);
        }
    };

    const addColumn = async () => {
        if (!newColName.trim()) return;
        const col = await api.post(`/projects/${project.id}/columns`, { name: newColName, position: columns.length });
        setColumns(cs => [...cs, col]);
        setNewColName("");
        setShowAddColumn(false);
    };

    const deleteColumn = async (colId) => {
        if (!confirm("Delete this column and all its tasks?")) return;
        await api.delete(`/projects/${project.id}/columns/${colId}`);
        setColumns(cs => cs.filter(c => c.id !== colId));
        setTasks(ts => ts.filter(t => t.column_id !== colId));
    };

    const searchUsers = async (q) => {
        if (!q.trim()) { setSearchResults([]); return; }
        const results = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
        setSearchResults(results.filter(u => !members.find(m => m.id === u.id)));
    };

    const addMember = async (userId) => {
        await api.post(`/projects/${project.id}/members?user_id=${userId}`, {});
        const user = searchResults.find(u => u.id === userId);
        if (user) setMembers(ms => [...ms, user]);
        setSearchResults([]);
        setUserSearch("");
        setShowAddMember(false);
    };

    if (loading) return (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spinner size={40} />
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {/* Board toolbar */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0,
                background: "var(--bg-1)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 200 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: project.color }} />
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{project.name}</h2>
                        <p style={{ fontSize: 12, color: "var(--text-3)" }}>{tasks.length} tasks · {members.length} members</p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{ flex: 1, maxWidth: 300, margin: "0 20px" }}>
                    {(() => {
                        const doneCol = columns.find(c => c.name.toLowerCase() === "done");
                        const doneCount = doneCol ? tasks.filter(t => t.column_id === doneCol.id).length : 0;
                        const progressPct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
                        return (
                            <>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase" }}>Progress</span>
                                    <span style={{ fontSize: 11, color: "var(--text-2)", fontWeight: 600 }}>{progressPct}%</span>
                                </div>
                                <div style={{ width: "100%", height: 6, background: "var(--bg-3)", borderRadius: 99, overflow: "hidden" }}>
                                    <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--green)", transition: "width 0.3s ease" }} />
                                </div>
                            </>
                        );
                    })()}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Online members */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                        {members.slice(0, 5).map((m, i) => (
                            <div key={m.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i }}>
                                <Avatar user={m} size={28} />
                            </div>
                        ))}
                    </div>
                    <Btn variant="secondary" size="sm" onClick={() => setShowAddMember(true)}>+ Invite</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => setShowAddColumn(true)}>+ Column</Btn>
                </div>
            </div>

            {/* Board */}
            <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                {columns.map(col => (
                    <BoardColumn
                        key={col.id}
                        column={col}
                        tasks={tasks.filter(t => t.column_id === col.id).sort((a, b) => a.position - b.position)}
                        members={members}
                        onTaskClick={setSelectedTask}
                        onTaskDrop={moveTask}
                        onAddTask={addTask}
                        onDeleteColumn={deleteColumn}
                        api={api}
                        projectId={project.id}
                    />
                ))}

                {/* Add column inline */}
                {showAddColumn && (
                    <div className="scale-in" style={{ width: 280, flexShrink: 0, background: "var(--bg-2)", border: "1.5px solid var(--accent)", borderRadius: "var(--radius-lg)", padding: 16 }}>
                        <input
                            autoFocus
                            value={newColName}
                            onChange={e => setNewColName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") setShowAddColumn(false); }}
                            placeholder="Column name..."
                            style={{ width: "100%", background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", padding: "10px 12px", fontSize: 14, outline: "none", fontFamily: "var(--font)" }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <Btn size="sm" onClick={addColumn}>Add</Btn>
                            <Btn variant="ghost" size="sm" onClick={() => setShowAddColumn(false)}>Cancel</Btn>
                        </div>
                    </div>
                )}
            </div>

            {/* Task detail modal */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    members={members}
                    columns={columns}
                    api={api}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={(updated) => {
                        setTasks(ts => ts.map(t => t.id === updated.id ? updated : t));
                        setSelectedTask(updated);
                    }}
                    onDelete={(id) => { setTasks(ts => ts.filter(t => t.id !== id)); setSelectedTask(null); }}
                />
            )}

            {/* Add member modal */}
            {showAddMember && (
                <Modal title="Invite Member" onClose={() => setShowAddMember(false)} width={400}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Search for users to add to <strong>{project.name}</strong></p>
                        <Input
                            value={userSearch}
                            onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                            placeholder="Search username, name, or email..."
                        />
                        {searchResults.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {searchResults.map(u => (
                                    <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-3)", borderRadius: "var(--radius)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <Avatar user={u} size={32} />
                                            <div>
                                                <p style={{ fontSize: 13, fontWeight: 600 }}>{u.full_name}</p>
                                                <p style={{ fontSize: 11, color: "var(--text-3)" }}>@{u.username}</p>
                                            </div>
                                        </div>
                                        <Btn size="sm" onClick={() => addMember(u.id)}>+ Add</Btn>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div>
                            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, fontWeight: 600 }}>Current Members</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {members.map(m => (
                                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg-3)", borderRadius: "var(--radius)" }}>
                                        <Avatar user={m} size={28} />
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 500 }}>{m.full_name}</p>
                                            <p style={{ fontSize: 11, color: "var(--text-3)" }}>@{m.username}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
    const api = useApi();
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("pf_token"));
    const [projects, setProjects] = useState([]);
    const [activeProject, setActiveProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [newProject, setNewProject] = useState({ name: "", description: "", color: PROJECT_COLORS[0] });
    const [creatingProject, setCreatingProject] = useState(false);

    // Auto-login if token exists
    useEffect(() => {
        if (!token) { setLoading(false); return; }
        api.get("/auth/me").then(u => {
            setUser(u);
            loadProjects();
        }).catch(() => {
            localStorage.removeItem("pf_token");
            setLoading(false);
        });
    }, []);

    const loadProjects = async () => {
        try {
            const ps = await api.get("/projects");
            setProjects(ps);
            if (ps.length > 0 && !activeProject) setActiveProject(ps[0]);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const loadNotifications = async () => {
        try {
            const [notifs, count] = await Promise.all([
                api.get("/notifications"),
                api.get("/notifications/unread-count"),
            ]);
            setNotifications(notifs);
            setUnreadCount(count.count);
        } catch (e) { }
    };

    useEffect(() => {
        if (user) {
            loadNotifications();
            const interval = setInterval(loadNotifications, 15000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const handleLogin = (u, t) => {
        setUser(u);
        setToken(t);
        loadProjects();
    };

    const logout = () => {
        localStorage.removeItem("pf_token");
        setUser(null);
        setToken(null);
        setProjects([]);
        setActiveProject(null);
    };

    const createProject = async () => {
        if (!newProject.name.trim()) return;
        setCreatingProject(true);
        try {
            const p = await api.post("/projects", newProject);
            setProjects(ps => [p, ...ps]);
            setActiveProject(p);
            setShowCreateProject(false);
            setNewProject({ name: "", description: "", color: PROJECT_COLORS[0] });
        } catch (e) { alert(e.message); }
        setCreatingProject(false);
    };

    const markAllRead = async () => {
        await api.post("/notifications/read-all", {});
        setUnreadCount(0);
        setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
    };

    if (!user) {
        return (
            <>
                <style>{globalStyles}</style>
                <AuthPage onLogin={handleLogin} />
            </>
        );
    }

    if (loading) return (
        <>
            <style>{globalStyles}</style>
            <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Spinner size={40} />
            </div>
        </>
    );

    const NOTIF_ICONS = { task_assigned: "📋", comment_added: "💬", project_invite: "🎉" };

    return (
        <>
            <style>{globalStyles}</style>
            <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
                {/* Sidebar */}
                <aside style={{
                    width: 240, background: "var(--bg-1)", borderRight: "1px solid var(--border)",
                    display: "flex", flexDirection: "column", flexShrink: 0,
                }}>
                    {/* Logo */}
                    <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: 9, background: "var(--accent)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                                boxShadow: "0 0 20px rgba(124,106,247,0.3)",
                            }}>⚡</div>
                            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>ProjectFlow</span>
                        </div>
                    </div>

                    {/* Projects list */}
                    <div style={{ flex: 1, overflow: "auto", padding: "12px 0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Projects</span>
                            <button onClick={() => setShowCreateProject(true)} style={{
                                width: 20, height: 20, borderRadius: 5, background: "var(--bg-3)", border: "1px solid var(--border)",
                                color: "var(--text-3)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", lineHeight: 1, transition: "all 0.15s",
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#fff"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-3)"; e.currentTarget.style.color = "var(--text-3)"; }}
                            >+</button>
                        </div>
                        {projects.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setActiveProject(p)}
                                className={activeProject?.id === p.id ? "" : ""}
                                style={{
                                    width: "100%", padding: "9px 18px", display: "flex", alignItems: "center", gap: 10,
                                    background: activeProject?.id === p.id ? "var(--bg-3)" : "transparent",
                                    borderLeft: activeProject?.id === p.id ? `3px solid ${p.color}` : "3px solid transparent",
                                    cursor: "pointer", transition: "all 0.12s", border: "none", textAlign: "left",
                                }}
                                onMouseEnter={e => { if (activeProject?.id !== p.id) e.currentTarget.style.background = "var(--bg-2)"; }}
                                onMouseLeave={e => { if (activeProject?.id !== p.id) e.currentTarget.style.background = "transparent"; }}
                            >
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: activeProject?.id === p.id ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: activeProject?.id === p.id ? "var(--text)" : "var(--text-2)" }}>{p.name}</span>
                                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{p.task_count}</span>
                            </button>
                        ))}
                        {projects.length === 0 && (
                            <div style={{ padding: "20px 18px", textAlign: "center" }}>
                                <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.7 }}>No projects yet.<br />Create one to get started.</p>
                            </div>
                        )}
                    </div>

                    {/* User footer */}
                    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar user={user} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.full_name}</p>
                            <p style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{user.username}</p>
                        </div>
                        <button onClick={logout} title="Sign Out" style={{ color: "var(--text-3)", fontSize: 14, cursor: "pointer", background: "none", border: "none", opacity: 0.6, transition: "opacity 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                        >⬡</button>
                    </div>
                </aside>

                {/* Main content */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Top bar */}
                    <header style={{
                        height: 52, background: "var(--bg-1)", borderBottom: "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "flex-end",
                        padding: "0 24px", gap: 12, flexShrink: 0,
                    }}>
                        {/* Notifications */}
                        <div style={{ position: "relative" }}>
                            <button onClick={() => setShowNotifications(s => !s)} style={{
                                width: 36, height: 36, borderRadius: "var(--radius)", background: "var(--bg-3)",
                                border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 16, cursor: "pointer", position: "relative",
                            }}>
                                🔔
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: "absolute", top: -4, right: -4, width: 18, height: 18,
                                        background: "#ef4444", borderRadius: "50%", fontSize: 10, fontWeight: 700,
                                        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                                    }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="scale-in" style={{
                                    position: "absolute", right: 0, top: 44, width: 340, background: "var(--bg-2)",
                                    border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                                    boxShadow: "var(--shadow-lg)", zIndex: 200, maxHeight: 440, overflow: "hidden",
                                    display: "flex", flexDirection: "column",
                                }}>
                                    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: 14, fontWeight: 700 }}>Notifications</span>
                                        {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 12, color: "var(--accent)", cursor: "pointer", background: "none", border: "none" }}>Mark all read</button>}
                                    </div>
                                    <div style={{ overflow: "auto", flex: 1 }}>
                                        {notifications.length === 0 && <p style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13, padding: 24 }}>No notifications</p>}
                                        {notifications.map(n => (
                                            <div key={n.id} onClick={() => setShowNotifications(false)} style={{
                                                padding: "12px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                                                background: n.is_read ? "transparent" : "var(--accent-bg)",
                                                transition: "background 0.12s",
                                            }}
                                                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-3)"}
                                                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? "transparent" : "var(--accent-bg)"}
                                            >
                                                <div style={{ display: "flex", gap: 10 }}>
                                                    <span style={{ fontSize: 18 }}>{NOTIF_ICONS[n.type] || "📌"}</span>
                                                    <div>
                                                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{n.title}</p>
                                                        <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{n.message}</p>
                                                        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ width: 1, height: 20, background: "var(--border)" }} />

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Avatar user={user} size={28} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>{user.full_name}</span>
                        </div>
                    </header>

                    {/* Board or empty state */}
                    {activeProject ? (
                        <BoardView
                            key={activeProject.id}
                            project={activeProject}
                            currentUser={user}
                            api={api}
                            token={token}
                        />
                    ) : (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
                            <div style={{ fontSize: 64, opacity: 0.3 }}>⚡</div>
                            <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-2)" }}>No project selected</p>
                            <p style={{ fontSize: 14, color: "var(--text-3)" }}>Create a project or select one from the sidebar</p>
                            <Btn onClick={() => setShowCreateProject(true)} size="lg">Create your first project</Btn>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Project Modal */}
            {showCreateProject && (
                <Modal title="New Project" onClose={() => setShowCreateProject(false)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <Input label="Project Name" value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} placeholder="My Awesome Project" autoFocus />
                        <Textarea label="Description (optional)" value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))} placeholder="What is this project about?" rows={3} />
                        <div>
                            <label style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500, marginBottom: 8, display: "block" }}>Project Color</label>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {PROJECT_COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setNewProject(p => ({ ...p, color: c }))}
                                        style={{
                                            width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                                            outline: newProject.color === c ? `3px solid ${c}` : "none",
                                            outlineOffset: 3, transition: "outline 0.12s",
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        <Btn onClick={createProject} loading={creatingProject} style={{ width: "100%" }}>Create Project</Btn>
                    </div>
                </Modal>
            )}
        </>
    );
}
