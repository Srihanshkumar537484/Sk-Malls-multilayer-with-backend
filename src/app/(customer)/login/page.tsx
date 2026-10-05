import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-bold mb-2">Log in</h1>
      <p className="text-gray-600 mb-8">Welcome back to SK Malls.</p>
      <LoginForm />
    </div>
  );
}
