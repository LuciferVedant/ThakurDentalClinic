import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { forgotPassword, clearError } from "../store/slices/authSlice";
import Navbar from "../components/Navbar";
import { ArrowLeft, MailOpen } from "lucide-react";

const ForgotPasswordPage: React.FC = () => {
  const [identifier, setIdentifier] = useState("");
  const [success, setSuccess] = useState(false);
  const [uiErrors, setUiErrors] = useState<{ [key: string]: string }>({});

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearError());
    setUiErrors({});
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      const errStr = error.toLowerCase();
      if (errStr.includes("user not found") || errStr.includes("required")) {
        setUiErrors({ identifier: error });
      } else {
        setUiErrors({ general: error });
      }
    } else {
      setUiErrors({});
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setUiErrors({ identifier: "Email Address or Phone Number is required." });
      return;
    }

    setUiErrors({});
    dispatch(clearError());

    try {
      await dispatch(forgotPassword(identifier.trim())).unwrap();
      setSuccess(true);
    } catch (err: any) {
      // Handled by Redux error selector
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 px-4 py-12 pt-20">
        <div className="max-w-md w-full">
          
          {/* Back Button */}
          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>

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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
              Forgot Password?
            </h1>
            <p className="mt-2 text-muted-foreground text-sm">
              {!success
                ? "Enter your details to receive a recovery link."
                : "Reset link has been dispatched."}
            </p>
          </div>

          {/* Card */}
          <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-border p-8">
            {uiErrors.general && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{uiErrors.general}</p>
              </div>
            )}

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email Address / Phone Number <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (uiErrors.identifier) setUiErrors({});
                    }}
                    placeholder="Enter email or phone number"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none transition-all duration-200 ${
                      uiErrors.identifier ? "border-red-500 focus:ring-red-500" : "border-border"
                    }`}
                  />
                  {uiErrors.identifier && (
                    <p className="mt-1.5 text-xs text-red-500">{uiErrors.identifier}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
                >
                  {isLoading ? "Sending Link..." : "Send Reset Link"}
                </button>
              </form>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-950/50 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600 dark:text-primary-400">
                  <MailOpen className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Check Your Inbox / Messages</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                  If the user credentials exist in our database, we have sent a secure password reset link to the registered email address and/or phone number.
                </p>
                <button
                  onClick={() => navigate("/login")}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transition-all duration-200"
                >
                  Return to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPasswordPage;
