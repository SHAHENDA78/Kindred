"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

async function resolveDestination(redirectParam: string | null): Promise<string> {
  if (redirectParam) return redirectParam;
  return "/home";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const destination = await resolveDestination(redirectParam);
        router.replace(destination);
      }
    });
  }, [router, redirectParam]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    const destination = await resolveDestination(redirectParam);
    setLoading(false);

    router.replace(destination);
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then tap Forgot?");
      return;
    }
    setSendingReset(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-[1000px] w-full bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-line md:min-h-[600px]">
        <div className="w-full md:w-1/2 relative bg-ink hidden md:flex flex-col justify-between p-12 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <Link
            href="/"
            className="relative z-10 font-serif text-2xl tracking-tight text-white inline-flex items-center gap-2 w-fit"
          >
            <ChevronLeft size={18} />
            K<span className="text-accent">i</span>ndred
          </Link>

          <div className="relative z-10 text-white space-y-6">
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">
              Welcome back
            </span>
            <p className="font-serif text-4xl italic leading-tight">
              The journey of a thousand memories continues with a single login.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-8 h-px bg-white/20" />
            Private by design
          </div>
        </div>
                        <div className="md:hidden bg-ink relative overflow-hidden px-8 pt-10 pb-10">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <Link href="/" className="relative z-10 font-serif text-2xl tracking-tight text-white inline-block mb-5">
            K<span className="text-accent">i</span>ndred
          </Link>
          <p className="relative z-10 font-serif text-xl italic text-white leading-snug">
            The journey of a thousand memories continues with a single login.
          </p>

          <svg
            className="absolute bottom-0 left-0 w-full h-8 text-white"
            viewBox="0 0 400 40"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,20 C100,40 300,0 400,20 L400,40 L0,40 Z" />
          </svg>
        </div>

        <div className="w-full md:w-1/2 p-8 sm:p-12 md:p-16 flex flex-col justify-center">
          <div className="mb-8 sm:mb-10 text-center md:text-left">
            <Link href="/" className="font-serif text-2xl tracking-tight hidden md:inline-block mb-6 md:mb-8">
              K<span className="text-accent">i</span>ndred
            </Link>
            <h2 className="text-xl sm:text-2xl font-serif mb-2">Log in to your vault</h2>
            <p className="text-stone text-sm">Secure, private, and just for you.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-stone uppercase tracking-widest mb-2 ml-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="elena@example.com"
                required
                className="w-full bg-paper border border-line rounded-2xl px-5 py-3.5 sm:py-4 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2 ml-1">
                <label className="block text-[10px] font-bold text-stone uppercase tracking-widest">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={sendingReset}
                  className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                >
                  {sendingReset ? "Sending..." : "Forgot?"}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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

            {resetSent && (
              <p className="text-accent text-xs bg-accent/5 px-4 py-3 rounded-xl">
                Check your email for a password reset link.
              </p>
            )}
            {error && (
              <p className="text-red-600 text-xs bg-red-50 px-4 py-3 rounded-xl">{error}</p>
            )}

            <div className="pt-2 sm:pt-4 space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Logging in...
                  </span>
                ) : (
                  "Log In"
                )}
              </button>

            </div>
          </form>

<p className="mt-8 sm:mt-10 text-center text-sm text-stone">
  Don&apos;t have a vault yet?
  <Link
    href={redirectParam ? `/signup?redirect=${encodeURIComponent(redirectParam)}` : "/signup"}
    className="text-accent font-bold hover:underline block mt-1"
  >
    Sign up for free
  </Link>
</p>        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}