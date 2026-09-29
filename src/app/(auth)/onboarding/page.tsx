"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Camera, Plus, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";

const RELATIONSHIPS = [
  "parent", "grandparent", "sibling",
  "spouse_partner", "child", "friend", "relative", "other",
] as const;

interface DraftPerson {
  name: string;
  relationship: string;
  photoFile: File | null;
  photoPreview: string | null;
}

function emptyPerson(): DraftPerson {
  return { name: "", relationship: "", photoFile: null, photoPreview: null };
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [people, setPeople] = useState<DraftPerson[]>([emptyPerson()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  function updatePerson(index: number, field: "name" | "relationship", value: string) {
    setPeople((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function handlePhotoSelected(index: number, file: File | null) {
    if (!file) return;
    setRawImageSrc(URL.createObjectURL(file));
    setCroppingIndex(index);
  }

  function handleCropDone(croppedFile: File) {
    if (croppingIndex === null) return;
    const index = croppingIndex;
    setPeople((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (p.photoPreview) URL.revokeObjectURL(p.photoPreview);
        return {
          ...p,
          photoFile: croppedFile,
          photoPreview: URL.createObjectURL(croppedFile),
        };
      })
    );
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
    setCroppingIndex(null);
  }

  function handleCropCancel() {
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
    setCroppingIndex(null);
  }

  function addPersonRow() {
    setPeople((prev) => [...prev, emptyPerson()]);
  }

  function removePersonRow(index: number) {
    setPeople((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFinish() {
    setError(null);

    const hasPhotoNoName = people.some(
      (p) => p.photoFile && p.name.trim().length === 0
    );
    if (hasPhotoNoName) {
      setError(
        "One of the people you added has a photo but no name. Please add a name, or remove that card."
      );
      return;
    }

    const hasNameNoRelationship = people.some(
      (p) => p.name.trim().length > 0 && p.relationship.trim().length === 0
    );
    if (hasNameNoRelationship) {
      setError(
        "Please choose how you're connected to everyone you've named."
      );
      return;
    }

    const validPeople = people.filter((p) => p.name.trim().length > 0);
    if (validPeople.length === 0) {
      router.push("/home");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You're not logged in. Please log in again.");
      setSaving(false);
      return;
    }

    const rowsToInsert = [];
    for (const person of validPeople) {
      let photoUrl: string | null = null;
      if (person.photoFile) {
        const fileExt = person.photoFile.name.split(".").pop();
        const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, person.photoFile);
        if (uploadError) {
          setError(`Failed to upload photo for ${person.name}: ${uploadError.message}`);
          setSaving(false);
          return;
        }
        const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
        photoUrl = publicUrlData.publicUrl;
      }
      rowsToInsert.push({
        owner_id: user.id,
        name: person.name.trim(),
        relationship: person.relationship,
        photo_url: photoUrl,
      });
    }

    const { error: insertError } = await supabase.from("people").insert(rowsToInsert);
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push("/home");
  }

  return (
    <div className="antialiased min-h-screen flex items-center justify-center p-3 sm:p-6">
      <div className="max-w-[800px] w-full bg-white rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-hidden border border-line p-5 sm:p-10 md:p-20 text-center">
        <div className="max-w-xl mx-auto">
          <span className="font-serif text-accent italic mb-4 sm:mb-6 block text-lg sm:text-xl">Starting your story</span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif mb-5 sm:mb-8 leading-tight">
            Who are the people you want to remember every moment with?
          </h1>
          <p className="text-stone text-sm sm:text-base mb-8 sm:mb-12 leading-relaxed">
            Add the people who matter most. We&apos;ll help you capture small, beautiful memories with them before they&apos;re gone.
          </p>

          <div className="space-y-8 sm:space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {people.map((person, index) => (
                <div
                  key={index}
                  className="bg-paper rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-line flex items-center gap-3 sm:gap-4 text-left group hover:border-accent/30 transition-all cursor-pointer relative"
                >
                  <label className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-clay flex items-center justify-center border-2 border-white shadow-sm overflow-hidden shrink-0 cursor-pointer">
                    {person.photoPreview ? (
                      <img className="w-full h-full object-cover" src={person.photoPreview} alt="" />
                    ) : (
                      <Camera size={16} className="text-line sm:w-[18px] sm:h-[18px]" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoSelected(index, e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="Robert (Dad)"
                      value={person.name}
                      onChange={(e) => updatePerson(index, "name", e.target.value)}
                      className="bg-transparent border-none focus:ring-0 font-serif text-base sm:text-lg text-ink p-0 w-full mb-1 outline-none truncate"
                    />
                    <Select
                      value={person.relationship}
                      onChange={(value) => updatePerson(index, "relationship", value)}
                      options={RELATIONSHIPS.map((r) => ({ value: r, label: r.replace("_", " / ") }))}
                      variant="ghost"
                      placeholder="Relationship"
                    />
                  </div>
                  {people.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePersonRow(index)}
                      className="text-stone/40 hover:text-accent shrink-0"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addPersonRow}
                className="border-2 border-dashed border-line rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4 text-left group hover:border-accent hover:bg-paper transition-all"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center border-2 border-line text-line group-hover:text-accent group-hover:border-accent transition-all shrink-0">
                  <Plus size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-serif text-base sm:text-lg text-stone group-hover:text-ink transition-colors">Add Someone</p>
                  <p className="text-[10px] font-bold text-stone/40 uppercase tracking-widest group-hover:text-stone transition-colors">
                    Mom, Sibling, Friend...
                  </p>
                </div>
              </button>
            </div>

            {error && <p className="text-red-600 text-xs bg-red-50 rounded-lg p-3">{error}</p>}

            <div className="pt-4 sm:pt-8 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
              <button
                type="button"
                onClick={() => router.push("/home")}
                className="text-stone text-xs font-bold uppercase tracking-widest hover:text-ink transition-colors order-2 md:order-1"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="w-full md:w-auto bg-ink text-white px-8 sm:px-12 py-4 sm:py-5 rounded-full font-bold uppercase tracking-widest text-xs shadow-xl shadow-ink/10 hover:bg-accent transition-all hover:scale-105 inline-block disabled:opacity-50 order-1 md:order-2"
              >
                {saving ? "Saving..." : "I'm Ready"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {croppingIndex !== null && rawImageSrc && (
        <ImageCropperModal
          imageSrc={rawImageSrc}
          onCancel={handleCropCancel}
          onCropDone={handleCropDone}
        />
      )}
    </div>
  );
}