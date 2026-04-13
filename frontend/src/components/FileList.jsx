import { useState, useEffect, useRef } from 'react';
import { FileText, MoreVertical, Download, Star, Trash2, Edit2, FolderInput, Copy, Info } from 'lucide-react';
import { api } from '../api';
import { getToken } from '../tokenStore';
import { toast } from './Toast';
import DeleteModal from './DeleteModal';

export default function FileList({ files, onDelete, onRename, onMove }) {
    const [activeMenu, setActiveMenu] = useState(null);
    const [hoveredFile, setHoveredFile] = useState(null);
    const [downloading, setDownloading] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [infoTarget, setInfoTarget] = useState(null);
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
            toast(`"${file.name}" downloaded.`, 'success');
        } catch {
            toast('Failed to download file.', 'error');
        } finally {
            setDownloading(null);
        }
    }

    function handleDelete(file) {
        setActiveMenu(null);
        setDeleteTarget(file);
    }

    function handleRenameStart(file) {
        setActiveMenu(null);
        setRenameTarget(file);
        setRenameValue(file.name);
    }

    async function handleRenameSubmit() {
        if (!renameValue.trim() || renameValue === renameTarget.name) {
            setRenameTarget(null);
            return;
        }
        try {
            await onRename(renameTarget.id, renameValue.trim());
            toast(`Renamed to "${renameValue.trim()}".`, 'success');
        } catch {
            toast('Failed to rename file.', 'error');
        } finally {
            setRenameTarget(null);
        }
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
                {/* Header */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    padding: "12px 16px",
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
                            gridTemplateColumns: "2fr 1fr 1fr 1fr",
                            padding: "10px 16px",
                            borderBottom: index < files.length - 1 ? "1px solid #f0f0f0" : "none",
                            alignItems: "center",
                            backgroundColor: hoveredFile === file.id ? "#f8f8ff" : "transparent",
                            transition: "background-color 0.1s",
                        }}
                        onMouseEnter={() => setHoveredFile(file.id)}
                        onMouseLeave={() => setHoveredFile(null)}
                    >
                        {/* Name */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <FileText size={20} color="#4F46E5" />
                            {renameTarget?.id === file.id ? (
                                <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={handleRenameSubmit}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleRenameSubmit();
                                        if (e.key === "Escape") setRenameTarget(null);
                                    }}
                                    style={{
                                        border: "1px solid #4F46E5",
                                        borderRadius: "4px",
                                        padding: "2px 8px",
                                        fontSize: "0.875rem",
                                        outline: "none",
                                        width: "80%",
                                    }}
                                />
                            ) : (
                                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{file.name}</span>
                            )}
                        </div>

                        <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.type}</span>
                        <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.modified}</span>

                        {/* Size + hover actions */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.875rem", color: "#666" }}>{file.size}</span>

                            {/* Hover action icons */}
                            {hoveredFile === file.id && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    {/* Star */}
                                    <IconButton
                                        icon={<Star size={16} />}
                                        title="Add to starred"
                                        onClick={() => toast('Starred — coming soon.', 'success')}
                                    />

                                    {/* Download */}
                                    <IconButton
                                        icon={<Download size={16} />}
                                        title="Download"
                                        onClick={() => handleDownload(file)}
                                        loading={downloading === file.id}
                                    />

                                    {/* Delete */}
                                    <IconButton
                                        icon={<Trash2 size={16} />}
                                        title="Delete"
                                        danger
                                        onClick={() => handleDelete(file)}
                                    />

                                    {/* Three dots */}
                                    <div style={{ position: "relative" }}>
                                        <IconButton
                                            icon={<MoreVertical size={16} />}
                                            title="More options"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenu(activeMenu === file.id ? null : file.id);
                                            }}
                                        />

                                        {activeMenu === file.id && (
                                            <div ref={menuRef} style={{
                                                position: "absolute",
                                                right: 0,
                                                top: "100%",
                                                backgroundColor: "white",
                                                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                                                borderRadius: "8px",
                                                padding: "6px 0",
                                                minWidth: "180px",
                                                zIndex: 50,
                                            }}>
                                                <ActionItem
                                                    icon={<Download size={15} />}
                                                    label={downloading === file.id ? "Downloading..." : "Download"}
                                                    onClick={() => handleDownload(file)}
                                                />

                                                <Divider />

                                                <ActionItem
                                                    icon={<Edit2 size={15} />}
                                                    label="Rename"
                                                    onClick={() => handleRenameStart(file)}
                                                />
                                                <ActionItem
                                                    icon={<FolderInput size={15} />}
                                                    label="Move to"
                                                    onClick={() => {
                                                        setActiveMenu(null);
                                                        onMove?.(file);
                                                    }}
                                                />
                                                <ActionItem
                                                    icon={<Copy size={15} />}
                                                    label="Copy"
                                                    onClick={() => {
                                                        setActiveMenu(null);
                                                        toast('Copy — coming soon.', 'success');
                                                    }}
                                                />

                                                <Divider />

                                                <ActionItem
                                                    icon={<Info size={15} />}
                                                    label="File info"
                                                    onClick={() => {
                                                        setActiveMenu(null);
                                                        setInfoTarget(file);
                                                    }}
                                                />

                                                <Divider />

                                                <ActionItem
                                                    icon={<Trash2 size={15} />}
                                                    label="Delete"
                                                    danger
                                                    onClick={() => handleDelete(file)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Delete modal */}
            {deleteTarget && (
                <DeleteModal
                    fileName={deleteTarget.name}
                    onConfirm={async () => {
                        try {
                            await onDelete(deleteTarget.id);
                            toast(`"${deleteTarget.name}" deleted.`, 'success');
                        } catch {
                            toast('Failed to delete file.', 'error');
                        } finally {
                            setDeleteTarget(null);
                        }
                    }}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            {/* File info modal */}
            {infoTarget && (
                <FileInfoModal file={infoTarget} onClose={() => setInfoTarget(null)} />
            )}
        </div>
    );
}

function IconButton({ icon, title, onClick, danger = false, loading = false }) {
    return (
        <button
            title={title}
            onClick={onClick}
            disabled={loading}
            style={{
                border: "none",
                backgroundColor: "transparent",
                cursor: loading ? "not-allowed" : "pointer",
                padding: "6px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                color: danger ? "#dc2626" : "#666",
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = danger ? "#fee2e2" : "#f0f0f0"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
            {icon}
        </button>
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
                color: danger ? "#dc2626" : "#333",
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = danger ? "#fee2e2" : "#f5f5f5"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
            {icon} {label}
        </div>
    );
}

function Divider() {
    return <div style={{ height: "1px", backgroundColor: "#f0f0f0", margin: "4px 0" }} />;
}

function FileInfoModal({ file, onClose }) {
    return (
        <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
        }}>
            <div style={{
                backgroundColor: "white",
                borderRadius: "12px",
                padding: "32px",
                maxWidth: "420px",
                width: "90%",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}>
                <h3 style={{ margin: "0 0 20px 0", fontSize: "1rem", color: "#1a1a2e" }}>
                    File Info
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <InfoRow label="Name" value={file.name} />
                    <InfoRow label="Type" value={file.type} />
                    <InfoRow label="Size" value={file.size} />
                    <InfoRow label="Modified" value={file.modified} />
                </div>
                <button
                    onClick={onClose}
                    style={{
                        marginTop: "24px",
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #e0e0e0",
                        cursor: "pointer",
                        backgroundColor: "white",
                        fontSize: "0.875rem",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
                >
                    Close
                </button>
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
            <span style={{ color: "#999", fontWeight: 500 }}>{label}</span>
            <span style={{ color: "#333" }}>{value}</span>
        </div>
    );
}