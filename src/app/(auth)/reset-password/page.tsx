"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.replace("/home");
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl p-8 sm:p-12 border border-line">
        <div className="mb-8 text-center">
          <Link href="/" className="font-serif text-2xl tracking-tight inline-block mb-6">
            K<span className="text-accent">i</span>ndred
          </Link>
          <h2 className="text-xl sm:text-2xl font-serif mb-2">Set a new password</h2>
          <p className="text-stone text-sm">Choose a new password for your vault.</p>
        </div>

        {success ? (
          <p className="text-accent text-sm bg-accent/5 px-4 py-4 rounded-xl text-center">
            Password updated. Taking you to your vault...
          </p>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-stone uppercase tracking-widest mb-2 ml-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full bg-paper border border-line rounded-2xl px-5 py-3.5 sm:py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone hover:text-ink transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-xs bg-red-50 px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}