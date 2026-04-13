let _accessToken = null;
let _refreshToken = null;

export function setToken(token) {
    _accessToken = token;
}

export function getToken() {
    return _accessToken;
}

export function clearToken() {
    _accessToken = null;
    _refreshToken = null;
}

export function setRefreshToken(token) {
    _refreshToken = token;
}

export function getRefreshToken() {
    return _refreshToken;
}