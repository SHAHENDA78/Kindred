"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSignedMemoryUrl } from "@/lib/getSignedMemoryUrl";
import { Memory } from "@/lib/types";
import { Play } from "lucide-react";

export default function TogetherPage() {
  const params = useParams();
  const router = useRouter();
  const otherUserId = params.userId as string;

  const [myName, setMyName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [otherUserId]);

  async function fetchData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    setMyName(user.user_metadata?.full_name?.split(" ")[0] || "You");

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    setMyAvatarUrl(myProfile?.avatar_url || null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", otherUserId)
      .maybeSingle();
    setOtherName(profile?.full_name?.split(" ")[0] || "Someone");
    setOtherAvatarUrl(profile?.avatar_url || null);

    const { data: myCircleRows } = await supabase
      .from("circles")
      .select("id")
      .eq("owner_id", user.id);
    const { data: myMembershipRows } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    const { data: otherCircleRows } = await supabase
      .from("circles")
      .select("id")
      .eq("owner_id", otherUserId);
    const { data: otherMembershipRows } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", otherUserId)
      .eq("status", "accepted");

    const myCircleIds = new Set([
      ...(myCircleRows || []).map((c) => c.id),
      ...(myMembershipRows || []).map((m) => m.circle_id),
    ]);
    const otherCircleIds = new Set([
      ...(otherCircleRows || []).map((c) => c.id),
      ...(otherMembershipRows || []).map((m) => m.circle_id),
    ]);

    const sharedCircleIds = [...myCircleIds].filter((id) => otherCircleIds.has(id));

    let circleMemories: Memory[] = [];
    if (sharedCircleIds.length > 0) {
      const { data } = await supabase
        .from("memories")
        .select("*")
        .in("circle_id", sharedCircleIds)
        .order("memory_date", { ascending: false });
      circleMemories = data || [];
    }

    const { data: peopleData } = await supabase
      .from("people")
      .select("*")
      .or(
        `and(owner_id.eq.${user.id},linked_user_id.eq.${otherUserId}),and(owner_id.eq.${otherUserId},linked_user_id.eq.${user.id})`
      );

    const directPersonIds = (peopleData || []).map((p) => p.id);

    let directMemories: Memory[] = [];
    if (directPersonIds.length > 0) {
      const { data } = await supabase
        .from("memories")
        .select("*")
        .in("person_id", directPersonIds)
        .eq("shared_with_person", true)
        .order("memory_date", { ascending: false });
      directMemories = data || [];
    }

    const combined = [...circleMemories, ...directMemories];
    const unique = Array.from(new Map(combined.map((m) => [m.id, m])).values());
    unique.sort(
      (a, b) => new Date(b.memory_date).getTime() - new Date(a.memory_date).getTime()
    );

    setMemories(unique);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  const photoCount = memories.filter((m) => m.type === "photo").length;
  const voiceCount = memories.filter((m) => m.type === "voice").length;
  const firstMemory = memories[memories.length - 1];
  const sinceLabel = firstMemory
    ? new Date(firstMemory.memory_date).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;

  const memoriesByYear = memories.reduce<Record<string, Memory[]>>((acc, m) => {
    const year = new Date(m.memory_date).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(m);
    return acc;
  }, {});
  const years = Object.keys(memoriesByYear).sort((a, b) => Number(b) - Number(a));

  return (
    <main className="pb-24 lg:pb-12 min-h-screen">
      <div className="relative overflow-hidden bg-paper px-4 sm:px-8 md:px-12 pt-16 sm:pt-20 pb-14 sm:pb-16 text-center border-b border-line">
        <div className="absolute -top-24 left-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 w-72 h-72 bg-accent/5 rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-lg mx-auto">
          <div className="flex items-center justify-center mb-8">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-ink flex items-center justify-center font-serif italic text-3xl text-white shadow-xl border-4 border-white relative z-10 overflow-hidden">
              {myAvatarUrl ? (
                <img src={myAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                myName.charAt(0).toUpperCase()
              )}
            </div>

            <svg
              width="72"
              height="24"
              viewBox="0 0 72 24"
              className="mx-[-8px] sm:mx-[-4px] relative z-0"
              fill="none"
            >
              <path
                d="M2 12C20 -4 36 28 70 12"
                stroke="#c36241"
                strokeWidth="2"
                strokeDasharray="1 6"
                strokeLinecap="round"
              />
            </svg>

            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-accent flex items-center justify-center font-serif italic text-3xl text-white shadow-xl border-4 border-white relative z-10">

              {otherAvatarUrl ? (
                <img src={otherAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                otherName.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em] block mb-3">
            A Shared Story
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif italic text-ink leading-tight mb-6">
            {myName} &amp; {otherName}
          </h1>

          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <div>
              <p className="text-lg sm:text-xl font-serif italic text-ink">
                {memories.length}
              </p>
              <p className="text-[9px] text-stone uppercase tracking-widest font-bold">
                Memories
              </p>
            </div>
            <div className="w-px h-8 bg-line" />
            <div>
              <p className="text-lg sm:text-xl font-serif italic text-ink">
                {photoCount + voiceCount}
              </p>
              <p className="text-[9px] text-stone uppercase tracking-widest font-bold">
                Photos &amp; Voices
              </p>
            </div>
            {sinceLabel && (
              <>
                <div className="w-px h-8 bg-line" />
                <div>
                  <p className="text-lg sm:text-xl font-serif italic text-accent">
                    {sinceLabel}
                  </p>
                  <p className="text-[9px] text-stone uppercase tracking-widest font-bold">
                    Since
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 md:px-12 py-12 sm:py-16">
        {years.length === 0 ? (
          <p className="text-stone text-sm text-center py-16 font-serif italic">
            Your story together hasn&apos;t begun yet — the first shared
            memory will show up here.
          </p>
        ) : (
          <div className="space-y-10 sm:space-y-12">
            {years.map((year) => (
              <div key={year}>
                <div className="relative pl-10 sm:pl-12 mb-6 sm:mb-8">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 sm:w-8 h-[1px] bg-line" />
                  <span className="text-[10px] font-bold text-stone uppercase tracking-[0.3em]">
                    {year}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                  {memoriesByYear[year].map((memory) => (
                    <TogetherMemoryCard key={memory.id} memory={memory} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TogetherMemoryCard({ memory }: { memory: Memory }) {
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
  const shareTag = memory.circle_id ? "Shared in your circle" : "Shared directly";
  const AuthorLabel = () => (
    <p className="text-[9px] text-stone/70 italic mb-2 not-italic font-bold uppercase tracking-widest">
      Added by {memory.creator_name || "Someone"}
    </p>
  );

  if (memory.type === "photo" && signedUrl) {
    return (
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-sm border border-line hover:shadow-xl transition-all">
        <img
          className="w-full aspect-[4/3] rounded-2xl object-cover mb-3 sm:mb-4"
          src={signedUrl}
          alt=""
        />
        <div className="px-1 sm:px-2">
          <p className="text-[9px] text-stone/70 uppercase tracking-widest font-bold mt-1">{shareTag}</p>
          <AuthorLabel />
          <div className="flex justify-between items-center">
            <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
              {memory.caption || ""}
            </h4>
            <span className="text-[10px] text-stone font-bold shrink-0 ml-2">
              {dateLabel.toUpperCase()}
            </span>
          </div>
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
          className="w-full aspect-[4/3] rounded-2xl object-contain mb-3 sm:mb-4 bg-black"
        />
        <div className="px-1 sm:px-2">
          <p className="text-[9px] text-stone/70 uppercase tracking-widest font-bold mt-1">{shareTag}</p>
          <AuthorLabel />
          <div className="flex justify-between items-center">
            <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
              {memory.caption || ""}
            </h4>
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
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-sm border border-line hover:shadow-xl transition-all">
        <p className="text-[9px] text-stone/70 uppercase tracking-widest font-bold mt-1">{shareTag}</p>
        <AuthorLabel />
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
            <Play size={13} />
          </div>
          <div className="min-w-0">
            <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
              {memory.caption || "Voice memory"}
            </h4>
            <p className="text-[10px] text-accent font-bold uppercase tracking-widest">
              Voice Memory
              {memory.duration_seconds
                ? ` • ${Math.floor(memory.duration_seconds / 60)}:${(memory.duration_seconds % 60)
                    .toString()
                    .padStart(2, "0")}`
                : ""}
            </p>
          </div>
        </div>
        <audio src={signedUrl} controls className="w-full mb-3" />
        <p className="text-[10px] text-stone font-bold">{dateLabel.toUpperCase()}</p>
      </div>
    );
  }

  return (
    <div className="self-start bg-paper border border-line rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 italic text-center overflow-hidden">
      <p className="text-[9px] text-stone/70 uppercase tracking-widest font-bold mt-1">{shareTag}</p>
      <AuthorLabel />
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