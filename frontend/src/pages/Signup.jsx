import { useState } from "react";
import { Box, Card, TextField, Button, Typography, Alert, LinearProgress, InputAdornment, IconButton } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Logo from "../assets/logo.svg";

function Signup() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    // Password strength calculation
    const calculatePasswordStrength = (password) => {
        let strength = 0;
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        strength = Object.values(checks).filter(Boolean).length;
        return { strength, checks };
    };

    const getPasswordStrengthColor = (strength) => {
        if (strength <= 2) return "#ef4444"; // Red
        if (strength === 3) return "#f59e0b"; // Orange
        if (strength === 4) return "#eab308"; // Yellow
        return "#22c55e"; // Green
    };

    const getPasswordStrengthLabel = (strength) => {
        if (strength <= 2) return "Weak";
        if (strength === 3) return "Fair";
        if (strength === 4) return "Good";
        return "Strong";
    };

    const passwordStrength = calculatePasswordStrength(formData.password);
    const strengthPercentage = (passwordStrength.strength / 5) * 100;

    const validatePassword = (password, email) => {
        const errors = [];

        if (password.length < 8) {
            errors.push("At least 8 characters");
        }
        if (!/[A-Z]/.test(password)) {
            errors.push("At least one uppercase letter (A-Z)");
        }
        if (!/[a-z]/.test(password)) {
            errors.push("At least one lowercase letter (a-z)");
        }
        if (!/[0-9]/.test(password)) {
            errors.push("At least one number (0-9)");
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push("At least one special character (!@#$%^&*)");
        }

        // Check if password contains email username
        if (email) {
            const emailUsername = email.split('@')[0].toLowerCase();
            if (password.toLowerCase().includes(emailUsername)) {
                errors.push("Password cannot contain your email address");
            }
        }

        return errors;
    };

    const handleSignup = async () => {
        setError("");
        setSuccess("");

        // Validation
        if (!formData.name || !formData.email || !formData.password) {
            setError("Please fill in all fields");
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError("Please enter a valid email address");
            return;
        }

        // Password validation
        const passwordErrors = validatePassword(formData.password, formData.email);
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
            const response = await fetch("/api/v1/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password
                }),
            });

            const data = await response.json();

        if (response.ok) {
            navigate("/verify-email", { state: { email: formData.email } });
        } else {
                setError(data.detail || "Signup failed. Please try again.");
            }
        } catch (err) {
            setError("Network error. Please check if the backend is running.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card
            sx={{
                width: 420,
                padding: 7,
                borderRadius: 3,
                backgroundColor: "#ffffff",
                boxShadow: "0px 10px 40px rgba(0,0,0,0.3)",
                textAlign: "center"
            }}>
            {/* Title */}
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <img src={Logo} alt="Secure Drive logo" style={{ width: 150, height: 150, marginBottom: 6 }} />
                <Typography variant="h3" fontWeight={700} lineHeight={1.1} sx={{ fontSize: "1.8rem" }}>
                    Secure Drive
                </Typography>
            </Box>
            <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
                <Typography variant="h3" fontWeight={700} lineHeight={1.1} sx={{ fontSize: "1.3rem" }}>
                    Create Account
                </Typography>
            </Box>

            {/* Error/Success Messages */}
            {error && (
                <Alert severity="error" sx={{ mb: 2, textAlign: "left", whiteSpace: "pre-line" }}>
                    {error}
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {success}
                </Alert>
            )}

            {/* Name */}
            <Box mb={2} textAlign="left">
                <Typography variant="body2" mb={0.5}>
                    Name
                </Typography>
                <TextField 
                    fullWidth 
                    size="small" 
                    placeholder="Enter your name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                />
            </Box>

            {/* Email */}
            <Box mb={2} textAlign="left">
                <Typography variant="body2" mb={0.5}>
                    Email
                </Typography>
                <TextField 
                    fullWidth 
                    size="small" 
                    placeholder="Enter your email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                />
            </Box>

            {/* Password */}
            <Box mb={1} textAlign="left">
                <Typography variant="body2" mb={0.5}>
                    Password
                </Typography>
                <TextField 
                    fullWidth 
                    size="small" 
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => setShowPassword(!showPassword)}
                                    edge="end"
                                    size="small"
                                >
                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                />
            </Box>

            {/* Password Strength Meter */}
            {formData.password && (
                <Box mb={2} textAlign="left">
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="caption" sx={{ color: "#666" }}>
                            Password Strength
                        </Typography>
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                color: getPasswordStrengthColor(passwordStrength.strength),
                                fontWeight: 600
                            }}
                        >
                            {getPasswordStrengthLabel(passwordStrength.strength)}
                        </Typography>
                    </Box>
                    <LinearProgress 
                        variant="determinate" 
                        value={strengthPercentage}
                        sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: "#e5e7eb",
                            "& .MuiLinearProgress-bar": {
                                backgroundColor: getPasswordStrengthColor(passwordStrength.strength),
                                borderRadius: 3
                            }
                        }}
                    />
                    <Box mt={1}>
                        {!passwordStrength.checks.length && (
                            <Typography variant="caption" sx={{ color: "#666", display: "block" }}>
                                • At least 8 characters
                            </Typography>
                        )}
                        {!passwordStrength.checks.uppercase && (
                            <Typography variant="caption" sx={{ color: "#666", display: "block" }}>
                                • One uppercase letter
                            </Typography>
                        )}
                        {!passwordStrength.checks.lowercase && (
                            <Typography variant="caption" sx={{ color: "#666", display: "block" }}>
                                • One lowercase letter
                            </Typography>
                        )}
                        {!passwordStrength.checks.number && (
                            <Typography variant="caption" sx={{ color: "#666", display: "block" }}>
                                • One number
                            </Typography>
                        )}
                        {!passwordStrength.checks.special && (
                            <Typography variant="caption" sx={{ color: "#666", display: "block" }}>
                                • One special character
                            </Typography>
                        )}
                    </Box>
                </Box>
            )}

            {/* Confirm Password */}
            <Box mb={3} textAlign="left">
                <Typography variant="body2" mb={0.5}>
                    Confirm Password
                </Typography>
                <TextField 
                    fullWidth 
                    size="small" 
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    edge="end"
                                    size="small"
                                >
                                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                />
            </Box>

            {/* Signup button */}
            <Button 
                fullWidth 
                variant="contained"
                onClick={handleSignup}
                disabled={loading}
                sx={{
                    backgroundColor: "#4F46E5",
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 500,
                    py: 1,
                    mb: 2
                }}>
                {loading ? "Creating Account..." : "Sign Up"}
            </Button>

            {/* Switch to login */}
            <Typography variant="body2">
                Already have an account?{" "}
                <span style={{ color: "#4F46E5", cursor: "pointer" }} onClick={() => navigate("/login")}>
                    Login
                </span>
            </Typography>
        </Card>
    );
}

export default Signup;
