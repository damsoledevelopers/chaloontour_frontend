'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetLink, setResetLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSent(false);
    setResetLink('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
      if (data.resetLink) setResetLink(data.resetLink);
      toast.success(data.message || 'Check your email for the reset link.');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Request failed.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-slate-50 to-accent-50/30 py-12 px-4">
      <div className="max-w-md w-full">
        <Link href="/auth/login" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-900">Forgot password?</h1>
          <p className="mt-2 text-gray-600">Enter your email and we’ll send you a reset link.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-card border border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input pl-10 pr-3 py-2 w-full"
                placeholder="admin@chalo.com"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="mt-6 w-full btn-primary py-3 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Send reset link
          </button>
          {sent && resetLink && (
            <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-lg text-sm text-gray-700">
              <p className="font-medium text-primary-800 mb-1">Reset link (copy and open):</p>
              <a href={resetLink} className="break-all text-primary-600 hover:underline">{resetLink}</a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
