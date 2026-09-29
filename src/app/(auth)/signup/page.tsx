"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirectParam || "/home");
    });
  }, [router, redirectParam]);

  function validate(): string | null {
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (signUpData.user) {
      await supabase
        .from("profiles")
        .upsert({ id: signUpData.user.id, full_name: fullName, email });
    }

    router.push(redirectParam || "/onboarding");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-ink/5">
      <div className="max-w-[1000px] w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-line md:min-h-[640px]">

        <div className="w-full md:w-1/2 relative bg-ink hidden md:flex flex-col justify-between p-12 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-accent/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />

          <Link href="/" className="relative z-10 font-serif text-2xl tracking-tight text-white inline-flex items-center gap-2 w-fit">
            <ChevronLeft size={18} />
            K<span className="text-accent">i</span>ndred
          </Link>

          <div className="relative z-10 text-white space-y-6">
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">
              A quiet space for what matters
            </span>
            <p className="font-serif text-4xl italic leading-tight">
              Every relationship is a library of stories.
            </p>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs">
              We&apos;ll help you capture the small, beautiful details that make up your history together — before life gets in the way.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-8 h-px bg-white/20" />
            Private by design
          </div>
        </div>

                <div className="md:hidden bg-ink relative overflow-hidden px-8 pt-10 pb-14">
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
            Every relationship is a library of stories.
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

        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center">
          <div className="mb-8">
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 block">
              New Here
            </span>
            <h1 className="text-2xl font-serif text-ink">Create your account</h1>
            <p className="text-stone text-sm mt-1">
              {redirectParam
                ? "One quick step to accept your invite."
                : "Start saving your moments today."}
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <Input
              label="Full Name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Sarah Jenkins"
            />

            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@example.com"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-[38px] text-stone hover:text-ink transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={passwordsMismatch ? "border-red-400 focus:ring-red-200" : ""}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-4 top-[38px] text-stone hover:text-ink transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {passwordsMismatch && (
                <p className="text-red-600 text-xs mt-2">Passwords do not match.</p>
              )}
            </div>

            {error && (
              <p className="text-red-600 text-xs bg-red-50 rounded-lg p-3">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-stone">
            Already have an account?
            <Link
              href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login"}
              className="text-accent font-bold hover:underline block mt-1"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
