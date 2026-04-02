export default function ConsentModal({ onConfirm, onCancel }) {
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
            backgroundColor: "#e0e0e0",
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "420px",
            width: "90%",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", color: "#1a1a2e" }}>
            Before we continue
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 20px 0", lineHeight: 1.6 }}>
            To help us fix this issue, we'd like to collect some basic diagnostic info —
            your browser, OS, screen size, the current URL, and a timestamp.
            No personal files or account data will be collected.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
                onClick={onCancel}
                style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "1px solid #c9c6c6",
                cursor: "pointer",
                backgroundColor: "#e0e0e0",
                fontSize: "0.875rem",
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#e0e0e0"}
            >
                Cancel
            </button>
            <button
                onClick={onConfirm}
                style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                backgroundColor: "#4F46E5",
                color: "white",
                fontSize: "0.875rem",
                fontWeight: 600,
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#4338CA"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#4F46E5"}
            >
                Yes, send report
            </button>
            </div>
        </div>
        </div>
    );
}