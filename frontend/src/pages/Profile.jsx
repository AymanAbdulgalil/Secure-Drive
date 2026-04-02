import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from "../assets/logo.svg";
import { Camera, ArrowLeft } from 'lucide-react';
import { getToken } from "../tokenStore";

export default function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [editing, setEditing] = useState(false);
    const [newName, setNewName] = useState("");
    const avatarInputRef = useRef(null);

    useEffect(() => {
        const fetchUser = async () => {
            const token = getToken();
            if (!token) { navigate("/login"); return; }
            try {
                const response = await fetch("/api/v1/auth/me", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUser(data);
                    setNewName(data.name);
                } else {
                    navigate("/login");
                }
            } catch (error) {
                console.error("Failed to fetch user:", error);
            }
        };
        fetchUser();
    }, [navigate]);

    if (!user) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: "1.2rem", color: "#666" }}>
                Loading...
            </div>
        );
    }

    return (
        <>
            <input
                type="file"
                accept="image/*"
                ref={avatarInputRef}
                onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append("avatar", file);
                    try {
                        const token = getToken();
                        const response = await fetch("/api/v1/auth/me/avatar", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${token}` },
                            body: formData
                        });
                        if (response.ok) {
                            const data = await response.json();
                            setUser(data);
                        } else {
                            alert("Failed to upload photo.");
                        }
                    } catch (error) {
                        alert("Something went wrong.");
                    }
                    e.target.value = '';
                }}
                style={{ display: "none" }}
            />

            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#c9c6c6", fontFamily: "system-ui, -apple-system, sans-serif" }}>

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

                {/* Profile Content */}
                <div style={{ flexGrow: 1, overflow: "auto", padding: "40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: "100%", maxWidth: "600px" }}>
                        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 32px 0" }}>Profile</h1>

                        {/* Avatar */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px" }}>
                            <div style={{ position: "relative", marginBottom: "12px" }}>
                                <div style={{
                                    width: "100px",
                                    height: "100px",
                                    borderRadius: "50%",
                                    backgroundColor: "#4F46E5",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "2.5rem",
                                    fontWeight: 700,
                                    color: "white"
                                }}>
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <button
                                    onClick={() => avatarInputRef.current?.click()}
                                    style={{
                                        position: "absolute",
                                        bottom: 0,
                                        right: 0,
                                        width: "32px",
                                        height: "32px",
                                        borderRadius: "50%",
                                        backgroundColor: "white",
                                        border: "2px solid #e0e0e0",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.borderColor = "#4F46E5"}
                                    onMouseOut={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
                                >
                                    <Camera size={14} color="#666" />
                                </button>
                            </div>
                            <span style={{ fontSize: "0.8rem", color: "#999" }}>Click the camera to update your photo</span>
                        </div>

                        {/* Info Card */}
                        <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "16px" }}>
                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999", letterSpacing: "0.5px" }}>DISPLAY NAME</label>
                                {editing ? (
                                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                        <input
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            style={{ flexGrow: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #4F46E5", outline: "none", fontSize: "0.95rem" }}
                                        />
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const token = getToken();
                                                    const response = await fetch("/api/v1/auth/me", {
                                                        method: "PATCH",
                                                        headers: {
                                                            "Authorization": `Bearer ${token}`,
                                                            "Content-Type": "application/json"
                                                        },
                                                        body: JSON.stringify({ name: newName })
                                                    });
                                                    if (response.ok) {
                                                        const data = await response.json();
                                                        setUser(data);
                                                        setEditing(false);
                                                    } else {
                                                        alert("Failed to update name. Please try again.");
                                                    }
                                                } catch (error) {
                                                    alert("Something went wrong. Please try again.");
                                                }
                                            }}
                                            style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#4F46E5", color: "white", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#4338CA"}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#4F46E5"}
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => { setEditing(false); setNewName(user.name); }}
                                            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e0e0e0", backgroundColor: "white", cursor: "pointer", fontSize: "0.875rem" }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                                        <span style={{ fontSize: "0.95rem", color: "#1a1a2e", fontWeight: 500 }}>{user?.name}</span>
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
                            </div>

                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999", letterSpacing: "0.5px" }}>EMAIL</label>
                                <div style={{ marginTop: "8px" }}>
                                    <span style={{ fontSize: "0.95rem", color: "#1a1a2e", fontWeight: 500 }}>{user?.email}</span>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999", letterSpacing: "0.5px" }}>MEMBER SINCE</label>
                                <div style={{ marginTop: "8px" }}>
                                    <span style={{ fontSize: "0.95rem", color: "#1a1a2e", fontWeight: 500 }}>
                                        {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #fee2e2" }}>
                            <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#dc2626", margin: "0 0 8px 0" }}>Danger Zone</h3>
                            <p style={{ fontSize: "0.8rem", color: "#999", margin: "0 0 16px 0" }}>Once you delete your account, there is no going back.</p>
                            <button
                                onClick={async () => {
                                    if (!window.confirm("Are you sure? This cannot be undone.")) return;
                                    try {
                                        const token = getToken();
                                        const response = await fetch("/api/v1/auth/me", {
                                            method: "DELETE",
                                            headers: { "Authorization": `Bearer ${token}` }
                                        });
                                        if (response.ok) {
                                            navigate("/login");
                                        } else {
                                            alert("Failed to delete account. Please try again.");
                                        }
                                    } catch (error) {
                                        alert("Something went wrong. Please try again.");
                                    }
                                }}
                                style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid #dc2626", backgroundColor: "white", color: "#dc2626", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#fee2e2"}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
                            >
                                Delete Account
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}