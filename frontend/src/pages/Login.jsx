import { useState } from "react";
import { Box, Card, TextField, Button, Typography, Alert, InputAdornment, IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../assets/logo.svg";
import { setToken, setRefreshToken } from "../tokenStore";
import { api } from "../api";

function Login() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [searchParams] = useSearchParams();
    const justVerified = searchParams.get("verified") === "true";

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async () => {
        setError("");

        if (!formData.email || !formData.password) {
            setError("Please enter both email and password");
            return;
        }
        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (formData.password.length > 128) {
            setError("Password is too long.");
            return;
        }

        setLoading(true);
        try {
            const data = await api.login(formData.email, formData.password);
            setToken(data.access_token);
            setRefreshToken(data.refresh_token);
            navigate("/dashboard");
        } catch (err) {
            setError(err.message || "Login failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") handleLogin();
    };

    return (
        <Card sx={{ width: 380, padding: 7, borderRadius: 3, backgroundColor: "#ffffff", boxShadow: "0px 10px 40px rgba(0,0,0,0.3)", textAlign: "center" }}>
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <img src={Logo} alt="Secure Drive logo" style={{ width: 150, height: 150, marginBottom: 6 }} />
                <Typography variant="h3" fontWeight={700} lineHeight={1.1} sx={{ whiteSpace: "nowrap", fontSize: "1.8rem" }}>
                    Secure Drive
                </Typography>
            </Box>
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <Typography variant="h3" fontWeight={700} lineHeight={1.1} sx={{ whiteSpace: "nowrap", fontSize: "1.3rem" }}>
                    Login
                </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {justVerified && <Alert severity="success" sx={{ mb: 2 }}>Email verified successfully! You can now log in.</Alert>}

            <Box mb={2} textAlign="left">
                <Typography variant="body2" mb={0.5}>Email</Typography>
                <TextField fullWidth size="small" placeholder="Enter your email" name="email" type="email"
                    value={formData.email} onChange={handleChange} onKeyPress={handleKeyPress} />
            </Box>

            <Box mb={2} textAlign="left">
                <Typography variant="body2" mb={0.5}>Password</Typography>
                <TextField fullWidth size="small" type={showPassword ? "text" : "password"}
                    placeholder="Enter your password" name="password"
                    value={formData.password} onChange={handleChange} onKeyPress={handleKeyPress}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                />
            </Box>

            <Typography variant="body2" sx={{ textAlign: "right", mb: 2, cursor: "pointer", color: "#666", "&:hover": { color: "#4F46E5" } }}
                onClick={() => navigate("/forgot-password")}>
                Forgot password?
            </Typography>

            <Button fullWidth variant="contained" onClick={handleLogin} disabled={loading}
                sx={{ backgroundColor: "#4F46E5", borderRadius: 2, textTransform: "none", fontWeight: 500, py: 1, mb: 2 }}>
                {loading ? "Logging in..." : "Login"}
            </Button>

            <Typography variant="body2">
                Don't have an account?{" "}
                <span style={{ color: "#4F46E5", cursor: "pointer" }} onClick={() => navigate("/signup")}>Sign up</span>
            </Typography>
        </Card>
    );
}

export default Login;