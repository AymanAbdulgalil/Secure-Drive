import { useState, useEffect } from "react";
import { Box, Card, TextField, Button, Typography, Alert, LinearProgress, InputAdornment, IconButton } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Logo from "../assets/logo.svg";

function ResetPassword() {
    const navigate = useNavigate();
    const { token } = useParams();

    const [tokenValid, setTokenValid] = useState(null); // null=checking, true=valid, false=invalid
    const [tokenError, setTokenError] = useState("");
    const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Validate token on load
    useEffect(() => {
        // Client-side check — if no token, don't even call the API
        if (!token || token.length < 10) {
            setTokenValid(false);
            setTokenError("Invalid or missing reset token.");
            return;
        }

        const validateToken = async () => {
            try {
                const response = await fetch(`/api/v1/auth/reset-password/${token}`);
                if (response.ok) {
                    setTokenValid(true);
                } else if (response.status === 401) {
                    setTokenValid(false);
                    setTokenError("This reset link has expired.");
                } else {
                    setTokenValid(false);
                    setTokenError("This reset link is invalid or has already been used.");
                }
            } catch {
                setTokenValid(false);
                setTokenError("Network error. Please check your connection.");
            }
        };

        validateToken();
    }, [token]);

    const calculatePasswordStrength = (password) => {
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
        };
        return { strength: Object.values(checks).filter(Boolean).length, checks };
    };

    const getStrengthColor = (strength) => {
        if (strength <= 2) return "#ef4444";
        if (strength === 3) return "#f59e0b";
        if (strength === 4) return "#eab308";
        return "#22c55e";
    };

    const getStrengthLabel = (strength) => {
        if (strength <= 2) return "Weak";
        if (strength === 3) return "Fair";
        if (strength === 4) return "Good";
        return "Strong";
    };

    const validatePassword = (password) => {
        const errors = [];
        if (password.length < 8) errors.push("At least 8 characters");
        if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter");
        if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter");
        if (!/[0-9]/.test(password)) errors.push("At least one number");
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push("At least one special character");
        return errors;
    };

    const passwordStrength = calculatePasswordStrength(formData.password);

    const handleSubmit = async () => {
        setError("");
        setSuccess("");

        if (!formData.password || !formData.confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        const passwordErrors = validatePassword(formData.password);
        if (passwordErrors.length > 0) {
            setError("Password requirements:\n• " + passwordErrors.join("\n• "));
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/v1/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // Token is NOT sent in body — backend reads it from path context
                body: JSON.stringify({ new_password: formData.password }),
            });

            if (response.ok) {
                setSuccess("Password reset successful! Redirecting to login...");
                setTimeout(() => navigate("/login"), 2000);
            } else if (response.status === 401) {
                setError("This reset link has expired. Please request a new one.");
            } else if (response.status === 400) {
                setError("This reset link has already been used. Please request a new one.");
            } else {
                setError("Something went wrong. Please try again.");
            }
        } catch {
            setError("Network error. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    // Loading state while validating token
    if (tokenValid === null) {
        return (
            <Card sx={{ width: 420, padding: 7, borderRadius: 3, backgroundColor: "#ffffff", boxShadow: "0px 10px 40px rgba(0,0,0,0.3)", textAlign: "center" }}>
                <Typography>Validating reset link...</Typography>
            </Card>
        );
    }

    // Invalid token state
    if (tokenValid === false) {
        return (
            <Card sx={{ width: 420, padding: 7, borderRadius: 3, backgroundColor: "#ffffff", boxShadow: "0px 10px 40px rgba(0,0,0,0.3)", textAlign: "center" }}>
                <Box display="flex" alignItems="center" flexDirection="column" mb={3}>
                    <img src={Logo} alt="Secure Drive logo" style={{ width: 150, height: 150, marginBottom: 6 }} />
                    <Typography variant="h3" fontWeight={700} sx={{ fontSize: "1.8rem" }}>Secure Drive</Typography>
                </Box>
                <Alert severity="error" sx={{ mb: 3 }}>{tokenError}</Alert>
                <Typography variant="body2">
                    <span style={{ color: "#4F46E5", cursor: "pointer" }} onClick={() => navigate("/forgot-password")}>
                        Request a new reset link
                    </span>
                </Typography>
            </Card>
        );
    }

    // Valid token — show the form
    return (
        <Card sx={{ width: 420, padding: 7, borderRadius: 3, backgroundColor: "#ffffff", boxShadow: "0px 10px 40px rgba(0,0,0,0.3)", textAlign: "center" }}>
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <img src={Logo} alt="Secure Drive logo" style={{ width: 150, height: 150, marginBottom: 6 }} />
                <Typography variant="h3" fontWeight={700} sx={{ fontSize: "1.8rem" }}>Secure Drive</Typography>
            </Box>
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <Typography variant="h3" fontWeight={700} sx={{ fontSize: "1.3rem" }}>Reset Password</Typography>
                <Typography variant="body2" sx={{ color: "#666", mt: 1 }}>Enter your new password</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2, textAlign: "left", whiteSpace: "pre-line" }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <Box mb={1} textAlign="left">
                <Typography variant="body2" mb={0.5}>New Password</Typography>
                <TextField
                    fullWidth size="small"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

            {formData.password && (
                <Box mb={2} textAlign="left">
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption" sx={{ color: "#666" }}>Password Strength</Typography>
                        <Typography variant="caption" sx={{ color: getStrengthColor(passwordStrength.strength), fontWeight: 600 }}>
                            {getStrengthLabel(passwordStrength.strength)}
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={(passwordStrength.strength / 5) * 100}
                        sx={{
                            height: 6, borderRadius: 3, backgroundColor: "#e5e7eb",
                            "& .MuiLinearProgress-bar": { backgroundColor: getStrengthColor(passwordStrength.strength), borderRadius: 3 }
                        }}
                    />
                </Box>
            )}

            <Box mb={3} textAlign="left">
                <Typography variant="body2" mb={0.5}>Confirm Password</Typography>
                <TextField
                    fullWidth size="small"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" size="small">
                                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                />
            </Box>

            <Button
                fullWidth variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                sx={{ backgroundColor: "#4F46E5", borderRadius: 2, textTransform: "none", fontWeight: 500, py: 1, mb: 2 }}
            >
                {loading ? "Resetting..." : "Reset Password"}
            </Button>

            <Typography variant="body2">
                <span style={{ color: "#4F46E5", cursor: "pointer" }} onClick={() => navigate("/forgot-password")}>
                    Request a new reset link
                </span>
            </Typography>
        </Card>
    );
}

export default ResetPassword;