import React, { useState } from 'react';
import { X, Lock, Mail, UserCheck, ShieldCheck, AlertCircle, LogIn, UserPlus, Cloud, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { loginEmail, registerEmail, loginGoogle } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Mohon isi email dan password.');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    try {
      setSubmitting(true);
      if (isRegister) {
        await registerEmail(email, password);
      } else {
        await loginEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email atau password salah.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah terdaftar. Silakan login.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password terlalu lemah. Gunakan minimal 6 karakter.');
      } else {
        setError(err.message || 'Gagal autentikasi. Silakan coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setError(null);
      setSubmitting(true);
      await loginGoogle();
      onClose();
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setError('Gagal login dengan Google: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setSubmitting(false);
    }
  };

  // Demo account quick login
  const handleQuickDemoLogin = async () => {
    try {
      setError(null);
      setSubmitting(true);
      const demoEmail = 'kasir@mahyaapparel.com';
      const demoPass = 'mahya123456';
      try {
        await loginEmail(demoEmail, demoPass);
      } catch {
        // If demo account doesn't exist yet, create it automatically
        await registerEmail(demoEmail, demoPass);
      }
      onClose();
    } catch (err: any) {
      setError('Gagal login demo: ' + (err.message || 'Coba register manual'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
          
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20 shadow-inner">
            <Cloud className="text-blue-300" size={24} />
          </div>
          <h3 className="text-xl font-extrabold tracking-tight">
            {isRegister ? 'Buat Akun Kasir Baru' : 'Login Kasir Mahya Apparel'}
          </h3>
          <p className="text-xs text-blue-200 mt-1 max-w-xs mx-auto">
            Singkronisasi data invoice & order secara real-time antar perangkat di Google Cloud Firestore.
          </p>
        </div>

        {/* Content body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Akun</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="email"
                  required
                  placeholder="kasir@mahyaapparel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isRegister ? (
                <>
                  <UserPlus size={16} /> Daftar & Mulai Sinkron Cloud
                </>
              ) : (
                <>
                  <LogIn size={16} /> Masuk ke Akun
                </>
              )}
            </button>
          </form>

          {/* Social login / Google */}
          <div className="my-4 flex items-center gap-3">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase">atau</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <button
            onClick={handleGoogleAuth}
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Masuk dengan Google
          </button>

          {/* Quick Demo Access Button */}
          <button
            onClick={handleQuickDemoLogin}
            disabled={submitting}
            className="w-full mt-2.5 py-2 px-4 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Sparkles size={14} className="text-sky-600" />
            Gunakan Akun Kasir Demo Cepat
          </button>

          {/* Toggle login / register */}
          <div className="mt-5 text-center text-xs text-slate-500">
            {isRegister ? (
              <p>
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(null); }}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Login di sini
                </button>
              </p>
            ) : (
              <p>
                Belum punya akun kasir?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(null); }}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Daftar sekarang
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
