import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SK Malls — Shop everything, from every seller',
  description:
    'SK Malls is a multi-vendor online mall: shop from SK Malls and independent sellers in one cart, pay cash on delivery.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
