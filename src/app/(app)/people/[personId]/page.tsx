
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSignedMemoryUrl } from "@/lib/getSignedMemoryUrl";
import Link from "next/link";
import { Camera, Play, Pause, UserPlus, Copy, Check, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Person, Memory } from "@/lib/types";

const TABS = ["Timeline", "Voice Memories"] as const;
type Tab = (typeof TABS)[number];

function relationshipLabel(r: string) {
  return r.replace("_", " / ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function PersonProfilePage() {
  const params = useParams();
  const router = useRouter();
  const personId = params.personId as string;

  const [person, setPerson] = useState<Person | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [circleNames, setCircleNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("Timeline");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, [personId]);

  async function fetchData() {
    const supabase = createClient();
    const { data: personData, error: personError } = await supabase
      .from("people")
      .select("*")
      .eq("id", personId)
      .single();

    if (personError || !personData) {
      router.replace("/home");
      return;
    }

    let livePerson = personData;
    if (personData.linked_user_id) {
      const { data: liveProfile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", personData.linked_user_id)
        .maybeSingle();
      if (liveProfile) {
        livePerson = {
          ...personData,
          name: liveProfile.full_name || personData.name,
          photo_url: personData.photo_url || liveProfile.avatar_url || null,
        };
      }
    }
    setPerson(livePerson);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: memoriesData } = await supabase
      .from("memories")
      .select("*")
      .eq("person_id", personId);

    let reverse: Memory[] = [];
    if (user && personData.linked_user_id) {
      const { data: theirRowForMe } = await supabase
        .from("people")
        .select("id")
        .eq("owner_id", personData.linked_user_id)
        .eq("linked_user_id", user.id);

      const ids = (theirRowForMe || []).map((p) => p.id);
      if (ids.length > 0) {
        const { data } = await supabase
          .from("memories")
          .select("*")
          .in("person_id", ids)
          .eq("shared_with_person", true);
        reverse = data || [];
      }
    }

    const memoriesList = Array.from(
      new Map([...(memoriesData || []), ...reverse].map((m) => [m.id, m])).values()
    ).sort(
      (a, b) => new Date(b.memory_date).getTime() - new Date(a.memory_date).getTime()
    );
    setMemories(memoriesList);

    const creatorIds = Array.from(
      new Set(memoriesList.map((m) => m.creator_id).filter(Boolean))
    ) as string[];
    if (creatorIds.length > 0) {
      const { data: creatorProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);
      setCreatorNames(
        Object.fromEntries(
          (creatorProfiles || []).map((p) => [p.id, p.full_name || "Someone"])
        )
      );
    }

    const circleIds = Array.from(
      new Set(memoriesList.map((m) => m.circle_id).filter(Boolean))
    ) as string[];
    if (circleIds.length > 0) {
      const { data: circlesData } = await supabase
        .from("circles")
        .select("id, name")
        .in("id", circleIds);
      setCircleNames(Object.fromEntries((circlesData || []).map((c) => [c.id, c.name])));
    }

    setLoading(false);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !person) return;

    setUploadingAvatar(true);
    const supabase = createClient();
    const fileExt = file.name.split(".").pop();
    const filePath = `${person.owner_id}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file);

    if (uploadError) {
      setUploadingAvatar(false);
      alert("Error uploading photo: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from("people")
      .update({ photo_url: urlData.publicUrl })
      .eq("id", person.id);

    setUploadingAvatar(false);

    if (updateError) {
      alert("Error saving photo: " + updateError.message);
      return;
    }

    setPerson({ ...person, photo_url: urlData.publicUrl });
  }

  async function handleCreateInvite() {
    if (!person) return;
    setCreatingInvite(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error } = await supabase
      .from("person_invites")
      .insert({
        person_id: person.id,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("*")
      .single();

    setCreatingInvite(false);

    if (error || !invite) {
      alert("Couldn't create an invite link. Please try again.");
      return;
    }

    setInviteLink(`${window.location.origin}/join-person/${invite.token}`);
  }

  function copyInviteLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDeletePerson() {
    if (!person) return;
    setDeleting(true);
    setDeleteError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: memoriesError } = await supabase
      .from("memories")
      .delete()
      .eq("person_id", person.id);

    if (memoriesError) {
      setDeleting(false);
      setDeleteError("Couldn't delete right now. Please try again.");
      return;
    }

    await supabase.from("person_invites").delete().eq("person_id", person.id);

    if (person.linked_user_id && user) {
      await supabase
        .from("connections")
        .delete()
        .or(
          `and(user_a.eq.${user.id},user_b.eq.${person.linked_user_id}),and(user_a.eq.${person.linked_user_id},user_b.eq.${user.id})`
        );
      await supabase
        .from("friend_requests")
        .delete()
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${person.linked_user_id}),and(sender_id.eq.${person.linked_user_id},receiver_id.eq.${user.id})`
        );
    }

    const { error: personDeleteError } = await supabase
      .from("people")
      .delete()
      .eq("id", person.id);

    setDeleting(false);

    if (personDeleteError) {
      setDeleteError("Couldn't delete right now. Please try again.");
      return;
    }

    router.replace("/home");
  }

  if (loading || !person) {
    return (
      <main className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  const photoCount = memories.filter((m) => m.type === "photo").length;
  const voiceCount = memories.filter((m) => m.type === "voice").length;
  const lastMemory = memories[0];

  const gapDays = lastMemory ? daysSince(lastMemory.memory_date) : null;
  const showGapBanner = gapDays === null || gapDays >= 7;

  const memoriesByYear = memories.reduce<Record<string, Memory[]>>((acc, m) => {
    const year = new Date(m.memory_date).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(m);
    return acc;
  }, {});
  const years = Object.keys(memoriesByYear).sort(
    (a, b) => Number(b) - Number(a),
  );

  const voiceMemories = memories.filter((m) => m.type === "voice");

  return (
    <main className="pb-24 lg:pb-12">
      <header className="bg-paper border-b border-line px-4 sm:px-8 md:px-12 pt-8 sm:pt-16 md:pt-20 pb-8 sm:pb-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="relative">
            {person.photo_url ? (
              <img
                src={person.photo_url}
                alt={person.name}
                className="w-28 h-28 sm:w-40 sm:h-40 rounded-full object-cover border-4 sm:border-8 border-white shadow-xl"
              />
            ) : (
              <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full bg-clay border-4 sm:border-8 border-white shadow-xl flex items-center justify-center font-serif text-4xl text-ink">
                {person.name.charAt(0).toUpperCase()}
              </div>
            )}
            <label className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-9 h-9 sm:w-10 sm:h-10 bg-accent text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all border-4 border-white cursor-pointer">
              <Camera size={13} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
            </label>
          </div>

          <div className="flex-1 text-center md:text-left space-y-3 sm:space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-2 sm:gap-4">
              <h1 className="text-2xl sm:text-4xl font-serif text-ink">
                {person.name}
              </h1>
              <span className="inline-block px-3 py-1 bg-white/50 rounded-full text-[10px] font-bold text-stone uppercase tracking-widest border border-line w-fit mx-auto md:mx-0">
                {relationshipLabel(person.relationship)}
              </span>
            </div>
            {person.bio && (
              <p className="text-stone max-w-xl leading-relaxed text-sm">
                {person.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-6 sm:gap-8 pt-2 sm:pt-4 justify-center md:justify-start">
              <div className="text-center md:text-left">
                <p className="text-lg sm:text-xl font-serif italic text-ink">
                  {memories.length}
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone uppercase tracking-widest font-bold">
                  Memories
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-lg sm:text-xl font-serif italic text-ink">
                  {photoCount}
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone uppercase tracking-widest font-bold">
                  Photos
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-lg sm:text-xl font-serif italic text-ink">
                  {voiceCount}
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone uppercase tracking-widest font-bold">
                  Voices
                </p>
              </div>
              <div className="text-center md:text-left">
                <p className="text-lg sm:text-xl font-serif italic text-accent">
                  {gapDays !== null ? `${gapDays}d ago` : "—"}
                </p>
                <p className="text-[9px] sm:text-[10px] text-stone uppercase tracking-widest font-bold">
                  Last Capture
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Link
              href={`/capture?personId=${person.id}`}
              className="flex-1 md:flex-none text-center bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-105 transition-all"
            >
              Add Memory
            </Link>
            {!person.linked_user_id && (
              <button
                onClick={() => setShowInvite(true)}
                className="flex-1 md:flex-none text-center bg-white border border-line text-stone px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-paper transition-all flex items-center justify-center gap-2"
              >
                <UserPlus size={12} /> Invite {person.name}
              </button>
            )}
            {person.linked_user_id && (
              <span className="flex-1 md:flex-none text-center bg-accent/10 text-accent px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                <Check size={12} /> Joined
              </span>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 md:flex-none text-center text-stone/70 hover:text-red-500 px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={11} /> Delete {person.name}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 md:px-12 py-8 sm:py-12">
        <nav className="flex gap-6 sm:gap-10 border-b border-line mb-8 sm:mb-12 overflow-x-auto pb-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? "text-accent border-b-2 border-accent"
                  : "text-stone hover:text-ink"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {showGapBanner && (
          <div className="bg-amber-50 rounded-3xl p-5 sm:p-6 border border-amber-100 mb-8 sm:mb-12 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-amber-500 shadow-sm shrink-0">
              <Camera size={16} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900 mb-1">
                {lastMemory ? "A small gap in the story..." : "No memories yet"}
              </h3>
              <p className="text-xs text-amber-700 leading-relaxed">
                {lastMemory
                  ? `You have ${memories.length} memories with ${person.name}, but nothing from the last ${gapDays} days. How about capturing something today?`
                  : `Start ${person.name}'s story with your first memory.`}
              </p>
            </div>
            <Link
              href={`/capture?personId=${person.id}`}
              className="bg-amber-500 text-white px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 transition-colors shrink-0"
            >
              Add Memory
            </Link>
          </div>
        )}

        {activeTab === "Timeline" && (
          <div className="space-y-10 sm:space-y-12">
            {years.length === 0 ? (
              <p className="text-center text-stone text-sm py-12">
                Nothing captured yet. Every relationship is a library of stories —
                start writing this one.
              </p>
            ) : (
              years.map((year) => (
                <div key={year}>
                  <div className="relative pl-10 sm:pl-12 mb-6 sm:mb-8">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 sm:w-8 h-[1px] bg-line" />
                    <span className="text-[10px] font-bold text-stone uppercase tracking-[0.3em]">
                      {year}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 relative">
                    <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-line" />

                    {memoriesByYear[year].map((memory, index) => {
                      const isRightColumn = index % 2 === 1;
                      return (
                        <div
                          key={memory.id}
                          className={`relative ${isRightColumn ? "md:mt-16" : ""}`}
                        >
                          <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent z-10" />
                          <MemoryCard memory={memory} personName={person.name} circleNames={circleNames} creatorNames={creatorNames} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "Voice Memories" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
            {voiceMemories.length === 0 ? (
              <p className="text-center text-stone text-sm py-12 md:col-span-2">
                No voice memories yet. Record {person.name}&apos;s voice while you still can.
              </p>
            ) : (
              voiceMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} personName={person.name} circleNames={circleNames} creatorNames={creatorNames} />
              ))
            )}
          </div>
        )}
        {showInvite && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl overflow-hidden max-w-md w-full p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg italic text-ink">
                  Invite {person.name}
                </h3>
                <button
                  onClick={() => {
                    setShowInvite(false);
                    setInviteLink(null);
                  }}
                  className="text-stone hover:text-ink transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-stone text-xs leading-relaxed">
                Send this link to {person.name}. Once they sign up and open it,
                they&apos;ll be able to see and add their own memories here too.
              </p>

              {inviteLink ? (
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="w-full bg-paper border border-line rounded-xl px-4 py-4 text-xs font-mono text-stone pr-12 truncate"
                  />
                  <button
                    onClick={copyInviteLink}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-accent hover:text-ink transition-colors"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCreateInvite}
                  disabled={creatingInvite}
                  className="w-full bg-accent text-white py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 disabled:opacity-50"
                >
                  {creatingInvite ? "Creating..." : "Create Invite Link"}
                </button>
              )}
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl overflow-hidden max-w-sm w-full p-6 sm:p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto">
                <Trash2 size={18} />
              </div>
              <h3 className="font-serif text-lg italic text-ink">
                Delete {person.name}?
              </h3>
              <p className="text-stone text-xs leading-relaxed">
                This removes {person.name} completely, along with every memory
                you&apos;ve saved about them (
                {memories.some((m) => m.person_id === person.id)
                  ? "including photos, voices, and notes"
                  : "nothing captured yet"}
                ). This can&apos;t be undone.
              </p>

              {deleteError && (
                <p className="text-red-600 text-xs bg-red-50 rounded-xl p-3">{deleteError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 bg-paper border border-line text-ink py-3 rounded-full text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeletePerson}
                  disabled={deleting}
                  className="flex-1 bg-red-500 text-white py-3 rounded-full text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function shareLabel(
  memory: Memory,
  personName: string,
  circleNames: Record<string, string>
): string {
  const sharedWithPerson = (memory as Memory & { shared_with_person?: boolean })
    .shared_with_person;

  if (memory.circle_id) return `Shared in ${circleNames[memory.circle_id] || "a Circle"}`;
  if (memory.is_shared) return "Shared with Family Circle";
  if (sharedWithPerson) return `Shared with ${personName}`;
  return "Private — just for you";
}

function MemoryCard({
  memory,
  personName,
  circleNames,
  creatorNames,
}: {
  memory: Memory;
  personName: string;
  circleNames: Record<string, string>;
  creatorNames: Record<string, string>;
}) {
  const label = shareLabel(memory, personName, circleNames);
  const liveCreatorName = creatorNames[memory.creator_id] || memory.creator_name;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (memory.media_url) {
      getSignedMemoryUrl(memory.media_url).then(setSignedUrl);
    }
  }, [memory.media_url]);

  const dateLabel = new Date(memory.memory_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (memory.type === "photo" && signedUrl) {
    return (
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-sm border border-line hover:shadow-xl transition-all">
        <img
          className="w-full aspect-[4/3] rounded-2xl sm:rounded-[1.5rem] object-cover mb-3 sm:mb-4"
          src={signedUrl}
          alt={memory.caption || ""}
        />
        <div className="px-1 sm:px-2">
          {liveCreatorName && (
            <p className="text-[9px] text-stone/70 italic mb-1">
              Added by {liveCreatorName}
            </p>
          )}
          <div className="flex justify-between items-center mb-2">
            {memory.caption && (
              <h4 className="font-serif text-base sm:text-lg italic text-ink truncate min-w-0">
                {memory.caption}
              </h4>
            )}
            <span className="text-[10px] text-stone font-bold shrink-0 ml-2">
              {dateLabel.toUpperCase()}
            </span>
          </div>
          {memory.location && (
            <p className="text-xs text-stone">{memory.location}</p>
          )}
          <p className="text-[9px] text-stone/70 uppercase tracking-widest font-bold mt-2">
            {label}
          </p>
        </div>
      </div>
    );
  }

  if (memory.type === "video" && signedUrl) {
    return (
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-sm border border-line hover:shadow-xl transition-all">
        <video
          src={signedUrl}
          controls
          className="w-full aspect-[4/3] rounded-2xl sm:rounded-[1.5rem] object-cover mb-3 sm:mb-4 bg-black"
        />
        <div className="px-1 sm:px-2">
          {liveCreatorName && (
            <p className="text-[9px] text-stone/70 italic mb-1">
              Added by {liveCreatorName}
            </p>
          )}
          <div className="flex justify-between items-center mb-2">
            {memory.caption && (
              <h4 className="font-serif text-base sm:text-lg italic text-ink truncate min-w-0">
                {memory.caption}
              </h4>
            )}
            <span className="text-[10px] text-stone font-bold shrink-0 ml-2">
              {dateLabel.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (memory.type === "voice" && signedUrl) {
    return (
      <VoiceMemoryCard
        memory={memory}
        signedUrl={signedUrl}
        dateLabel={dateLabel}
        creatorName={liveCreatorName}
      />
    );
  }

  return (
    <div className="self-start bg-paper border border-line rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 italic text-center overflow-hidden">
      {liveCreatorName && (
        <p className="text-[9px] text-stone/70 italic mb-2 not-italic">
          Added by {liveCreatorName}
        </p>
      )}
      <p
        dir="auto"
        className="text-ink text-base sm:text-lg leading-relaxed mb-4 sm:mb-6 font-serif break-words whitespace-pre-wrap"
      >
        &ldquo;{memory.caption}&rdquo;
      </p>
      <span className="text-[10px] text-stone not-italic font-bold uppercase tracking-[0.2em]">
        {dateLabel.toUpperCase()}
      </span>
    </div>
  );
}

function VoiceMemoryCard({
  memory,
  signedUrl,
  dateLabel,
  creatorName,
}: {
  memory: Memory;
  signedUrl: string;
  dateLabel: string;
  creatorName?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(memory.duration_seconds || 0);

  const barHeights = useRef(
    Array.from({ length: 28 }, (_, i) => {
      const seed = memory.id.charCodeAt(i % memory.id.length) + i * 17;
      return 20 + (seed % 100) * 0.6;
    })
  ).current;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }

  function handleWaveformClick(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const time = ratio * duration;
    audio.currentTime = time;
    setCurrentTime(time);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const progressPercent = duration > 0 ? currentTime / duration : 0;
  const activeBarCount = Math.round(progressPercent * barHeights.length);

  return (
    <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-sm border border-line hover:shadow-xl transition-all">
      <audio ref={audioRef} src={signedUrl} preload="metadata" className="hidden" />

      {creatorName && (
        <p className="text-[9px] text-stone/70 italic mb-2">
          Added by {creatorName}
        </p>
      )}

      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <button
          onClick={togglePlay}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 hover:bg-accent/20 transition-colors"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
        </button>
        <div className="min-w-0">
          <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
            {memory.caption || "Voice memory"}
          </h4>
          <p className="text-[10px] text-accent font-bold uppercase tracking-widest">
            Voice Memory • {formatTime(duration)}
          </p>
        </div>
      </div>

      <div
        onClick={handleWaveformClick}
        className="h-10 sm:h-12 flex items-center gap-1 sm:gap-1.5 mb-4 sm:mb-6 px-1 cursor-pointer"
      >
        {barHeights.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors ${
              i < activeBarCount ? "bg-accent" : "bg-line"
            }`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      <div className="flex justify-between items-center text-[10px] text-stone font-bold">
        <span>
          {formatTime(currentTime)} / {dateLabel.toUpperCase()}
        </span>
        {memory.is_shared && (
          <span className="uppercase tracking-widest">Family Circle Shared</span>
        )}
      </div>
    </div>
  );
}