import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, AlertCircle, ArrowRight, Bot, CheckCircle2, Inbox, ExternalLink, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState<{
    email: string;
    activationToken?: string;
    activationLink?: string;
  } | null>(null);

  const { register, setIsEmailModalOpen } = useAuth();
  const navigate = useNavigate();

  const validateEmailFormat = (val: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
    return emailRegex.test(val.trim());
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    setGeneralError(null);
    if (!val.trim()) {
      setEmailError(null);
    } else if (!validateEmailFormat(val)) {
      setEmailError('Please enter a valid email address (e.g. name@company.com)');
    } else {
      setEmailError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Email address is required.');
      return;
    }
    if (!validateEmailFormat(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register(cleanEmail);
      if (res.success) {
        setRegistrationSuccess({
          email: cleanEmail,
          activationToken: res.activationToken,
          activationLink: res.activationLink
        });
      } else {
        setGeneralError(res.error || 'Registration failed.');
      }
    } catch (err: any) {
      setGeneralError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = email.trim() !== '' && !emailError;

  return (
    <div className="min-h-[calc(100vh-2.25rem)] flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* App Logo Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-xs text-slate-400 mt-1">Get started with automated testing in minutes</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-sm">
          {registrationSuccess ? (
            /* Success State - Activation Initiated */
            <div className="space-y-5 animate-fadeIn">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-lg font-bold text-white">Activation Link Sent!</h3>
                <p className="text-xs text-slate-400">
                  We have initiated account activation for:
                </p>
                <p className="text-xs font-semibold text-brand-400 bg-brand-950/60 border border-brand-800/60 py-1 px-3 rounded-lg inline-block">
                  {registrationSuccess.email}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                <p className="flex items-center gap-1.5 text-slate-200 font-medium">
                  <Inbox className="w-4 h-4 text-brand-400" />
                  <span>Desktop Local Mailbox</span>
                </p>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Since you're running Easy Automate locally, the activation email has been routed to your in-app simulator. Click below to view the email or activate immediately.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                {registrationSuccess.activationToken && (
                  <button
                    onClick={() => {
                      navigate(`/activate?token=${registrationSuccess.activationToken}&email=${encodeURIComponent(registrationSuccess.email)}`);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Account Activation</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsEmailModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Inbox className="w-3.5 h-3.5 text-brand-400" />
                  <span>Open In-App Mailbox</span>
                </button>
              </div>
            </div>
          ) : (
            /* Registration Input Form */
            <>
              {generalError && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{generalError}</p>
                    {generalError.includes('already registered and activated') && (
                      <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold underline mt-1 block">
                        Proceed to Login instead
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      placeholder="name@company.com"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border text-slate-100 text-xs sm:text-sm placeholder:text-slate-600 transition-colors focus:outline-none focus:ring-1 ${
                        emailError
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                          : 'border-slate-800 focus:border-brand-500 focus:ring-brand-500'
                      }`}
                      autoFocus
                    />
                  </div>
                  {emailError ? (
                    <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1 animate-fadeIn">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {emailError}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      We'll verify this email address and send your activation link.
                    </p>
                  )}
                </div>

                {/* Register Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !isFormValid}
                    className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <span>Initiating activation...</span>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Register & Send Activation Link</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer Navigation */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Already have an active account?{' '}
          <Link to="/login" className="font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
};
