import { useState, useEffect } from "react";
import { Box, Card, Button, Typography, Alert } from "@mui/material";
import { MarkEmailRead } from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import Logo from "../assets/logo.svg";
import { api } from "../api";

const RESEND_COOLDOWN = 60;

function VerifyEmail() {
    const location = useLocation();
    const navigate = useNavigate();
    const email = location.state?.email || "";

    const [cooldown, setCooldown] = useState(0);
    const [resendStatus, setResendStatus] = useState("");
    const [resendError, setResendError] = useState("");
    const [resending, setResending] = useState(false);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleResend = async () => {
        setResendStatus("");
        setResendError("");
        setResending(true);
        try {
            await api.resendVerification(email);
            setResendStatus("Verification email resent! Check your inbox.");
            setCooldown(RESEND_COOLDOWN);
        } catch (err) {
            setResendError(err.message || "Failed to resend. Please try again.");
        } finally {
            setResending(false);
        }
    };

    return (
        <Card sx={{ width: 420, padding: 7, borderRadius: 3, backgroundColor: "#ffffff", boxShadow: "0px 10px 40px rgba(0,0,0,0.3)", textAlign: "center" }}>
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <img src={Logo} alt="Secure Drive logo" style={{ width: 150, height: 150, marginBottom: 6 }} />
                <Typography variant="h3" fontWeight={700} lineHeight={1.1} sx={{ fontSize: "1.8rem" }}>Secure Drive</Typography>
            </Box>

            <Box display="flex" justifyContent="center" mb={2}>
                <MarkEmailRead sx={{ fontSize: 60, color: "#4F46E5" }} />
            </Box>

            <Typography variant="h6" fontWeight={700} mb={1}>Check your email</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
                We sent a verification link to <strong>{email || "your email address"}</strong>. Click the link to activate your account.
            </Typography>

            {resendStatus && <Alert severity="success" sx={{ mb: 2 }}>{resendStatus}</Alert>}
            {resendError && <Alert severity="error" sx={{ mb: 2 }}>{resendError}</Alert>}

            <Button fullWidth variant="contained" onClick={handleResend} disabled={resending || cooldown > 0}
                sx={{ backgroundColor: "#4F46E5", borderRadius: 2, textTransform: "none", fontWeight: 500, py: 1, mb: 2 }}>
                {resending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
            </Button>

            <Typography variant="body2">
                Already verified?{" "}
                <span style={{ color: "#4F46E5", cursor: "pointer" }} onClick={() => navigate("/login")}>Login</span>
            </Typography>
        </Card>
    );
}

export default VerifyEmail;