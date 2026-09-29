"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { hashPin } from "@/lib/pinHash";
import { Delete } from "lucide-react";
import { isBiometricAvailable, verifyBiometric } from "@/lib/webauthn";

const SESSION_KEY = "kindred_unlocked";

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [pinSalt, setPinSalt] = useState<string | null>(null);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [tryingBiometric, setTryingBiometric] = useState(false);

  useEffect(() => {
    checkLock();
  }, []);

  async function checkLock() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setChecking(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("pin_enabled, pin_hash, pin_salt, biometric_enabled, webauthn_credential_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.pin_enabled || !profile.pin_hash || !profile.pin_salt) {
      setChecking(false);
      return;
    }

    const alreadyUnlocked = sessionStorage.getItem(SESSION_KEY) === "true";
    if (alreadyUnlocked) {
      setChecking(false);
      return;
    }

      if (profile.biometric_enabled && profile.webauthn_credential_id) {
      setBiometricEnabled(true);
      setBiometricCredentialId(profile.webauthn_credential_id);
      setBiometricAvailable(await isBiometricAvailable());
    }

    setPinHash(profile.pin_hash);
    setPinSalt(profile.pin_salt);
    setLocked(true);
    setChecking(false);
  }

  async function handleDigit(digit: string) {
    if (entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    setError(false);

    if (next.length === 4) {
      if (!pinSalt || !pinHash) return;
      const attemptHash = await hashPin(next, pinSalt);
      if (attemptHash === pinHash) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setLocked(false);
      } else {
        setError(true);
        setTimeout(() => setEntered(""), 400);
      }
    }
  }

    async function handleBiometricUnlock() {
    if (!biometricCredentialId) return;
    setTryingBiometric(true);
    const success = await verifyBiometric(biometricCredentialId);
    setTryingBiometric(false);

    if (success) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setLocked(false);
    }
  }

  function handleDelete() {
    setEntered((prev) => prev.slice(0, -1));
    setError(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!locked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-6">
      <span className="font-serif text-2xl text-white tracking-tight mb-2">
        K<span className="text-accent">i</span>ndred
      </span>
      <p className="text-white/50 text-xs uppercase tracking-widest font-bold mb-10">
        Enter your PIN
      </p>


            {biometricEnabled && biometricAvailable && (
        <button
          onClick={handleBiometricUnlock}
          disabled={tryingBiometric}
          className="mb-8 flex flex-col items-center gap-2 text-white/70 hover:text-white transition-colors disabled:opacity-50"
        >
          <div className="w-14 h-14 rounded-full border-2 border-white/30 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 3 4.58M12 2a5 5 0 0 1 5 5v5c0 3.5-2 6-5 7M7 9v2c0 4 2 7 5 8M4 9v2c0 6 3 9 8 10M17 7c0 3-1 5-2 6" />
            </svg>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest">
            {tryingBiometric ? "Verifying..." : "Use Face ID / Touch ID"}
          </span>
        </button>
      )}

      
      <div className={`flex gap-4 mb-12 ${error ? "animate-pulse" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 ${
              i < entered.length
                ? error
                  ? "bg-red-500 border-red-500"
                  : "bg-accent border-accent"
                : "border-white/30"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => handleDigit(d)}
            className="w-16 h-16 rounded-full bg-white/10 text-white text-xl font-serif italic hover:bg-white/20 transition-all flex items-center justify-center mx-auto"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => handleDigit("0")}
          className="w-16 h-16 rounded-full bg-white/10 text-white text-xl font-serif italic hover:bg-white/20 transition-all flex items-center justify-center mx-auto"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all mx-auto"
        >
          <Delete size={18} />
        </button>
      </div>
    </div>
  );
}