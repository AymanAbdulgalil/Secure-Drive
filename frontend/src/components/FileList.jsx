import { useState, useEffect, useRef } from 'react';
import { FileText, MoreVertical, Download, Share2, Star, Trash2 } from 'lucide-react';
import { api } from '../api';
import { getToken } from '../tokenStore';
import { toast } from './Toast';

export default function FileList({ files, onDelete }) {
    const [activeMenu, setActiveMenu] = useState(null);
    const [downloading, setDownloading] = useState(null);
    const menuRef = useRef(null);

        useEffect(() => {
    function handleClickOutside(e) {
        if (menuRef.current && !menuRef.current.contains(e.target)) {
            setActiveMenu(null);
        }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function handleDownload(file) {
    setActiveMenu(null);
    setDownloading(file.id);
    try {
        const response = await fetch(api.getDownloadUrl(file.id), {
            headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        } catch {
        toast('Failed to download file.', 'error');
        } finally {
        setDownloading(null);
        }
    }

    async function handleDelete(file) {
        if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
        setActiveMenu(null);
        await onDelete(file.id);
    }

    return (
        <div>
        <h2 style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#999",
            margin: "0 0 16px 0",
            letterSpacing: "0.5px",
        }}>
            FILES
        </h2>
        <div style={{ backgroundColor: "white", borderRadius: "8px", overflow: "visible" }}>
            {/* Header row */}
            <div style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 100px",
            padding: "16px",
            backgroundColor: "#fafafa",
            borderBottom: "1px solid #e0e0e0",
            }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999" }}>NAME</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999" }}>TYPE</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999" }}>MODIFIED</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#999" }}>SIZE</span>
            </div>

            {/* File rows */}
            {files.map((file, index) => (
            <div
                key={file.id}
                style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 100px",
                padding: "16px",
                borderBottom: index < files.length - 1 ? "1px solid #f0f0f0" : "none",
                alignItems: "center",
                cursor: "pointer",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#fafafa"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <FileText size={20} color="#666" />
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{file.name}</span>
                </div>
                <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.type}</span>
                <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.modified}</span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.size}</span>

                {/* Actions menu */}
                <div style={{ position: "relative" }}>
                    <button
                    style={{ border: "none", backgroundColor: "transparent", cursor: "pointer", padding: "4px" }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === file.id ? null : file.id);
                    }}
                    >
                    <MoreVertical size={16} color="#999" />
                    </button>

                    {activeMenu === file.id && (
                    <div ref={menuRef} style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        backgroundColor: "white",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        borderRadius: "8px",
                        padding: "8px 0",
                        minWidth: "160px",
                        zIndex: 10,
                    }}>
                        <ActionItem icon={<Download size={16} />} label="Download" onClick={() => handleDownload(file)} />
                        <ActionItem icon={<Share2 size={16} />} label="Share" onClick={() => setActiveMenu(null)} />
                        <ActionItem icon={<Star size={16} />} label="Add to Starred" onClick={() => setActiveMenu(null)} />
                        <div style={{ height: "1px", backgroundColor: "#e0e0e0", margin: "4px 0" }} />
                        <ActionItem icon={<Trash2 size={16} />} label="Delete" danger onClick={() => handleDelete(file)} />
                    </div>
                    )}
                </div>
                </div>
            </div>
            ))}
        </div>
        </div>
    );
    }

    function ActionItem({ icon, label, onClick, danger = false }) {
    return (
        <div
        onClick={onClick}
        style={{
            padding: "8px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "0.875rem",
            color: danger ? "#dc2626" : "inherit",
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = danger ? "#fee2e2" : "#f5f5f5"}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
        {icon} {label}
        </div>
    );
}