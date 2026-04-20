import { getToken, clearToken, getRefreshToken, setToken } from "./tokenStore";

// Relative paths — Vite proxy handles routing to the right service
// /auth-api/* → auth service (port 8001)
// /api/*      → core service (port 8000)
const AUTH_BASE = '/auth-api/api/v1';
const CORE_BASE = '/api/v1';

let _isRefreshing = false;
let _failedQueue = [];

function processQueue(error, token = null) {
    _failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token);
    });
    _failedQueue = [];
}

function authHeaders(extraHeaders = {}) {
    const token = getToken();
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
    };
}

async function handleResponse(response, retryFn = null) {
    if (response.status === 401) {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
            clearToken();
            window.location.href = "/login";
            throw new Error("Your session has expired. Please log in again.");
        }

        if (_isRefreshing) {
            return new Promise((resolve, reject) => {
                _failedQueue.push({ resolve, reject });
            }).then((token) => {
                if (retryFn) return retryFn(token);
            });
        }

        _isRefreshing = true;

        try {
            const res = await fetch(`${AUTH_BASE}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (!res.ok) {
                clearToken();
                processQueue(new Error("Session expired"));
                window.location.href = "/login";
                throw new Error("Your session has expired. Please log in again.");
            }

            const data = await res.json();
            setToken(data.access_token);
            if (data.refresh_token) {
                const { setRefreshToken } = await import("./tokenStore");
                setRefreshToken(data.refresh_token);
            }
            processQueue(null, data.access_token);
            if (retryFn) return retryFn(data.access_token);

        } catch (err) {
            clearToken();
            processQueue(err);
            window.location.href = "/login";
            throw err;
        } finally {
            _isRefreshing = false;
        }
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const friendly = {
            403: "You don't have permission to do that.",
            404: "The requested resource was not found.",
            500: "Something went wrong on our end. Please try again.",
            502: "The server is temporarily unavailable. Please try again.",
            503: "The service is currently unavailable. Please try again.",
        };
        throw new Error(friendly[response.status] || err.detail || `An unexpected error occurred (${response.status}).`);
    }

    return response.json();
}

export const api = {
    // ── Auth ──────────────────────────────────────────────────────────────────

    async login(email, password) {
        const response = await fetch(`${AUTH_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        return handleResponse(response);
    },

    async register(name, email, password) {
        const response = await fetch(`${AUTH_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
        });
        return handleResponse(response);
    },

    async resendVerification(email) {
        const response = await fetch(
            `${AUTH_BASE}/auth/resend-verification?email=${encodeURIComponent(email)}`,
            { method: "POST" }
        );
        return handleResponse(response);
    },

    async forgotPassword(email) {
        const response = await fetch(
            `${AUTH_BASE}/auth/forgot-password?email=${encodeURIComponent(email)}`,
            { method: "POST" }
        );
        return handleResponse(response);
    },

    async validateResetToken(token) {
        const response = await fetch(`${AUTH_BASE}/auth/reset-password/${token}`);
        return handleResponse(response);
    },

    async resetPassword(email, newPassword) {
        const response = await fetch(`${AUTH_BASE}/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, new_password: newPassword }),
        });
        return handleResponse(response);
    },

    async getMe() {
        const response = await fetch(`${AUTH_BASE}/auth/me`, { headers: authHeaders() });
        return handleResponse(response, (token) =>
            fetch(`${AUTH_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        );
    },

    async updateName(name) {
        const response = await fetch(`${AUTH_BASE}/auth/me`, {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ name }),
        });
        return handleResponse(response);
    },

    async changePassword(currentPassword, newPassword) {
        const response = await fetch(`${AUTH_BASE}/auth/me/password`, {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
        return handleResponse(response);
    },

    async logout() {
        const response = await fetch(`${AUTH_BASE}/auth/logout`, {
            method: "POST",
            headers: authHeaders(),
        });
        if (response.status === 401 || response.ok) return;
        return handleResponse(response);
    },

    // ── Files ─────────────────────────────────────────────────────────────────

    async getFiles(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.folder !== undefined) queryParams.append('folder', params.folder);
        if (params.search) queryParams.append('search', params.search);
        if (params.sort_by) queryParams.append('sort_by', params.sort_by);
        if (params.sort_order) queryParams.append('sort_order', params.sort_order);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.offset) queryParams.append('offset', params.offset);

        const response = await fetch(`${CORE_BASE}/files?${queryParams}`, { headers: authHeaders() });
        return handleResponse(response, (token) =>
            fetch(`${CORE_BASE}/files?${queryParams}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        );
    },

    async getStorageStats() {
        const response = await fetch(`${CORE_BASE}/files/stats`, { headers: authHeaders() });
        return handleResponse(response, (token) =>
            fetch(`${CORE_BASE}/files/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        );
    },

    async uploadFile(file, folder = null, logicalName = null) {
        const formData = new FormData();
        formData.append('file', file);
        if (folder) formData.append('folder', folder);
        if (logicalName) formData.append('logical_name', logicalName);

        const response = await fetch(`${CORE_BASE}/files`, {
            method: 'POST',
            headers: authHeaders(),
            body: formData,
        });
        return handleResponse(response);
    },

    async deleteFile(fileId) {
        const response = await fetch(`${CORE_BASE}/files/${fileId}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        return handleResponse(response);
    },

    getDownloadUrl(fileId) {
        return `${CORE_BASE}/files/${fileId}`;
    },
};