import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
// import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* <Route path="/verify-email" element={<VerifyEmail />} /> */}
    </Routes>
  );
}
export default App;