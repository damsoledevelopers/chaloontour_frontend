'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../../contexts/AuthContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (user && user.role === 'super_admin') {
      router.replace('/admin/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || (user && user.role === 'super_admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-slate-50 to-accent-50/30">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password.trim());
      toast.success('Login successful!');
    } catch (err) {
      toast.error(err.message || 'Login failed. Only Super Admin can access.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-slate-50 to-accent-50/30 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/chalo-on-tour-e1766686260447.png" alt="ChaloOnTour" width={220} height={80} className="object-contain" priority />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-card-hover border border-gray-100">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="form-input px-3 py-2.5" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="form-input px-3 py-2.5 pr-10 w-full" placeholder="••••••••" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2 text-right">
            <Link href="/auth/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Forgot password?
            </Link>
          </div>
          <button type="submit" disabled={loading} className="mt-6 w-full btn-primary py-3 flex items-center justify-center rounded-xl text-base font-medium">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
