"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, LogOut, Settings as SettingsIcon, KeyRound, Calendar, Sparkles, Users } from "lucide-react";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [joinedDate, setJoinedDate] = useState("");
  const [peopleCount, setPeopleCount] = useState(0);
  const [memoriesCount, setMemoriesCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState("");
    const [passwordError, setPasswordError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setName(user.user_metadata?.full_name || "");
      setEmail(user.email || "");
      setAvatarUrl(user.user_metadata?.avatar_url || "");
      setJoinedDate(
        new Date(user.created_at).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      );

      const { count: pCount } = await supabase
        .from("people")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user.id);
      setPeopleCount(pCount || 0);

      const { count: mCount } = await supabase
        .from("memories")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", user.id);
      setMemoriesCount(mCount || 0);

      setLoading(false);
    }
    fetchData();
  }, []);

    function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  }

  async function handleCroppedAvatar(file: File) {
    setCropModalOpen(false);
    setUploadingAvatar(true);
    setMessage("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file);

    if (uploadError) {
      setUploadingAvatar(false);
      setMessage("Error uploading photo: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
    await supabase.from("profiles").upsert({ id: user.id, avatar_url: publicUrl });

    setUploadingAvatar(false);
    setAvatarUrl(publicUrl);
    setMessage("Profile photo updated.");
  }

    async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const extensions = ["jpg", "jpeg", "png", "webp"];
    for (const ext of extensions) {
      await supabase.storage.from("avatars").remove([`${user.id}/avatar.${ext}`]);
    }

    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: null },
    });
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);

    setUploadingAvatar(false);
    if (error) {
      setMessage("Error removing photo: " + error.message);
      return;
    }

    setAvatarUrl("");
    setMessage("Profile photo removed.");
  }

async function handleSave() {
  setSaving(true);
  setMessage("");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    setSaving(false);
    return;
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { full_name: name },
  });

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, full_name: name });

  setSaving(false);

  if (authError || profileError) {
    setMessage("Error saving: " + (authError?.message || profileError?.message));
    return;
  }
  setMessage("Profile updated.");
}

    async function handleChangePassword() {
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    setPasswordError("");
    setChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }
    setNewPassword("");
    setShowPasswordField(false);
    setMessage("Password updated successfully.");
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initial = name.charAt(0).toUpperCase() || "?";

  if (loading) {
    return (
      <div className="p-6 sm:p-12 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="pb-24 lg:pb-12">
      <div className="relative overflow-hidden bg-paper px-4 sm:px-8 md:px-12 pt-14 sm:pt-20 pb-24 sm:pb-32 mb-[-60px] sm:mb-[-80px] border-b border-line">
        <svg
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 800 300"
        >
          <path
            d="M0 60 C 150 120, 250 20, 400 80 S 650 140, 800 90"
            stroke="#c36241"
            strokeWidth="1.5"
            strokeDasharray="2 8"
            fill="none"
            opacity="0.3"
          />
        </svg>
        <div className="relative z-10 max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em] block mb-4">
              Your Vault
            </span>
            <h1 className="text-3xl sm:text-5xl font-serif italic text-ink leading-[1.15]">
              {name || "Your Profile"}
            </h1>
          </div>
          <Link
            href="/settings"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-line flex items-center justify-center text-stone hover:text-accent hover:border-accent transition-all shrink-0"
            title="Settings"
          >
            <SettingsIcon size={16} />
          </Link>
        </div>
      </div>

      <div className="px-4 sm:px-8 md:px-12 max-w-2xl mx-auto relative z-10">
        {message && (
          <p className="mb-6 text-xs bg-accent/5 text-accent px-4 py-3 rounded-xl text-center">
            {message}
          </p>
        )}

        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-line shadow-xl shadow-ink/5 p-6 sm:p-10 space-y-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-clay border-4 border-white shadow-lg overflow-hidden flex items-center justify-center text-ink font-serif italic text-3xl ring-1 ring-line">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Your avatar" className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-9 h-9 bg-accent text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300 border-2 border-white disabled:opacity-50"
              >
                <Camera size={13} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="pt-1">
              <p className="text-sm font-bold text-ink mb-1">
                {uploadingAvatar ? "Uploading..." : "Profile Photo"}
              </p>
              <p className="text-xs text-stone mb-2 leading-relaxed">
                This is what family and friends will see when they connect with you.
              </p>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div className="h-px bg-line" />

          <div>
            <label className="text-[10px] font-bold text-stone uppercase tracking-widest mb-2 ml-1 block">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-paper border border-line rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone uppercase tracking-widest mb-2 ml-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-paper border border-line rounded-2xl px-5 py-3.5 opacity-60 cursor-not-allowed text-sm"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-accent text-white px-8 py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-[1.5rem] border border-line p-6 sm:p-8 text-center hover:shadow-md transition-shadow duration-300">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent mx-auto mb-3">
              <Users size={14} />
            </div>
            <p className="text-2xl font-serif italic text-ink">{peopleCount}</p>
            <p className="text-[10px] text-stone uppercase tracking-widest font-bold mt-1">
              People
            </p>
          </div>
          <div className="bg-white rounded-[1.5rem] border border-line p-6 sm:p-8 text-center hover:shadow-md transition-shadow duration-300">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent mx-auto mb-3">
              <Sparkles size={14} />
            </div>
            <p className="text-2xl font-serif italic text-ink">{memoriesCount}</p>
            <p className="text-[10px] text-stone uppercase tracking-widest font-bold mt-1">
              Memories
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-line shadow-sm p-6 sm:p-10 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
                <KeyRound size={13} />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Password</p>
                <p className="text-xs text-stone">Keep your vault secure.</p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordField((v) => !v)}
              className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline shrink-0"
            >
              {showPasswordField ? "Cancel" : "Change"}
            </button>
          </div>

                  {showPasswordField && (
            <div className="pl-12">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="flex-1 bg-paper border border-line rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm"
                />
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="bg-ink text-white px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all duration-300 disabled:opacity-50 shrink-0"
                >
                  {changingPassword ? "..." : "Update"}
                </button>
              </div>
              {passwordError && (
                <p className="text-red-600 text-xs mt-2">{passwordError}</p>
              )}
            </div>
          )}

          <div className="pt-6 border-t border-line flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Calendar size={13} />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">Member since</p>
              <p className="text-xs text-stone">{joinedDate}</p>
            </div>
          </div>

          <div className="pt-6 border-t border-line">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3.5 border border-line rounded-2xl text-xs font-bold uppercase tracking-widest text-stone hover:text-accent hover:border-accent hover:bg-paper transition-all duration-300"
            >
              <LogOut size={14} />
              Log out
            </button>
          </div>
        </div>
      </div>

            {cropModalOpen && rawImageSrc && (
        <ImageCropperModal
          imageSrc={rawImageSrc}
          aspect={1}
          cropShape="round"
          outputFileName="profile-avatar.jpg"
          onCancel={() => setCropModalOpen(false)}
          onCropDone={handleCroppedAvatar}
        />
      )}
    </main>
  );
}