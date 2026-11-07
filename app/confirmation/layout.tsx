import type { Metadata } from 'next';

// A private step in the application flow. Keep it out of search results.
export const metadata: Metadata = {
  title: 'Confirmation | Weaverville Chamber of Commerce Vendor Portal',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
