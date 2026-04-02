import { getToken, clearToken } from "./tokenStore";

const API_BASE_URL = '/api/v1';

function authHeaders(extraHeaders = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

async function handleResponse(response) {
  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Your session has expired. Please log in again.");
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
  async getMe() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
    return handleResponse(response);
  },

  async logout() {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: authHeaders(),
    });
    return handleResponse(response);
  },

  async getFiles(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.folder !== undefined) queryParams.append('folder', params.folder);
    if (params.search) queryParams.append('search', params.search);
    if (params.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params.sort_order) queryParams.append('sort_order', params.sort_order);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    const response = await fetch(`${API_BASE_URL}/files?${queryParams}`, { headers: authHeaders() });
    return handleResponse(response);
  },

  async getStorageStats() {
    const response = await fetch(`${API_BASE_URL}/files/stats`, { headers: authHeaders() });
    return handleResponse(response);
  },

  async uploadFile(file, folder = null, logicalName = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    if (logicalName) formData.append('logical_name', logicalName);

    const response = await fetch(`${API_BASE_URL}/files`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return handleResponse(response);
  },

  async deleteFile(fileId) {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse(response);
  },

  getDownloadUrl(fileId) {
    return `${API_BASE_URL}/files/${fileId}`;
  },
};