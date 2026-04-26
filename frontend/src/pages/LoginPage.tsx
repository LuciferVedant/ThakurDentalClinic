import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGoogleLogin } from '@react-oauth/google';
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  loginWithCredentials,
  loginWithGoogle,
  registerPatient,
  clearError,
} from "../store/slices/authSlice";
import { useTranslation } from 'react-i18next';
import Navbar from "../components/Navbar";

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"patient" | "staff">("patient");
  const [isLogin, setIsLogin] = useState(true);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error, isAuthenticated } = useAppSelector(
    (state) => state.auth
  );

  useEffect(() => {
    console.log(
      "Current Google Client ID:",
      import.meta.env.VITE_GOOGLE_CLIENT_ID
    );
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const state = location.state as { from?: { pathname: string } } | null;
      const from = state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  useEffect(() => {
    dispatch(clearError());
    // Reset form when switching modes
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
    setPhone("");
  }, [dispatch, activeTab, isLogin]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatch(loginWithCredentials({ email, password }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert(t('login.passwordsDontMatch'));
      return;
    }
    await dispatch(
      registerPatient({ email, password, firstName, lastName, phone })
    );
  };

  const handleGoogleSuccess = async (response: { code: string }) => {
    if (response.code) {
      await dispatch(loginWithGoogle(response.code));
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => {
      console.error('Google login failed');
      console.log('Please check your Google Cloud Console "Authorized JavaScript origins" settings.');
    },
    flow: 'auth-code',
  });

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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
            {t('login.clinicName')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {activeTab === "patient"
              ? isLogin
                ? t('login.signInToAccount')
                : t('login.createNewAccount')
              : t('login.staffPortalAccess')}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card/80 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-border">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              className={`flex-1 py-4 text-sm font-medium transition-colors duration-200 ${
                activeTab === "patient"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              onClick={() => setActiveTab("patient")}
            >
              {t('login.patientPortal')}
            </button>
            <button
              className={`flex-1 py-4 text-sm font-medium transition-colors duration-200 ${
                activeTab === "staff"
                  ? "text-primary-600 border-b-2 border-primary-600 bg-primary-50/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              onClick={() => setActiveTab("staff")}
            >
              {t('login.staffPortal')}
            </button>
          </div>

          <div className="p-8">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Google Login */}
            <div className="mb-6">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => googleLogin()}
                  className="flex items-center justify-center w-full px-4 py-2 border border-border rounded-lg shadow-sm bg-card text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t('login.signInWithGoogle')}
                </button>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {activeTab === "patient"
                    ? t('login.orContinueWithEmail')
                    : t('login.orSignInWithCredentials')}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
            </div>

            {/* Forms */}
            {activeTab === "patient" ? (
              <>
                <form
                  onSubmit={isLogin ? handleEmailLogin : handleRegister}
                  className="space-y-4"
                >
                  {!isLogin && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            {t('login.firstName')}
                          </label>
                          <input
                            type="text"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">
                            {t('login.lastName')}
                          </label>
                          <input
                            type="text"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {t('login.phoneNumber')}
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('login.emailAddress')}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('login.password')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? t('login.hide') : t('login.show')}
                      </button>
                    </div>
                  </div>

                  {!isLogin && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        {t('login.confirmPassword')}
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {isLoading
                      ? t('login.processing')
                      : isLogin
                      ? t('login.signIn')
                      : t('login.createAccount')}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {isLogin
                      ? t('login.dontHaveAccount')
                      : t('login.alreadyHaveAccount')}
                  </button>
                </div>
              </>
            ) : (
              // Staff Login Form
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t('login.emailAddress')}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t('login.password')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary bg-background text-foreground outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? t('login.hide') : t('login.show')}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-medium rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {isLoading ? t('login.signingIn') : t('login.signIn')}
                </button>

                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    {t('login.staffCredentialsNote')}
                    <br />
                    {t('login.googleLinkNote')}
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default LoginPage;
