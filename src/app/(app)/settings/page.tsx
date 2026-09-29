"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  ShieldCheck,
  Bell,
  Download,
  AlertTriangle,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateSalt, hashPin } from "@/lib/pinHash";
import JSZip from "jszip";
import { isBiometricAvailable, registerBiometric } from "@/lib/webauthn";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [showSetup, setShowSetup] = useState(false);
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribingPush, setSubscribingPush] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [settingUpBiometric, setSettingUpBiometric] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    setEmail(user.email || "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, pin_enabled, notifications_enabled ,biometric_enabled ")
      .eq("id", user.id)
      .maybeSingle();

    setFullName(profile?.full_name || user.user_metadata?.full_name || "");
    setAvatarUrl(profile?.avatar_url || null);
    setPinEnabled(!!profile?.pin_enabled);
    setNotificationsEnabled(profile?.notifications_enabled ?? true);
    setLoading(false);

    setBiometricEnabled(!!profile?.biometric_enabled);
    setBiometricAvailable(await isBiometricAvailable());
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setPushSupported(supported);
    if (supported) {
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      setPushSubscribed(!!existingSub);
    }
  }

  function handleDigit(digit: string) {
    if (pin.length >= 4) return;
    setPinError(null);
    const next = pin + digit;
    setPin(next);

    if (next.length === 4) {
      if (step === "enter") {
        setFirstPin(next);
        setStep("confirm");
        setPin("");
      } else {
        if (next !== firstPin) {
          setPinError("PINs don't match. Try again.");
          setStep("enter");
          setFirstPin("");
          setPin("");
          return;
        }
        savePin(next);
      }
    }
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1));
  }

  async function savePin(finalPin: string) {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const salt = generateSalt();
    const hash = await hashPin(finalPin, salt);

    await supabase
      .from("profiles")
      .upsert({ id: user.id, pin_hash: hash, pin_salt: salt, pin_enabled: true });

    setSaving(false);
    setPinEnabled(true);
    setShowSetup(false);
    setStep("enter");
    setFirstPin("");
    setPin("");
  }

  async function handleDisablePin() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").update({ pin_enabled: false }).eq("id", user.id);
    sessionStorage.removeItem("kindred_unlocked");
    setPinEnabled(false);
  }

  async function toggleNotifications() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    await supabase.from("profiles").upsert({ id: user.id, notifications_enabled: next });
  }

    function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  async function handleEnablePush() {
    setSubscribingPush(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setSubscribingPush(false);
      alert("Please allow notifications in your browser to enable this.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        "BHkqPJMTlF_rdhmxXsMALNU6SGK5UyfqWRafu1tVZcSu-F76sOQZTS1cyJXL5tJPTxkajO5Qb7v-F1vbA2lmOlU"
      ),
    });

    const json = subscription.toJSON();
    await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth_key: json.keys?.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

    setPushSubscribed(true);
    setSubscribingPush(false);
  }

  async function handleDisablePush() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const supabase = createClient();
      await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      await subscription.unsubscribe();
    }
    setPushSubscribed(false);
  }

   async function handleExportData() {
    setExporting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: people } = await supabase
      .from("people")
      .select("*")
      .eq("owner_id", user.id);

    const { data: memories } = await supabase
      .from("memories")
      .select("*")
      .eq("creator_id", user.id);

    const zip = new JSZip();
    const peopleList = people || [];
    const memoriesList = memories || [];

    const nameById = Object.fromEntries(peopleList.map((p) => [p.id, p.name]));

    const exportRows: Record<string, unknown>[] = [];

    setExportProgress({ current: 0, total: memoriesList.length });

    for (let i = 0; i < memoriesList.length; i++) {
      const memory = memoriesList[i];
      setExportProgress({ current: i + 1, total: memoriesList.length });
      const personFolder = memory.person_id
        ? (nameById[memory.person_id] || "unknown").replace(/[^a-z0-9]/gi, "_")
        : "family_circle";

      let fileName: string | null = null;

      if (memory.media_url) {
        const { data: signed } = await supabase.storage
          .from("memories")
          .createSignedUrl(memory.media_url, 60 * 5);

        if (signed?.signedUrl) {
          try {
            const res = await fetch(signed.signedUrl);
            const blob = await res.blob();
            const ext = memory.media_url.split(".").pop() || "dat";
            fileName = `${memory.memory_date}_${memory.id.slice(0, 8)}.${ext}`;
            zip.file(`${personFolder}/${fileName}`, blob);
          } catch {
          }
        }
      }

      exportRows.push({
        date: memory.memory_date,
        type: memory.type,
        caption: memory.caption,
        about: memory.person_id ? nameById[memory.person_id] || "Unknown" : "Family Circle",
        added_by: memory.creator_name,
        shared: memory.is_shared || memory.shared_with_person || !!memory.circle_id,
        file: fileName ? `${personFolder}/${fileName}` : null,
      });
    }

    zip.file(
      "memories.json",
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          account_email: user.email,
          people: peopleList.map((p) => ({ name: p.name, relationship: p.relationship })),
          memories: exportRows,
        },
        null,
        2
      )
    );

    setExportProgress({ current: memoriesList.length, total: memoriesList.length });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kindred-export-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    setExportProgress(null);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").update({ pending_deletion: true }).eq("id", user.id);
    await supabase.auth.signOut();

    setDeleting(false);
    router.replace("/login");
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

    async function handleEnableBiometric() {
    setSettingUpBiometric(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const credentialId = await registerBiometric(user.id, user.email || "");
    setSettingUpBiometric(false);

    if (!credentialId) {
      alert("Couldn't set up biometric unlock. Please try again.");
      return;
    }

    await supabase
      .from("profiles")
      .upsert({ id: user.id, webauthn_credential_id: credentialId, biometric_enabled: true });

    setBiometricEnabled(true);
  }

  async function handleDisableBiometric() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ biometric_enabled: false }).eq("id", user.id);
    setBiometricEnabled(false);
  }

  return (
    <main className="pb-24 lg:pb-12 max-w-2xl mx-auto px-4 sm:px-8 md:px-12 pt-10 sm:pt-16">
      <header className="mb-10">
        <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-2">
          Your Account
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif text-ink">Settings</h1>
      </header>

      <div className="space-y-6">
        <Link
          href="/profile"
          className="flex items-center gap-4 bg-white border border-line rounded-[2rem] p-5 sm:p-6 hover:shadow-md hover:border-accent/30 transition-all group"
        >
          <div className="w-14 h-14 rounded-full bg-clay border-4 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-serif italic text-xl text-ink">
                {fullName.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif italic text-lg text-ink truncate">
              {fullName || "Your name"}
            </p>
            <p className="text-xs text-stone truncate">{email}</p>
          </div>
          <ChevronRight
            size={16}
            className="text-stone group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0"
          />
        </Link>

        <div className="bg-white border border-line rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Lock size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Privacy Lock</p>
              <p className="text-xs text-stone">
                Require a PIN every time Kindred is opened.
              </p>
            </div>
          </div>
            
            
          {pinEnabled ? (
            <div className="flex items-center justify-between bg-paper rounded-2xl p-4">
              <span className="text-xs font-bold text-ink flex items-center gap-2">
                <ShieldCheck size={14} className="text-accent" /> PIN lock is on
              </span>
              <button
                onClick={handleDisablePin}
                className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
              >
                Turn off
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSetup(true)}
              className="w-full bg-accent text-white py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20"
            >
              Set Up a PIN
            </button>
          )}

          {pinEnabled && biometricAvailable && (
            <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Face ID / Touch ID</span>
              {biometricEnabled ? (
                <button
                  onClick={handleDisableBiometric}
                  className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
                >
                  Turn off
                </button>
              ) : (
                <button
                  onClick={handleEnableBiometric}
                  disabled={settingUpBiometric}
                  className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                >
                  {settingUpBiometric ? "Setting up..." : "Enable"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-line rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                <Bell size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Daily Nudge Reminders</p>
                <p className="text-xs text-stone">
                  A gentle reminder when it&apos;s been a while.
                </p>
              </div>
            </div>
            <button
              onClick={toggleNotifications}
              className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
                notificationsEnabled ? "bg-accent" : "bg-clay"
              }`}
            >
              <div
                className={`absolute top-[2px] w-5 h-5 bg-white rounded-full transition-all ${
                  notificationsEnabled ? "right-[2px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>
          {pushSupported && (
            <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-ink">Enable on this device</span>
              {pushSubscribed ? (
                <button
                  onClick={handleDisablePush}
                  className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline shrink-0"
                >
                  Turn off
                </button>
              ) : (
                <button
                  onClick={handleEnablePush}
                  disabled={subscribingPush}
                  className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50 shrink-0"
                >
                  {subscribingPush ? "Enabling..." : "Enable"}
                </button>
              )}
            </div>
          )}
          {!pushSupported && (
            <p className="text-[9px] text-stone/60 italic mt-4">
              Push notifications aren&apos;t supported on this browser/device.
            </p>
          )}
        </div>

        <div className="bg-white border border-line rounded-[2rem] p-6 sm:p-8 space-y-5">
          <p className="text-[10px] font-bold text-stone uppercase tracking-widest">
            Data &amp; Privacy
          </p>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-ink">Export your memories</p>
              <p className="text-xs text-stone">
                {exporting && exportProgress
                  ? `Preparing ${exportProgress.current} of ${exportProgress.total}...`
                  : "Download everything you've saved as a file."}
              </p>
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="bg-paper border border-line text-stone px-4 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-clay transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {exporting ? (
                <div className="w-3 h-3 border-2 border-stone/40 border-t-stone rounded-full animate-spin" />
              ) : (
                <Download size={12} />
              )}
              {exporting ? "Preparing..." : "Export"}
            </button>
          </div>

          <div className="pt-5 border-t border-line">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-sm font-bold text-ink">Danger zone</p>
            </div>
            <p className="text-xs text-stone mb-4">
              Deleting your account removes your access permanently. Your
              data will be scheduled for deletion.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
            >
              Delete my account
            </button>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-line rounded-2xl text-xs font-bold uppercase tracking-widest text-stone hover:text-accent hover:border-accent transition-all"
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>

      {showSetup && (
        <div className="fixed inset-0 bg-ink flex flex-col items-center justify-center p-6 z-50">
          <span className="font-serif text-2xl text-white tracking-tight mb-2">
            K<span className="text-accent">i</span>ndred
          </span>
          <p className="text-white/50 text-xs uppercase tracking-widest font-bold mb-10">
            {step === "enter" ? "Choose a 4-digit PIN" : "Confirm your PIN"}
          </p>

          {pinError && <p className="text-red-400 text-xs mb-6 -mt-4">{pinError}</p>}

          <div className="flex gap-4 mb-12">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 ${
                  i < pin.length ? "bg-accent border-accent" : "border-white/30"
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                disabled={saving}
                className="w-16 h-16 rounded-full bg-white/10 text-white text-xl font-serif italic hover:bg-white/20 transition-all flex items-center justify-center mx-auto disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <div />
            <button
              onClick={() => handleDigit("0")}
              disabled={saving}
              className="w-16 h-16 rounded-full bg-white/10 text-white text-xl font-serif italic hover:bg-white/20 transition-all flex items-center justify-center mx-auto disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              className="w-16 h-16 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all mx-auto text-xs font-bold uppercase"
            >
              Del
            </button>
          </div>

          <button
            onClick={() => {
              setShowSetup(false);
              setStep("enter");
              setPin("");
              setFirstPin("");
              setPinError(null);
            }}
            className="mt-10 text-white/40 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-sm w-full space-y-5">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-500" />
              <h3 className="font-serif text-lg italic text-ink">Delete your account?</h3>
            </div>
            <p className="text-stone text-xs leading-relaxed">
              This can&apos;t be undone. Type <strong>DELETE</strong> below to
              confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full bg-paper border border-line rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="flex-1 bg-paper border border-line text-stone py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-clay transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {deleting ? "..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}