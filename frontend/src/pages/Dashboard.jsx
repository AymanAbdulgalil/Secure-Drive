import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, HardDrive, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { getToken } from "../tokenStore";
import Sidebar from '../components/Sidebar';
import TopBar from '../components/Topbar';
import FileGrid from '../components/FileGrid';
import FileList from '../components/FileList';
import ConsentModal from '../components/ConsentModal';
import ToastContainer, { toast } from '../components/Toast';

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [files, setFiles] = useState([]);
    const [filesError, setFilesError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [storageStats, setStorageStats] = useState({ total_files: 0, total_mb: 0 });
    const [uploading, setUploading] = useState(false);
    const [showConsentPrompt, setShowConsentPrompt] = useState(false);
    const [reportSent, setReportSent] = useState(false);

    // Fetch current user
    useEffect(() => {
        const token = getToken();
        if (!token) { navigate("/login"); return; }

        api.getMe()
        .then(setUser)
        .catch(() => navigate("/login"));
    }, [navigate]);

    // Fetch files and stats
    useEffect(() => {
        loadFiles();
        loadStorageStats();
    }, []);

    async function loadFiles() {
        try {
        setLoading(true);
        setFilesError(false);
        const data = await api.getFiles({ limit: 100, sort_by: 'created_at', sort_order: 'desc' });
        const formatted = data.items.map(item => ({
            id: item.file_id,
            name: item.current_name,           // fixed: was item.name (doesn't exist)
            type: getFileType(item.current_name),
            size: formatBytes(item.size_bytes),
            modified: formatDate(item.created_at),
        }));
        setFiles(formatted);
        } catch {
        setFilesError(true);
        } finally {
        setLoading(false);
        }
    }

    async function loadStorageStats() {
        try {
        const stats = await api.getStorageStats();
        setStorageStats(stats);
        } catch {
        // non-critical, silently fail
        }
    }

    async function handleFileUpload(event) {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    for (const file of selectedFiles) {
        try {
            await api.uploadFile(file);
            successCount++;
        } catch {
            failCount++;
        }
        }
        await loadFiles();
        await loadStorageStats();
        setUploading(false);
        event.target.value = '';
        if (failCount === 0) {
        toast(successCount === 1 ? `"${selectedFiles[0].name}" uploaded.` : `${successCount} files uploaded.`, 'success');
        } else if (successCount === 0) {
        toast(`Failed to upload ${failCount} file(s).`, 'error');
        } else {
        toast(`${successCount} uploaded, ${failCount} failed.`, 'error');
        }
    }

        async function handleDeleteFile(fileId) {
        await api.deleteFile(fileId);
        await loadFiles();
        await loadStorageStats();
    }

    async function handleRenameFile(fileId, newName) {
        const formData = new FormData();
        formData.append('name', newName);
        const response = await fetch(`/api/v1/files/${fileId}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
        });
        if (!response.ok) throw new Error();
        await loadFiles();
    }

function handleMoveFile(file) {
    toast('Move to — coming soon.', 'success');
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
        appVersion: "1.0.0",
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    function getFileType(filename) {
        const ext = filename?.split('.').pop().toUpperCase();
        return ext || 'FILE';
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
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

    // ── Render ────────────────────────────────────────────────────────────────

    if (!user && loading) {
        return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: "1.2rem", color: "#666" }}>
            Loading...
        </div>
        );
    }

    return (
        <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        display: "flex", height: "100vh",
        backgroundColor: "#c9c6c6",
        fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
        <ToastContainer />
        <Sidebar
            storageStats={storageStats}
            uploading={uploading}
            onUpload={handleFileUpload}
        />

        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <TopBar user={user} />

            {/* Page content */}
            <div style={{ flexGrow: 1, overflow: "auto", padding: "32px" }}>

            {/* Welcome header */}
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
                gap: "16px",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={18} color="#1e40af" />
                    <span style={{ fontSize: "0.875rem", color: "#1e40af", fontWeight: 500 }}>
                    {storageStats.total_files} files
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

            {/* Body */}
            {loading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                Loading files...
                </div>
            ) : filesError ? (
                <ErrorState
                onRetry={() => loadFiles()}
                onReport={handleReportIssue}
                showConsent={showConsentPrompt}
                onConsentConfirm={submitReport}
                onConsentCancel={() => setShowConsentPrompt(false)}
                reportSent={reportSent}
                />
            ) : files.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                No files yet. Upload your first file!
                </div>
            ) : (
                <>
                <FileGrid files={files} />
                <FileList files={files} onDelete={handleDeleteFile} onRename={handleRenameFile} onMove={handleMoveFile}/>
                </>
            )}
            </div>
        </div>
        </div>
    );
    }

    // ── Error state ─────────────────────────────────────────────────────────────

    function ErrorState({ onRetry, onReport, showConsent, onConsentConfirm, onConsentCancel, reportSent }) {
    return (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
        <AlertTriangle size={32} color="#f59e0b" style={{ marginBottom: "8px" }} />
        <p style={{ fontWeight: 600, fontSize: "1rem", color: "#333", margin: "0 0 8px 0" }}>
            Something went wrong
        </p>
        <p style={{ fontSize: "0.875rem", margin: "0 0 20px 0" }}>
            We couldn't load your files. Please try again.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
            onClick={onRetry}
            style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid #c9c6c6", cursor: "pointer", backgroundColor: "#e0e0e0", fontSize: "0.875rem" }}
            >
            Retry
            </button>
            <button
            onClick={onReport}
            style={{ padding: "8px 20px", borderRadius: "8px", border: "none", cursor: "pointer", backgroundColor: "#4F46E5", color: "white", fontSize: "0.875rem", fontWeight: 600 }}
            >
            Report this issue
            </button>
        </div>

        {showConsent && <ConsentModal onConfirm={onConsentConfirm} onCancel={onConsentCancel} />}

        {reportSent && (
            <p style={{ marginTop: "16px", fontSize: "1.2rem", color: "#4F46E5" }}>
            Thanks! GitHub opened with a pre-filled report.
            </p>
        )}
        </div>
    );
}