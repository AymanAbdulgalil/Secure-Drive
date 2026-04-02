import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from "../assets/logo.svg";
import { Upload, Home, Clock, Star, Trash2, Users, HardDrive } from 'lucide-react';

const sidebarItems = [
    { icon: Home,   text: "My Drive",       path: "/dashboard" },
    { icon: Users,  text: "Shared with me", path: null },
    { icon: Clock,  text: "Recent",         path: null },
    { icon: Star,   text: "Starred",        path: null },
    { icon: Trash2, text: "Trash",          path: null },
];

export default function Sidebar({ storageStats, uploading, onUpload }) {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const storagePercentage = storageStats.total_mb
        ? Math.min((storageStats.total_mb / 10240) * 100, 100)
        : 0;

    return (
        <div style={{
        width: "260px",
        backgroundColor: "#c9c6c6",
        borderRight: "1px solid #e0e0e0",
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        flexShrink: 0,
        }}>
        {/* Logo */}
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={Logo} alt="Secure Drive logo" style={{ width: "42px", height: "42px" }} />
            <span style={{ fontSize: "1.5rem", fontWeight: 700 }}>Secure Drive</span>
        </div>
    
        {/* Hidden file input */}
        <input type="file" ref={fileInputRef} onChange={onUpload} multiple style={{ display: 'none' }} />
    
        {/* Upload button */}
        <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
            backgroundColor: uploading ? "#9CA3AF" : "#4F46E5",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: uploading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "16px",
            width: "100%",
            }}
            onMouseOver={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = "#4338CA"; }}
            onMouseOut={(e) => { if (!uploading) e.currentTarget.style.backgroundColor = "#4F46E5"; }}
        >
            <Upload size={20} />
            {uploading ? 'Uploading...' : 'Upload'}
        </button>
    
        {/* Nav items */}
        <div style={{ flexGrow: 1 }}>
            {sidebarItems.map((item, index) => {
            const active = item.path === window.location.pathname;
            return (
                <div
                key={index}
                onClick={() => item.path && navigate(item.path)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    cursor: item.path ? "pointer" : "default",
                    marginBottom: "4px",
                    border: active ? "1px solid #e0e0e0" : "1px solid transparent",
                    backgroundColor: active ? "#e0e0e0" : "transparent",
                    color: active ? "#4F46E5" : "#666",
                }}
                onMouseOver={(e) => {
                    if (!active && item.path) {
                    e.currentTarget.style.backgroundColor = "#f5f5f5";
                    e.currentTarget.style.color = "#4F46E5";
                    }
                }}
                onMouseOut={(e) => {
                    if (!active) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#666";
                    }
                }}
                >
                <item.icon size={20} />
                <span style={{ fontSize: "0.95rem", fontWeight: active ? 600 : 400 }}>
                    {item.text}
                </span>
                </div>
            );
            })}
        </div>
    
        {/* Storage indicator */}
        <div style={{ padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
            <HardDrive size={16} color="#666" />
            <span style={{ fontSize: "0.875rem", color: "#666" }}>Storage</span>
            </div>
            <div style={{ width: "100%", height: "6px", backgroundColor: "#c9c6c6", borderRadius: "4px", marginBottom: "8px" }}>
            <div style={{
                width: `${storagePercentage}%`,
                height: "100%",
                backgroundColor: storagePercentage > 90 ? "#dc2626" : "#4F46E5",
                borderRadius: "4px",
                transition: "width 0.3s ease",
            }} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "#999" }}>
            {storageStats.total_mb.toFixed(2)} MB of 10 GB used
            </span>
        </div>
        </div>
    );
}