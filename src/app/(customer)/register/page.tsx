import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-2xl font-bold mb-2">Create an account</h1>
      <p className="text-gray-600 mb-8">
        Track orders, save addresses, and check out faster.
      </p>
      <RegisterForm />
    </div>
  );
}
