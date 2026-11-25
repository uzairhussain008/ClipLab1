import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
      <h1 className="font-display text-5xl font-bold text-[#eef2f6]">404</h1>
      <p className="text-sm text-[#9aa7b8]">That route does not exist.</p>
      <Link
        to="/"
        className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-sm"
      >
        Back to Home
      </Link>
    </div>
  );
}
