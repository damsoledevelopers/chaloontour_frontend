'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) toast.error('Invalid reset link.');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: password.trim() });
      toast.success('Password updated. Sign in with your new password.');
      router.replace('/auth/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-slate-50 to-accent-50/30 py-12 px-4">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-card border border-gray-100">
          <p className="text-gray-600">This reset link is invalid or missing. Request a new one.</p>
          <Link href="/auth/forgot-password" className="mt-4 inline-block text-primary-600 hover:text-primary-700 font-medium">
            Forgot password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-slate-50 to-accent-50/30 py-12 px-4">
      <div className="max-w-md w-full">
        <Link href="/auth/login" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-900">Set new password</h1>
          <p className="mt-2 text-gray-600">Enter and confirm your new password.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-card border border-gray-100">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pr-10 py-2 w-full"
                  placeholder="Min 6 characters"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="form-input px-3 py-2 w-full"
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="mt-6 w-full btn-primary py-3 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
