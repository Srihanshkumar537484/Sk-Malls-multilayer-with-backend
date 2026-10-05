import { SellerRegistrationForm } from '@/components/seller/SellerRegistrationForm';

export default function SellerRegisterPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold mb-2">Sell on SK Malls</h1>
      <p className="text-gray-600 mb-8 max-w-lg">
        Fill in your business details below. Once approved, you get your own store page,
        a seller dashboard, and no-code tools to add products.
      </p>
      <SellerRegistrationForm />
    </div>
  );
}
