import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from "../assets/logo.svg";
import { Upload, Folder, FileText, Settings, Search, MoreVertical, Home, Clock, Star, Trash2, Users, HardDrive, Download, Share2, AlertTriangle, LogOut, User } from 'lucide-react';
import { api } from '../api';
import { getToken, clearToken } from "../tokenStore";

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);
    const [files, setFiles] = useState([]);
    const [filesError, setFilesError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [storageStats, setStorageStats] = useState({ total_files: 0, total_mb: 0 });
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [showAccountMenu, setShowAccountMenu] = useState(false);
    const [showConsentPrompt, setShowConsentPrompt] = useState(false);
    const [reportSent, setReportSent] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            const token = getToken();
            if (!token) {
                navigate("/login");
                return;
            }
            try {
                const response = await fetch("http://localhost:8000/api/v1/auth/me", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUser(data);
                } else {
                    navigate("/login");
                }
            } catch (error) {
                console.error("Failed to fetch user data:", error);
            }
        };
        fetchUserData();
    }, [navigate]);

    useEffect(() => {
    function handleClickOutside(e) {
        if (!e.target.closest("[data-account-menu]")) {
            setShowAccountMenu(false);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        loadFiles();
        loadStorageStats();
    }, []);

    async function loadFiles() {
        try {
            setLoading(true);
            const data = await api.getFiles({ limit: 100, sort_by: 'created_at', sort_order: 'desc' });
            const formattedFiles = data.items.map(item => ({
                id: item.file_id,
                name: item.name,
                type: item.folder ? 'Folder' : getFileType(item.name),
                size: item.folder ? '—' : formatBytes(item.size_bytes),
                modified: formatDate(item.created_at),
                isFolder: !!item.folder
            }));
            setFiles(formattedFiles);
        } catch (error) {
            console.error('Failed to load files:', error);
            setFilesError(true);
        } finally {
            setLoading(false);
        }
    }

    async function loadStorageStats() {
        try {
            const stats = await api.getStorageStats();
            setStorageStats(stats);
        } catch (error) {
            console.error('Failed to load storage stats:', error);
        }
    }

    async function handleFileUpload(event) {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;
        try {
            setUploading(true);
            await api.uploadFile(selectedFile);
            await loadFiles();
            await loadStorageStats();
            alert('File uploaded successfully!');
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload file. Please try again.');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    }

    function getFileType(filename) {
        const ext = filename.split('.').pop().toUpperCase();
        return ext || 'FILE';
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    const sidebarItems = [
        { icon: Home, text: "My Drive", active: true },
        { icon: Users, text: "Shared with me", active: false },
        { icon: Clock, text: "Recent", active: false },
        { icon: Star, text: "Starred", active: false },
        { icon: Trash2, text: "Trash", active: false },
    ];

    const storagePercentage = (storageStats.total_mb / 10240) * 100;

    if (!user && loading) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                fontSize: "1.2rem",
                color: "#666"
            }}>
                Loading...
            </div>
        );
    }
    function handleReportIssue() {
    setShowConsentPrompt(true);
}

    function submitReport() {
        const diagnostics = {
            browser: navigator.userAgent,
            os: navigator.platform,
            screen: `${window.screen.width}x${window.screen.height}`,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            appVersion: "1.0.0"
        };

            const body = `
        ## Bug Report

        **URL**
        ${diagnostics.url}

        **Time**
        ${diagnostics.timestamp}

        **Browser**
        ${diagnostics.browser}

        **OS**
        ${diagnostics.os}

        **Screen**
        ${diagnostics.screen}

        **App Version**
        ${diagnostics.appVersion}

        **Description**
        _Please describe what you were doing when the error occurred._
        `.trim();

        const githubUrl = `https://github.com/Ayman-Abdulgalil/cloud-storage/issues/new?title=Bug+Report&body=${encodeURIComponent(body)}&labels=bug`;

        setShowConsentPrompt(false);
        setReportSent(true);
        window.open(githubUrl, "_blank");
    }
    return (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", height: "100vh", backgroundColor: "#c9c6c6", fontFamily: "system-ui, -apple-system, sans-serif" }}>

            {/* Sidebar */}
            <div style={{
                width: "260px",
                backgroundColor: "#c9c6c6",
                borderRight: "1px solid #e0e0e0",
                display: "flex",
                flexDirection: "column",
                padding: "16px"
            }}>
                <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src={Logo} alt="Secure Drive logo" style={{ width: "42px", height: "42px" }} />
                    <span style={{ fontSize: "1.5rem", fontWeight: 700 }}>Secure Drive</span>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />

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
                        width: "100%"
                    }}
                    onMouseOver={(e) => { if (!uploading) e.target.style.backgroundColor = "#4338CA"; }}
                    onMouseOut={(e) => { if (!uploading) e.target.style.backgroundColor = "#4F46E5"; }}
                >
                    <Upload size={20} />
                    {uploading ? 'Uploading...' : 'Upload'}
                </button>

                <div style={{ flexGrow: 1 }}>
                    {sidebarItems.map((item, index) => (
                        <div
                            key={index}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "12px 16px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                marginBottom: "4px",
                                border: item.active ? "1px solid #e0e0e0" : "1px solid transparent",
                                backgroundColor: item.active ? "#e0e0e0" : "transparent",
                                color: item.active ? "#4F46E5" : "#666"
                            }}
                            onMouseOver={(e) => { if (!item.active) e.currentTarget.style.backgroundColor = "#f5f5f5"; e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.color = "#4F46E5"; e.currentTarget.querySelector("svg").style.stroke = "#4F46E5"; }}
                            onMouseOut={(e) => { if (!item.active) e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = item.active ? "#4F46E5" : "#666"; e.currentTarget.querySelector("svg").style.stroke = item.active ? "#4F46E5" : "#666"; }}
                        >
                            <item.icon size={20} />
                            <span style={{ fontSize: "0.95rem", fontWeight: item.active ? 600 : 400 }}>
                                {item.text}
                            </span>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: "auto", padding: "16px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
                        <HardDrive size={16} color="#666" />
                        <span style={{ fontSize: "0.875rem", color: "#666" }}>Storage</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", backgroundColor: "#c9c6c6", borderRadius: "4px", marginBottom: "8px" }}>
                        <div style={{ width: `${Math.min(storagePercentage, 100)}%`, height: "100%", backgroundColor: "#4F46E5", borderRadius: "4px" }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "#999" }}>
                        {storageStats.total_mb.toFixed(2)} MB of 10 GB used
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>

                {/* Top Bar */}
                <div style={{
                    backgroundColor: "#c9c6c6",
                    borderBottom: "1px solid #e0e0e0",
                    padding: "16px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                }}>
                    <div style={{
                        backgroundColor: "#f5f5f5",
                        borderRadius: "24px",
                        padding: "10px 20px",
                        display: "flex",
                        alignItems: "center",
                        width: "500px",
                        gap: "12px"
                    }}>
                        <Search size={20} color="#999" />
                        <input
                            type="text"
                            placeholder="Search in Drive"
                            style={{ border: "none", backgroundColor: "transparent", outline: "none", width: "100%", fontSize: "0.95rem" }}
                        />
                    </div>

                        {/* Account Circle + Dropdown */}
                        <div style={{ position: "relative" }}>
                            <div
                                onClick={() => setShowAccountMenu(!showAccountMenu)}
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
                                    cursor: "pointer"
                                }}
                            >
                                <div style={{ position: "relative" }} data-account-menu></div>
                                {user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>

                            {showAccountMenu && (
                                <div style={{
                                    position: "absolute",
                                    right: 0,
                                    top: "44px",
                                    backgroundColor: "#c9c6c6",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                                    borderRadius: "12px",
                                    padding: "8px",
                                    minWidth: "260px",
                                    zIndex: 100,
                                    border: "1px solid #e0e0e0"
                                }}>
                                    {/* User Card */}
                                    <div style={{
                                        padding: "20px",
                                        marginBottom: "4px",
                                        borderRadius: "10px",
                                        backgroundColor: "#EEF2FF",
                                        boxShadow: "0 2px 8px rgba(79,70,229,0.15)",
                                        transition: "box-shadow 0.2s"
                                    }}
                                        onMouseOver={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(79,70,229,0.25)"}
                                        onMouseOut={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(79,70,229,0.15)"}
                                    >
                                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1a1a2e", marginBottom: "4px" }}>
                                            {user?.name}
                                        </div>
                                        <div style={{ fontSize: "0.8rem", color: "#6366f1" }}>
                                            {user?.email}
                                        </div>
                                    </div>

                                    <div style={{ height: "8px" }} />

                                    {/* Profile */}
                                    <div
                                        onClick={() => navigate("/profile")}
                                        style={{ padding: "12px", cursor: "pointer", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "12px", borderRadius: "8px", color: "#444" }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = "#f5f5f5";
                                            e.currentTarget.style.color = "#4F46E5";
                                            e.currentTarget.querySelector("svg").style.stroke = "#4F46E5";
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = "transparent";
                                            e.currentTarget.style.color = "#444";
                                            e.currentTarget.querySelector("svg").style.stroke = "#555";
                                        }}
                                    >
                                        <User size={17} color="#555" /> Profile
                                    </div>

                                    {/* Settings */}
                                    <div
                                        onClick={() => navigate("/settings")}
                                        style={{ padding: "12px", cursor: "pointer", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "12px", borderRadius: "8px", color: "#444" }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = "#f5f5f5";
                                            e.currentTarget.style.color = "#4F46E5";
                                            e.currentTarget.querySelector("svg").style.stroke = "#4F46E5";
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = "transparent";
                                            e.currentTarget.style.color = "#444";
                                            e.currentTarget.querySelector("svg").style.stroke = "#555";
                                        }}
                                    >
                                        <Settings size={17} color="#555" /> Settings
                                    </div>

                                    <div style={{ height: "1px", backgroundColor: "#f0f0f0", margin: "6px 0" }} />

                                    {/* Logout */}
                                    <div
                                        onClick={async () => {
                                            try {
                                                await fetch("http://localhost:8000/api/v1/auth/logout", {
                                                    method: "POST",
                                                    headers: { Authorization: `Bearer ${getToken()}` }
                                                });
                                            } catch (e) {}
                                            clearToken();
                                            navigate("/login");
                                        }}
                                        style={{ padding: "12px", cursor: "pointer", fontSize: "0.875rem", color: "#dc2626", display: "flex", alignItems: "center", gap: "12px", borderRadius: "8px" }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = "#fee2e2";
                                            e.currentTarget.style.color = "#991b1b";
                                            e.currentTarget.style.fontWeight = "600";
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = "transparent";
                                            e.currentTarget.style.color = "#dc2626";
                                            e.currentTarget.style.fontWeight = "normal";
                                        }}
                                    >
                                        <LogOut size={17} /> Logout
                                    </div>
                                </div>
                            )}
                        </div>
                </div>

                {/* Page Content */}
                <div style={{ flexGrow: 1, overflow: "auto", padding: "32px" }}>
                    <div style={{ marginBottom: "32px" }}>
                        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 8px 0" }}>
                            Welcome back, {user?.name || "User"}!
                        </h1>
                        <p style={{ fontSize: "0.95rem", color: "#666", margin: "0 0 16px 0" }}>
                            {user?.email}
                        </p>
                        <div style={{
                            padding: "16px",
                            backgroundColor: "#c9c6c6",
                            borderRadius: "8px",
                            border: "1px solid #e0e0e0",
                            display: "flex",
                            alignItems: "center",
                            gap: "16px"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <FileText size={18} color="#1e40af" />
                                <span style={{ fontSize: "0.875rem", color: "#1e40af", fontWeight: 500 }}>
                                    {files.length} files
                                </span>
                            </div>
                            <div style={{ width: "1px", height: "16px", backgroundColor: "#e0e0e0" }} />
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <HardDrive size={18} color="#1e40af" />
                                <span style={{ fontSize: "0.875rem", color: "#1e40af", fontWeight: 500 }}>
                                    {storageStats.total_mb.toFixed(2)} MB of 10 GB used
                                </span>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                            Loading files...
                        </div>
                        ) : filesError ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                            <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: "8px" }} />
                            <p style={{ fontWeight: 600, fontSize: "1rem", color: "#333", margin: "0 0 8px 0" }}>Something went wrong</p>
                            <p style={{ fontSize: "0.875rem", margin: "0 0 20px 0" }}>We couldn't load your files. Please try again.</p>
                            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                                <button
                                    onClick={() => { setFilesError(false); loadFiles(); }}
                                    style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid #c9c6c6", cursor: "pointer", backgroundColor: "#e0e0e0", fontSize: "0.875rem" }}
                                >
                                    Retry
                                </button>
                                <button
                                    onClick={handleReportIssue}
                                    style={{ padding: "8px 20px", borderRadius: "8px", border: "none", cursor: "pointer", backgroundColor: "#4F46E5", color: "white", fontSize: "0.875rem", fontWeight: 600 }}
                                >
                                    Report this issue
                                </button>
                            </div>

                            {/* Consent Prompt */}
                            {showConsentPrompt && (
                                <div style={{
                                    position: "fixed",
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: "rgba(0,0,0,0.4)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 200
                                }}>
                                    <div style={{
                                        backgroundColor: "#e0e0e0",
                                        borderRadius: "12px",
                                        padding: "32px",
                                        maxWidth: "420px",
                                        width: "90%",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
                                    }}>
                                        <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: "#1a1a2e" }}>Before we continue</h3>
                                        <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 20px 0", lineHeight: 1.6 }}>
                                            To help us fix this issue, we'd like to collect some basic diagnostic info — your browser, OS, screen size, the current URL, and a timestamp. No personal files or account data will be collected.
                                        </p>
                                        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                                            <button
                                                onClick={() => setShowConsentPrompt(false)}
                                                style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid #c9c6c6", cursor: "pointer", backgroundColor: "#e0e0e0", fontSize: "0.875rem" }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={submitReport}
                                                style={{ padding: "8px 20px", borderRadius: "8px", border: "none", cursor: "pointer", backgroundColor: "#4F46E5", color: "white", fontSize: "0.875rem", fontWeight: 600 }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#4338CA"}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#4F46E5"}
                                            >
                                                Yes, send report
                                            </button>
                                    </div>
                                    </div>
                                </div>
                            )}

                            {reportSent && (
                                <p style={{ marginTop: "16px", fontSize: "1.2rem", color: "#4F46E5" }}>
                                    Thanks! GitHub opened with a pre-filled report.
                                </p>
                            )}
                        </div> 
                    ) : files.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                            No files yet. Upload your first file!
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: "32px" }}>
                                <h2 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999", margin: "0 0 16px 0", letterSpacing: "0.5px" }}>
                                    QUICK ACCESS
                                </h2>
                                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                                    {files.slice(0, 3).map((file) => (
                                        <div
                                            key={file.id}
                                            style={{
                                                padding: "16px",
                                                width: "200px",
                                                backgroundColor: "white",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                                transition: "box-shadow 0.2s"
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)"}
                                            onMouseOut={(e) => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)"}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                                                {file.isFolder ? <Folder size={24} color="#FFA726" /> : <FileText size={24} color="#666" />}
                                                <button style={{ marginLeft: "auto", border: "none", backgroundColor: "transparent", cursor: "pointer", padding: "4px" }}>
                                                    <MoreVertical size={16} color="#999" />
                                                </button>
                                            </div>
                                            <p style={{ fontSize: "0.875rem", fontWeight: 500, margin: "0 0 4px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {file.name}
                                            </p>
                                            <p style={{ fontSize: "0.75rem", color: "#999", margin: 0 }}>
                                                {file.modified}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h2 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999", margin: "0 0 16px 0", letterSpacing: "0.5px" }}>
                                    FILES
                                </h2>
                                <div style={{ backgroundColor: "white", borderRadius: "8px", overflow: "hidden" }}>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "2fr 1fr 1fr 100px",
                                        padding: "16px",
                                        backgroundColor: "#fafafa",
                                        borderBottom: "1px solid #e0e0e0"
                                    }}>
                                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999" }}>NAME</span>
                                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999" }}>TYPE</span>
                                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999" }}>MODIFIED</span>
                                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999" }}>SIZE</span>
                                    </div>
                                    {files.map((file, index) => (
                                        <div
                                            key={file.id}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "2fr 1fr 1fr 100px",
                                                padding: "16px",
                                                borderBottom: index < files.length - 1 ? "1px solid #f0f0f0" : "none",
                                                alignItems: "center",
                                                cursor: "pointer"
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#fafafa"}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                {file.isFolder ? <Folder size={20} color="#FFA726" /> : <FileText size={20} color="#666" />}
                                                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{file.name}</span>
                                            </div>
                                            <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.type}</span>
                                            <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.modified}</span>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.size}</span>
                                                <button
                                                    style={{ border: "none", backgroundColor: "transparent", cursor: "pointer", padding: "4px", position: "relative" }}
                                                    onClick={() => setActiveMenu(activeMenu === file.id ? null : file.id)}
                                                >
                                                    <MoreVertical size={16} color="#999" />
                                                    {activeMenu === file.id && (
                                                        <div style={{
                                                            position: "absolute",
                                                            right: 0,
                                                            top: "100%",
                                                            backgroundColor: "white",
                                                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                                            borderRadius: "8px",
                                                            padding: "8px 0",
                                                            minWidth: "160px",
                                                            zIndex: 10
                                                        }}>
                                                            <div style={{ padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "0.875rem" }}
                                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                                            >
                                                                <Download size={16} /> Download
                                                            </div>
                                                            <div style={{ padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "0.875rem" }}
                                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                                            >
                                                                <Share2 size={16} /> Share
                                                            </div>
                                                            <div style={{ padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "0.875rem" }}
                                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                                            >
                                                                <Star size={16} /> Add to Starred
                                                            </div>
                                                            <div style={{ height: "1px", backgroundColor: "#e0e0e0", margin: "4px 0" }} />
                                                            <div style={{ padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "0.875rem", color: "#dc2626" }}
                                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#fee2e2"}
                                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                                            >
                                                                <Trash2 size={16} /> Delete
                                                            </div>
                                                        </div>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}