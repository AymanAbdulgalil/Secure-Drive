import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from "../assets/logo.svg";
import { ArrowLeft, Key, HardDrive } from 'lucide-react';
import { getToken, clearToken } from "../tokenStore";
import { api } from "../api";

export default function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [storageStats, setStorageStats] = useState(null);
    const [editing, setEditing] = useState(false);
    const [newName, setNewName] = useState("");
    const [toast, setToast] = useState(null);

    // Change password state
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Name save state
    const [nameSaving, setNameSaving] = useState(false);

    useEffect(() => {
        const token = getToken();
        if (!token) { navigate("/login"); return; }

        api.getMe()
            .then((data) => {
                setUser(data);
                setNewName(data.name);
            })
            .catch(() => navigate("/login"));

        api.getStorageStats()
            .then(setStorageStats)
            .catch(() => {});
    }, [navigate]);

    function showToast(message, type = 'success') {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }

    // Password strength
    function calculateStrength(password) {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        };
        return { strength: Object.values(checks).filter(Boolean).length, checks };
    }

    function getStrengthColor(strength) {
        if (strength <= 2) return "#ef4444";
        if (strength === 3) return "#f59e0b";
        if (strength === 4) return "#eab308";
        return "#22c55e";
    }

    function getStrengthLabel(strength) {
        if (strength <= 2) return "Weak";
        if (strength === 3) return "Fair";
        if (strength === 4) return "Good";
        return "Strong";
    }

    async function handleSaveName() {
        if (!newName.trim() || newName === user.name) {
            setEditing(false);
            return;
        }
        setNameSaving(true);
        try {
            const token = getToken();
            const response = await fetch("/api/v1/auth/me", {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name: newName.trim() })
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data);
                setEditing(false);
                showToast("Name updated successfully.");
            } else {
                showToast("Failed to update name. Please try again.", "error");
            }
        } catch {
            showToast("Network error. Please try again.", "error");
        } finally {
            setNameSaving(false);
        }
    }

    async function handleChangePassword() {
        const { currentPassword, newPassword, confirmPassword } = passwordForm;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast("Please fill in all password fields.", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast("New passwords do not match.", "error");
            return;
        }

        const { strength } = calculateStrength(newPassword);
        if (strength < 4) {
            showToast("Password is too weak. Please meet all requirements.", "error");
            return;
        }

        if (currentPassword === newPassword) {
            showToast("New password must be different from current password.", "error");
            return;
        }

        setPasswordLoading(true);
        try {
            const token = getToken();
            const response = await fetch("/api/v1/auth/me/password", {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                })
            });
            if (response.ok) {
                showToast("Password changed successfully.");
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            } else if (response.status === 401) {
                showToast("Current password is incorrect.", "error");
            } else {
                showToast("Failed to change password. Please try again.", "error");
            }
        } catch {
            showToast("Network error. Please try again.", "error");
        } finally {
            setPasswordLoading(false);
        }
    }

    if (!user) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: "1.2rem", color: "#666" }}>
                Loading...
            </div>
        );
    }

    const storagePercent = storageStats
        ? Math.min((storageStats.total_mb / 10240) * 100, 100)
        : 0;

    const passwordStrength = calculateStrength(passwordForm.newPassword);

    return (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#c9c6c6", fontFamily: "system-ui, -apple-system, sans-serif" }}>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: "fixed",
                    bottom: "24px",
                    right: "24px",
                    padding: "14px 20px",
                    borderRadius: "10px",
                    backgroundColor: toast.type === "error" ? "#fef2f2" : "#f0fdf4",
                    border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#86efac"}`,
                    color: toast.type === "error" ? "#dc2626" : "#15803d",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    zIndex: 999,
                }}>
                    {toast.message}
                </div>
            )}

            {/* Top Bar */}
            <div style={{ backgroundColor: "#c9c6c6", borderBottom: "1px solid #e0e0e0", padding: "16px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                    onClick={() => navigate("/dashboard")}
                    style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#666", fontSize: "0.875rem" }}
                    onMouseOver={(e) => e.currentTarget.style.color = "#4F46E5"}
                    onMouseOut={(e) => e.currentTarget.style.color = "#666"}
                >
                    <ArrowLeft size={18} /> Back to Drive
                </div>
                <div style={{ flexGrow: 1 }} />
                <img src={Logo} alt="Secure Drive logo" style={{ width: "42px", height: "42px" }} />
                <span style={{ fontSize: "1.3rem", fontWeight: 700 }}>Secure Drive</span>
            </div>

            {/* Content */}
            <div style={{ flexGrow: 1, overflow: "auto", padding: "40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "100%", maxWidth: "600px", display: "flex", flexDirection: "column", gap: "20px" }}>

                    <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Profile</h1>

                    {/* Avatar + basic info */}
                    <Card>
                        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "24px" }}>
                            <div style={{
                                width: "72px", height: "72px", borderRadius: "50%",
                                backgroundColor: "#4F46E5", display: "flex",
                                alignItems: "center", justifyContent: "center",
                                fontSize: "1.8rem", fontWeight: 700, color: "white", flexShrink: 0,
                            }}>
                                {user.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a2e" }}>{user.name}</div>
                                <div style={{ fontSize: "0.875rem", color: "#6366f1", marginTop: "2px" }}>{user.email}</div>
                                <div style={{ fontSize: "0.75rem", color: "#999", marginTop: "4px" }}>
                                    Member since {user.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                                </div>
                            </div>
                        </div>

                        {/* Name edit */}
                        <SectionLabel>DISPLAY NAME</SectionLabel>
                        {editing ? (
                            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                <input
                                    autoFocus
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveName();
                                        if (e.key === "Escape") { setEditing(false); setNewName(user.name); }
                                    }}
                                    style={{ flexGrow: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #4F46E5", outline: "none", fontSize: "0.95rem" }}
                                />
                                <ActionButton onClick={handleSaveName} disabled={nameSaving} primary>
                                    {nameSaving ? "Saving..." : "Save"}
                                </ActionButton>
                                <ActionButton onClick={() => { setEditing(false); setNewName(user.name); }}>
                                    Cancel
                                </ActionButton>
                            </div>
                        ) : (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                                <span style={{ fontSize: "0.95rem", color: "#1a1a2e", fontWeight: 500 }}>{user.name}</span>
                                <button
                                    onClick={() => setEditing(true)}
                                    style={{ fontSize: "0.8rem", color: "#4F46E5", border: "none", backgroundColor: "transparent", cursor: "pointer", fontWeight: 600 }}
                                    onMouseOver={(e) => e.currentTarget.style.textDecoration = "underline"}
                                    onMouseOut={(e) => e.currentTarget.style.textDecoration = "none"}
                                >
                                    Edit
                                </button>
                            </div>
                        )}

                        <Divider />

                        {/* Email — display only */}
                        <SectionLabel>EMAIL</SectionLabel>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                            <span style={{ fontSize: "0.95rem", color: "#1a1a2e", fontWeight: 500 }}>{user.email}</span>
                            <span style={{ fontSize: "0.75rem", color: "#999" }}>Contact support to change</span>
                        </div>
                    </Card>

                    {/* Storage */}
                    <Card>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                            <HardDrive size={18} color="#4F46E5" />
                            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Storage</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", backgroundColor: "#e5e7eb", borderRadius: "4px", marginBottom: "8px" }}>
                            <div style={{
                                width: `${storagePercent}%`,
                                height: "100%",
                                backgroundColor: storagePercent > 90 ? "#dc2626" : "#4F46E5",
                                borderRadius: "4px",
                                transition: "width 0.3s ease",
                            }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#666" }}>
                            <span>{storageStats ? `${storageStats.total_mb.toFixed(2)} MB used` : "Loading..."}</span>
                            <span>10 GB total</span>
                        </div>
                        {storageStats && (
                            <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#999" }}>
                                {storageStats.total_files} file{storageStats.total_files !== 1 ? "s" : ""} stored
                            </div>
                        )}
                    </Card>

                    {/* Change Password */}
                    <Card>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                            <Key size={18} color="#4F46E5" />
                            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Change Password</span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {/* Current password */}
                            <div>
                                <SectionLabel>CURRENT PASSWORD</SectionLabel>
                                <PasswordInput
                                    value={passwordForm.currentPassword}
                                    onChange={(v) => setPasswordForm({ ...passwordForm, currentPassword: v })}
                                    show={showPasswords.current}
                                    onToggle={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                                    placeholder="Enter current password"
                                />
                            </div>

                            {/* New password */}
                            <div>
                                <SectionLabel>NEW PASSWORD</SectionLabel>
                                <PasswordInput
                                    value={passwordForm.newPassword}
                                    onChange={(v) => setPasswordForm({ ...passwordForm, newPassword: v })}
                                    show={showPasswords.new}
                                    onToggle={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                    placeholder="Enter new password"
                                />
                                {/* Strength meter */}
                                {passwordForm.newPassword && (
                                    <div style={{ marginTop: "8px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                                            <span style={{ fontSize: "0.75rem", color: "#666" }}>Password strength</span>
                                            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: getStrengthColor(passwordStrength.strength) }}>
                                                {getStrengthLabel(passwordStrength.strength)}
                                            </span>
                                        </div>
                                        <div style={{ height: "5px", backgroundColor: "#e5e7eb", borderRadius: "3px" }}>
                                            <div style={{
                                                width: `${(passwordStrength.strength / 5) * 100}%`,
                                                height: "100%",
                                                backgroundColor: getStrengthColor(passwordStrength.strength),
                                                borderRadius: "3px",
                                                transition: "width 0.2s",
                                            }} />
                                        </div>
                                        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                            {!passwordStrength.checks.length && <Hint>At least 8 characters</Hint>}
                                            {!passwordStrength.checks.uppercase && <Hint>One uppercase letter</Hint>}
                                            {!passwordStrength.checks.lowercase && <Hint>One lowercase letter</Hint>}
                                            {!passwordStrength.checks.number && <Hint>One number</Hint>}
                                            {!passwordStrength.checks.special && <Hint>One special character</Hint>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <SectionLabel>CONFIRM NEW PASSWORD</SectionLabel>
                                <PasswordInput
                                    value={passwordForm.confirmPassword}
                                    onChange={(v) => setPasswordForm({ ...passwordForm, confirmPassword: v })}
                                    show={showPasswords.confirm}
                                    onToggle={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                    placeholder="Confirm new password"
                                />
                                {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                                    <span style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "4px", display: "block" }}>
                                        Passwords do not match
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={handleChangePassword}
                                disabled={passwordLoading}
                                style={{
                                    padding: "10px",
                                    borderRadius: "8px",
                                    border: "none",
                                    backgroundColor: passwordLoading ? "#9CA3AF" : "#4F46E5",
                                    color: "white",
                                    cursor: passwordLoading ? "not-allowed" : "pointer",
                                    fontSize: "0.875rem",
                                    fontWeight: 600,
                                    marginTop: "4px",
                                }}
                                onMouseOver={(e) => { if (!passwordLoading) e.currentTarget.style.backgroundColor = "#4338CA"; }}
                                onMouseOut={(e) => { if (!passwordLoading) e.currentTarget.style.backgroundColor = "#4F46E5"; }}
                            >
                                {passwordLoading ? "Updating..." : "Update Password"}
                            </button>
                        </div>
                    </Card>
                    {/* Active Sessions */}
                    {/* Requires endpoints:
                        GET /auth/sessions — returns list of active sessions with device info and last active
                        DELETE /auth/sessions/{session_id} — revoke a specific session
                        DELETE /auth/sessions — revoke all sessions except current
                    */}
                    {/* <Card>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                            <Monitor size={18} color="#4F46E5" />
                            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Active Sessions</span>
                        </div>
                        <div style={{
                            padding: "20px",
                            backgroundColor: "#f9fafb",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                            textAlign: "center",
                        }}>
                            <Monitor size={32} color="#d1d5db" style={{ marginBottom: "8px" }} />
                            <p style={{ fontSize: "0.875rem", color: "#999", margin: "0 0 4px 0", fontWeight: 500 }}>
                                Coming soon
                            </p>
                            <p style={{ fontSize: "0.8rem", color: "#bbb", margin: 0 }}>
                                You'll be able to see and manage all devices logged into your account.
                            </p>
                        </div>
                    </Card> */}
                </div>
            </div>
        </div>
    );
}

// ── Small reusable components ─────────────────────────────────────────────────

function Card({ children }) {
    return (
        <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}>
            {children}
        </div>
    );
}

function SectionLabel({ children }) {
    return (
        <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "#999", letterSpacing: "0.5px" }}>
            {children}
        </label>
    );
}

function Divider() {
    return <div style={{ height: "1px", backgroundColor: "#f0f0f0", margin: "20px 0" }} />;
}

function Hint({ children }) {
    return (
        <span style={{ fontSize: "0.72rem", color: "#f59e0b", display: "block" }}>• {children}</span>
    );
}

function ActionButton({ children, onClick, primary = false, disabled = false }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: primary ? "none" : "1px solid #e0e0e0",
                backgroundColor: disabled ? "#9CA3AF" : primary ? "#4F46E5" : "white",
                color: primary ? "white" : "#333",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: "0.875rem",
                fontWeight: primary ? 600 : 400,
            }}
            onMouseOver={(e) => {
                if (!disabled) e.currentTarget.style.backgroundColor = primary ? "#4338CA" : "#f5f5f5";
            }}
            onMouseOut={(e) => {
                if (!disabled) e.currentTarget.style.backgroundColor = primary ? "#4F46E5" : "white";
            }}
        >
            {children}
        </button>
    );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }) {
    return (
        <div style={{ position: "relative", marginTop: "6px" }}>
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: "100%",
                    padding: "8px 40px 8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    outline: "none",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#4F46E5"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
            />
            <button
                onClick={onToggle}
                style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    color: "#999",
                    fontSize: "0.75rem",
                    padding: "0",
                }}
            >
                {show ? "Hide" : "Show"}
            </button>
        </div>
    );
}