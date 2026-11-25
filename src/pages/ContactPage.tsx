import React, { useState } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please include a short message (at least 10 characters).');
      return;
    }
    setError(null);
    setSubmitted(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="border-b border-[#2a3544] pb-5 space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#eef2f6]">Contact</h1>
        <p className="text-sm text-[#9aa7b8]">
          Report codec issues, suggest presets, or reach the site operator. Because{' '}
          {APP_CONFIG.appName} is a static client-side app with no backend, this form opens a
          prepared email draft or displays direct contact details.
        </p>
      </div>

      <div className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 flex items-center gap-3 text-sm">
        <Mail className="w-5 h-5 text-[#e59a24] shrink-0" />
        <div>
          <span className="text-[#9aa7b8]">Direct email: </span>
          <a
            href={`mailto:${APP_CONFIG.contactEmail}`}
            className="font-mono-num text-[#eef2f6] hover:text-[#e59a24] underline underline-offset-2"
          >
            {APP_CONFIG.contactEmail}
          </a>
        </div>
      </div>

      {submitted ? (
        <div className="rounded-md border border-[#2ea043]/60 bg-[#2ea043]/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#eef2f6]">
            <CheckCircle2 className="w-5 h-5 text-[#2ea043]" />
            <span>Message ready to send</span>
          </div>
          <p className="text-xs text-[#9aa7b8]">
            Static sites do not run a mail server. Click below to open your email client with this
            message pre-filled, or email{' '}
            <span className="font-mono-num text-[#eef2f6]">{APP_CONFIG.contactEmail}</span>.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`mailto:${APP_CONFIG.contactEmail}?subject=${encodeURIComponent(
                `[${APP_CONFIG.appName}] Message from ${name.trim()}`
              )}&body=${encodeURIComponent(`${message.trim()}\n\nReply-to: ${email.trim()}`)}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] text-xs font-semibold"
            >
              Open Email App
            </a>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setName('');
                setEmail('');
                setMessage('');
              }}
              className="px-4 py-2 rounded-md border border-[#2a3544] text-xs text-[#9aa7b8] hover:text-[#eef2f6]"
            >
              Reset Form
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="rounded-md border border-[#2a3544] bg-[#151b22] p-5 space-y-4">
          <div className="space-y-1">
            <label htmlFor="contact-name" className="block text-xs font-medium text-[#eef2f6]">
              Name
            </label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-3 py-2 text-sm text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="contact-email" className="block text-xs font-medium text-[#eef2f6]">
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-3 py-2 text-sm text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="contact-msg" className="block text-xs font-medium text-[#eef2f6]">
              Message
            </label>
            <textarea
              id="contact-msg"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your feedback or browser/codec details..."
              className="w-full rounded border border-[#2a3544] bg-[#0e1217] px-3 py-2 text-sm text-[#eef2f6] focus:border-[#e59a24] focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-[#f8d7da]">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="px-5 py-2.5 rounded-md bg-[#e59a24] hover:bg-[#f0ab3c] text-[#0e1217] font-semibold text-sm cursor-pointer"
          >
            Prepare Email Draft
          </button>
        </form>
      )}
    </div>
  );
}
