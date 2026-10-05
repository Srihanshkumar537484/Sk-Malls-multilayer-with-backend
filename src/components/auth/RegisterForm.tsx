'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function RegisterForm() {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const fullName = String(formData.get('full_name'));

    // Note: a DB trigger (handle_new_user, see 0001_core_schema.sql) creates
    // the matching public.profiles row automatically as role='customer'.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <p className="text-gray-700">
        Check your email to confirm your account, then{' '}
        <Link href="/login" className="text-brand font-medium">log in</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
        <input id="full_name" name="full_name" type="text" required autoComplete="name"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand" />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand" />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting}
        className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60">
        {submitting ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-sm text-gray-600 text-center">
        Already have an account? <Link href="/login" className="text-brand font-medium">Log in</Link>
      </p>
    </form>
  );
}
