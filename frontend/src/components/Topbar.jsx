import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings, LogOut, User } from 'lucide-react';
import { clearToken } from '../tokenStore';
import { api } from '../api';

export default function TopBar({ user, onSearch }) {
    const navigate = useNavigate();
    const [showAccountMenu, setShowAccountMenu] = useState(false);

    useEffect(() => {
        function handleClickOutside(e) {
        if (!e.target.closest("[data-account-menu]")) {
            setShowAccountMenu(false);
        }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function handleLogout() {
        try {
        await api.logout();
        } catch (_) {}
        clearToken();
        navigate("/login");
    }

    return (
        <div style={{
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e8eaed",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        }}>
        {/* Search bar */}
        <div style={{
            backgroundColor: "#f0f2f5",
            borderRadius: "24px",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            width: "500px",
            gap: "12px",
        }}>
            <Search size={20} color="#999" />
            <input
            type="text"
            placeholder="Search in Drive"
            onChange={(e) => onSearch?.(e.target.value)}
            style={{
                border: "none",
                backgroundColor: "transparent",
                outline: "none",
                width: "100%",
                fontSize: "0.95rem",
            }}
            />
        </div>

        {/* Account menu — single wrapper with data-account-menu */}
        <div style={{ position: "relative" }} data-account-menu>
            <div
            onClick={() => setShowAccountMenu((prev) => !prev)}
            style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                userSelect: "none",
            }}
            >
            {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>

            {showAccountMenu && (
            <div style={{
                position: "absolute",
                right: 0,
                top: "44px",
                backgroundColor: "#ffffff",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                border: "1px solid #e8eaed",
                borderRadius: "12px",
                padding: "8px",
                minWidth: "260px",
                zIndex: 100,
                border: "1px solid #e0e0e0",
            }}>
                {/* User card */}
                <div style={{
                padding: "20px",
                marginBottom: "4px",
                borderRadius: "10px",
                backgroundColor: "#eef2ff",
                boxShadow: "0 2px 8px rgba(79,70,229,0.15)",
                }}>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a2e", marginBottom: "4px" }}>
                    {user?.name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6366f1" }}>
                    {user?.email}
                </div>
                </div>

                <div style={{ height: "8px" }} />

                {/* Profile */}
                <MenuItem icon={<User size={17} color="#555" />} label="Profile" onClick={() => navigate("/profile")} />

                {/* Settings */}
                <MenuItem icon={<Settings size={17} color="#555" />} label="Settings" onClick={() => navigate("/settings")} />

                <div style={{ height: "1px", backgroundColor: "#f0f0f0", margin: "6px 0" }} />

                {/* Logout */}
                <div
                onClick={handleLogout}
                style={{
                    padding: "12px",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    borderRadius: "8px",
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#fee2e2"; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                <LogOut size={17} /> Logout
                </div>
            </div>
            )}
        </div>
        </div>
    );
    }

    function MenuItem({ icon, label, onClick }) {
    return (
        <div
        onClick={onClick}
        style={{
            padding: "12px",
            cursor: "pointer",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            borderRadius: "8px",
            color: "#444",
        }}
        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#f5f5f5"; e.currentTarget.style.color = "#4F46E5"; }}
        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#444"; }}
        >
        {icon} {label}
        </div>
    );
}