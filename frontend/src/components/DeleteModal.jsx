export default function DeleteModal({ fileName, onConfirm, onCancel }) {
    return (
        <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
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
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", color: "#1a1a2e" }}>
                    Delete file
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#666", margin: "0 0 20px 0", lineHeight: 1.6 }}>
                    Are you sure you want to delete <strong>"{fileName}"</strong>? This cannot be undone.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: "8px 20px",
                            borderRadius: "8px",
                            border: "1px solid #e0e0e0",
                            cursor: "pointer",
                            backgroundColor: "white",
                            fontSize: "0.875rem",
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "white"}
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
                            backgroundColor: "#dc2626",
                            color: "white",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#b91c1c"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#dc2626"}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}