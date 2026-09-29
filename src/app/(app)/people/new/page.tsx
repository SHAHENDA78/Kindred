"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Camera, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";

const RELATIONSHIPS = [
  "parent",
  "sibling",
  "spouse_partner",
  "child",
  "grandparent",
  "grandchild",
  "friend",
  "relative",
  "other",
];

function relationshipLabel(r: string) {
  return r.replace("_", " / ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AddPersonPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [bio, setBio] = useState("");

  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhotoSelect(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  }

  function handleCroppedAvatar(file: File) {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setCropModalOpen(false);
  }

  async function handleSave() {
    setError(null);

    if (!name.trim()) {
      setError("Please enter a name.");
      return;
    }
    if (!relationship) {
      setError("Please choose a relationship.");
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You're not logged in. Please log in again.");
      setSaving(false);
      return;
    }

    let photoUrl: string | null = null;

    if (avatarFile) {
      const filePath = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile);

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      photoUrl = urlData.publicUrl;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("people")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        relationship,
        photo_url: photoUrl,
        bio: bio.trim() || null,
      })
      .select("id")
      .single();

    setSaving(false);

    if (insertError || !inserted) {
      setError(insertError?.message ?? "Something went wrong. Please try again.");
      return;
    }

    router.replace(`/people/${inserted.id}`);
  }

  const FormFields = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt=""
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-clay flex items-center justify-center text-stone border-4 border-white shadow-xl">
              <Heart size={26} strokeWidth={1.5} />
            </div>
          )}
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center shadow-md border-2 border-white cursor-pointer hover:scale-110 transition-all">
            <Camera size={12} />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <span className="text-[10px] text-stone font-bold uppercase tracking-widest">
          {avatarPreview ? "Change photo" : "Add a photo, if you have one"}
        </span>
      </div>

      <div>
        <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
          What&apos;s their name?
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Robert"
          className="w-full bg-paper border border-line rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm font-serif italic text-lg text-ink placeholder:not-italic placeholder:font-sans placeholder:text-sm"
        />
      </div>

      <div>
        <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
          How are you connected? <span className="text-accent">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {RELATIONSHIPS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRelationship(r)}
              className={`border rounded-2xl py-3 px-2 text-[10px] font-bold uppercase tracking-tighter transition-all ${
                relationship === r
                  ? "bg-accent text-white border-accent shadow-md shadow-accent/20"
                  : "border-line hover:bg-paper text-ink bg-white"
              }`}
            >
              {relationshipLabel(r)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
          What makes them, them?
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Born in Seattle, 1958. Lover of jazz and bad puns..."
          className="w-full bg-paper border border-line rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none"
        />
      </div>

      {error && (
        <p className="text-red-600 text-xs bg-red-50 rounded-lg p-3">{error}</p>
      )}
    </div>
  );

  return (
    <>
      <div className="md:hidden bg-cream min-h-screen">
        <div className="relative px-4 pt-8 pb-8 text-center overflow-hidden">
          <img
            className="absolute inset-0 w-full h-full object-cover opacity-[0.07] pointer-events-none"
            src="https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_9d63a7bfe4_33e039bc9ea33b03.png"
            alt=""
          />
          <div className="relative z-10">
            <Link
              href="/home"
              className="inline-flex w-9 h-9 rounded-full bg-white shadow-sm border border-line items-center justify-center text-stone mb-6 active:scale-95 transition-transform"
            >
              <ChevronLeft size={14} />
            </Link>
            <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-2">
              A New Story Begins
            </span>
            <h1 className="text-2xl font-serif italic text-ink leading-snug">
              Who do you want to
              <br />
              hold onto?
            </h1>
          </div>
        </div>

        <div className="px-4 pb-6">
  {FormFields()}

  <div className="flex gap-3 pt-6">
    <Link
      href="/home"
      className="flex-1 bg-paper border border-line text-stone py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] text-center active:scale-[0.98] transition-all"
    >
      Cancel
    </Link>
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      className="flex-[2] bg-accent text-white py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 active:scale-[0.98] transition-all disabled:opacity-50"
    >
      {saving ? "Saving..." : "Begin Their Story"}
    </button>
  </div>
</div>

      </div>

      <div className="hidden md:flex bg-ink/5 min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-[1000px] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-row border border-line min-h-[640px]">
          <div className="w-2/5 bg-paper relative flex flex-col items-center justify-center p-12 border-r border-line overflow-hidden text-center">
            <img
              className="absolute inset-0 w-full h-full object-cover opacity-10"
              src="https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_9d63a7bfe4_33e039bc9ea33b03.png"
              alt=""
            />
            <div className="absolute top-8 left-8 z-10">
              <Link
                href="/home"
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-stone hover:text-accent transition-colors"
              >
                <ChevronLeft size={14} />
              </Link>
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-6">
                <Heart size={22} strokeWidth={1.5} />
              </div>
              <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-3">
                A New Story Begins
              </span>
              <h1 className="text-3xl font-serif italic text-ink leading-snug mb-4">
                Who do you want
                <br />
                to hold onto?
              </h1>
              <p className="text-sm text-stone leading-relaxed max-w-[220px] mx-auto">
                Every memory you save becomes part of their story — one you can
                return to, always.
              </p>
            </div>
          </div>

          <div className="w-3/5 p-12 overflow-y-auto">
            {FormFields()}

            <div className="pt-6 flex gap-4">
              <Link
                href="/home"
                className="flex-1 bg-paper border border-line text-stone py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-clay transition-all text-center"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] bg-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Begin Their Story"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {cropModalOpen && rawImageSrc && (
        <ImageCropperModal
          imageSrc={rawImageSrc}
          aspect={1}
          cropShape="round"
          outputFileName="avatar.jpg"
          onCancel={() => setCropModalOpen(false)}
          onCropDone={handleCroppedAvatar}
        />
      )}
    </>
  );
}