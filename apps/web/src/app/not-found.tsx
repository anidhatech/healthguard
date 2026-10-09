import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">The page you asked for does not exist.</p>
      <Link href="/" className="mt-4 inline-block text-brand-700 underline">
        Go home
      </Link>
    </main>
  );
}
