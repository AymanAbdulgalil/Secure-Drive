import { useState } from "react";
import { Box, Card, TextField, Button, Typography, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";
import Logo from "../assets/logo.svg";
import { api } from "../api";

function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setError("");
        setSuccess("");

        if (!email) {
            setError("Please enter your email address");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Please enter a valid email address");
            return;
        }

        setLoading(true);
        try {
            await api.forgotPassword(email);
            setSuccess("If an account exists with that email, you'll receive a reset link shortly.");
            setEmail("");
        } catch (err) {
            // Always show success to prevent email enumeration
            setSuccess("If an account exists with that email, you'll receive a reset link shortly.");
            setEmail("");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card sx={{ width: 380, padding: 7, borderRadius: 3, backgroundColor: "#ffffff", boxShadow: "0px 10px 40px rgba(0,0,0,0.3)", textAlign: "center" }}>
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <img src={Logo} alt="Secure Drive logo" style={{ width: 150, height: 150, marginBottom: 6 }} />
                <Typography variant="h3" fontWeight={700} lineHeight={1.1} sx={{ fontSize: "1.8rem" }}>Secure Drive</Typography>
            </Box>
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <Typography variant="h3" fontWeight={700} lineHeight={1.1} sx={{ fontSize: "1.3rem" }}>Forgot Password?</Typography>
                <Typography variant="body2" sx={{ color: "#666", mt: 1 }}>Enter your email and we'll send you a reset link</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <Box mb={3} textAlign="left">
                <Typography variant="body2" mb={0.5}>Email</Typography>
                <TextField fullWidth size="small" placeholder="Enter your email" type="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSubmit()} />
            </Box>

            <Button fullWidth variant="contained" onClick={handleSubmit} disabled={loading}
                sx={{ backgroundColor: "#4F46E5", borderRadius: 2, textTransform: "none", fontWeight: 500, py: 1, mb: 2 }}>
                {loading ? "Sending..." : "Send Reset Link"}
            </Button>

            <Typography variant="body2">
                Remember your password?{" "}
                <span style={{ color: "#4F46E5", cursor: "pointer" }} onClick={() => navigate("/login")}>Back to Login</span>
            </Typography>
        </Card>
    );
}

export default ForgotPassword;