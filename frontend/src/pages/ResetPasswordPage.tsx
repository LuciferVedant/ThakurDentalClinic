import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { resetPassword, clearError } from "../store/slices/authSlice";
import { useTranslation } from "react-i18next";
import Navbar from "../components/Navbar";
import axios from "axios";
import { ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  // Link validation states
  const [isValidating, setIsValidating] = useState(true);
  const [isLinkValid, setIsLinkValid] = useState(false);

  const [uiErrors, setUiErrors] = useState<{ [key: string]: string }>({});

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  // Verify token on mount
  useEffect(() => {
    dispatch(clearError());
    setUiErrors({});
    
    if (!token) {
      setIsValidating(false);
      setIsLinkValid(false);
      return;
    }

    const verifyToken = async () => {
      try {
        await axios.post(`${API_URL}/auth/verify-reset-token`, { token });
        setIsLinkValid(true);
      } catch (err: any) {
        setIsLinkValid(false);
        setUiErrors({ general: err.response?.data?.error || "Invalid or expired password reset link" });
      } finally {
        setIsValidating(false);
      }
    };

    verifyToken();
  }, [token, dispatch]);

  useEffect(() => {
    if (error) {
      const errStr = error.toLowerCase();
      if (errStr.includes("password")) {
        setUiErrors({ password: error });
      } else {
        setUiErrors({ general: error });
      }
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = t("login.passwordsDontMatch");
    }

    if (Object.keys(errors).length > 0) {
      setUiErrors(errors);
      return;
    }

    setUiErrors({});
    dispatch(clearError());

    try {
      await dispatch(resetPassword({ token, password })).unwrap();
      setSuccess(true);
    } catch (err: any) {
      // Handled by Redux selector
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 px-4 py-12 pt-20">
        <div className="max-w-md w-full">
          
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl mb-4 shadow-lg">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
              Reset Password
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              {isValidating
                ? "Checking authorization status..."
                : isLinkValid
                ? !success
                  ? "Choose a secure password for your account."
                  : "New password has been updated."
                : "Unable to verify recover request."}
            </p>
          </div>

          {/* Card */}
          <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-border p-8">
            {isValidating ? (
              <div className="flex flex-col items-center py-10 space-y-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm font-medium text-muted-foreground">Verifying link status...</p>
              </div>
            ) : !isLinkValid ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Invalid or Expired Link</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                  {uiErrors.general || "This password reset link is invalid, expired, or has already been used. Please request a new recovery link."}
                </p>
                <button
                  onClick={() => navigate("/forgot-password")}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  Request New Link
                </button>
              </div>
            ) : !success ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {uiErrors.general && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{uiErrors.general}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    New Password <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (uiErrors.password) setUiErrors(prev => ({ ...prev, password: "" }));
                      }}
                      placeholder="Minimum 8 characters"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none pr-10 ${
                        uiErrors.password ? "border-red-500 focus:ring-red-500" : "border-border"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? t("login.hide") : t("login.show")}
                    </button>
                  </div>
                  {uiErrors.password && (
                    <p className="mt-1 text-xs text-red-500">{uiErrors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Confirm New Password <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (uiErrors.confirmPassword) setUiErrors(prev => ({ ...prev, confirmPassword: "" }));
                      }}
                      placeholder="Confirm your password"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none pr-10 ${
                        uiErrors.confirmPassword ? "border-red-500 focus:ring-red-500" : "border-border"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? t("login.hide") : t("login.show")}
                    </button>
                  </div>
                  {uiErrors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">{uiErrors.confirmPassword}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 mt-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-950/50 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Password Reset Successful</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                  Your password has been changed successfully. You can now use your new password to log into your portal.
                </p>
                <button
                  onClick={() => navigate("/login")}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  Go to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ResetPasswordPage;
