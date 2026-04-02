import { FileText, MoreVertical } from 'lucide-react';

export default function FileGrid({ files }) {
    if (files.length === 0) return null;

    return (
        <div style={{ marginBottom: "32px" }}>
        <h2 style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#999",
            margin: "0 0 16px 0",
            letterSpacing: "0.5px",
        }}>
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
                transition: "box-shadow 0.2s",
                }}
                onMouseOver={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)"}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)"}
            >
                <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                <FileText size={24} color="#666" />
                <button style={{ marginLeft: "auto", border: "none", backgroundColor: "transparent", cursor: "pointer", padding: "4px" }}>
                    <MoreVertical size={16} color="#999" />
                </button>
                </div>
                <p style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                margin: "0 0 4px 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                }}>
                {file.name}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#999", margin: 0 }}>
                {file.modified}
                </p>
            </div>
            ))}
        </div>
        </div>
    );
}