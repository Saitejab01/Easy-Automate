import React from 'react';
import { Mail, CheckCircle2, ExternalLink, X, Clock, Inbox, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const EmailSimulatorModal: React.FC = () => {
  const { simulatedEmails, isEmailModalOpen, setIsEmailModalOpen, refreshEmails } = useAuth();
  const navigate = useNavigate();

  if (!isEmailModalOpen) return null;

  const handleOpenLink = (link: string) => {
    setIsEmailModalOpen(false);
    // Link format could be easyautomate://activate?token=... or #/activate?token=...
    try {
      const url = new URL(link.startsWith('easyautomate:') ? link.replace('easyautomate://', 'http://dummy/') : link.startsWith('#') ? 'http://dummy/' + link.slice(1) : link);
      const token = url.searchParams.get('token');
      const email = url.searchParams.get('email');
      if (token) {
        navigate(`/activate?token=${token}${email ? `&email=${encodeURIComponent(email)}` : ''}`);
      } else {
        navigate('/activate');
      }
    } catch {
      navigate('/activate');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Simulated Local Mailbox
                <span className="text-xs font-normal bg-brand-500/10 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full">
                  Local Dev Mailer
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Activation emails dispatched by Easy Automate are caught here for instant desktop testing
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEmailModalOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {simulatedEmails.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Mail className="w-12 h-12 text-slate-600 mx-auto mb-3 stroke-[1.5]" />
              <p className="text-slate-300 font-medium text-sm">No emails received yet</p>
              <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">
                Register a new account or trigger an activation link to see incoming verification emails here.
              </p>
            </div>
          ) : (
            simulatedEmails.map((email) => (
              <div
                key={email.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 hover:border-brand-500/40 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400 bg-brand-950/60 border border-brand-800/60 px-2.5 py-0.5 rounded-full mb-2">
                      <Sparkles className="w-3 h-3" />
                      {email.subject}
                    </span>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <p>
                        <span className="text-slate-500">To:</span> <span className="text-slate-200 font-mono">{email.to}</span>
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3" />
                        {new Date(email.sentAt).toLocaleTimeString()} · {new Date(email.sentAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 whitespace-pre-line font-sans bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  {email.body}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                    Token: <span className="text-slate-300">{email.activationToken.slice(0, 16)}...</span>
                  </span>
                  <button
                    onClick={() => handleOpenLink(email.activationLink)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-lg shadow-sm transition-all hover:scale-[1.02]"
                  >
                    <span>Click Activation Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <span>{simulatedEmails.length} email{simulatedEmails.length === 1 ? '' : 's'} in queue</span>
          <button
            onClick={() => refreshEmails()}
            className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
          >
            Refresh Mailbox
          </button>
        </div>
      </div>
    </div>
  );
};

