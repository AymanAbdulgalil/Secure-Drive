import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

let _addToast = null;

export function toast(message, type = 'success') {
    if (_addToast) _addToast(message, type);
    }

    export default function ToastContainer() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        _addToast = (message, type) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
        };
        return () => { _addToast = null; };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", display: "flex", flexDirection: "column", gap: "10px", zIndex: 999 }}>
        {toasts.map((t) => (
            <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "14px 18px", borderRadius: "10px",
            backgroundColor: t.type === 'success' ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${t.type === 'success' ? "#86efac" : "#fca5a5"}`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: "260px",
            }}>
            {t.type === 'success'
                ? <CheckCircle size={18} color="#16a34a" />
                : <XCircle size={18} color="#dc2626" />}
            <span style={{ fontSize: "0.875rem", color: t.type === 'success' ? "#15803d" : "#dc2626", fontWeight: 500, flexGrow: 1 }}>
                {t.message}
            </span>
            <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
                style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={14} color="#999" />
            </button>
            </div>
        ))}
        </div>
    );
}