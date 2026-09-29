"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSignedMemoryUrl } from "@/lib/getSignedMemoryUrl";
import { Person, Memory } from "@/lib/types";


interface MemoryWithPerson extends Memory {
  person: Person | null;
  shared_with_person?: boolean;
}

export default function GlobalTimelinePage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [memories, setMemories] = useState<MemoryWithPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [circleNames, setCircleNames] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel("timeline-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memories" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: peopleData } = await supabase
      .from("people")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    setPeople(peopleData || []);

    setCurrentUserId(user.id);

    const { data: ownData } = await supabase
      .from("memories")
      .select("*, person:people(*)")
      .eq("creator_id", user.id);

    const { data: rowsAboutMe } = await supabase
      .from("people")
      .select("id")
      .eq("linked_user_id", user.id);

    const aboutMeIds = (rowsAboutMe || []).map((p) => p.id);
    let sharedWithMe: MemoryWithPerson[] = [];
    if (aboutMeIds.length > 0) {
      const { data } = await supabase
        .from("memories")
        .select("*, person:people(*)")
        .in("person_id", aboutMeIds)
        .eq("shared_with_person", true);
      sharedWithMe = (data as unknown as MemoryWithPerson[]) || [];
    }

    const merged = [
      ...((ownData as unknown as MemoryWithPerson[]) || []),
      ...sharedWithMe,
    ];
    const memoriesList = Array.from(new Map(merged.map((m) => [m.id, m])).values()).sort(
      (a, b) => new Date(b.memory_date).getTime() - new Date(a.memory_date).getTime()
    );
    setMemories(memoriesList);

    const circleIds = Array.from(
      new Set(memoriesList.map((m) => m.circle_id).filter(Boolean))
    ) as string[];

    if (circleIds.length > 0) {
      const { data: circlesData } = await supabase
        .from("circles")
        .select("id, name")
        .in("id", circleIds);
      setCircleNames(
        Object.fromEntries((circlesData || []).map((c) => [c.id, c.name]))
      );
    }

    setLoading(false);
  }

  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    setVisibleCount(12);
  }, [selectedPersonId]);

  const filteredMemories =
    selectedPersonId === "all"
      ? memories
      : memories.filter((m) => m.person_id === selectedPersonId);

  const visibleMemories = filteredMemories.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMemories.length;

  const memoriesByYear = visibleMemories.reduce<Record<string, MemoryWithPerson[]>>(
    (acc, m) => {
      const year = new Date(m.memory_date).getFullYear().toString();
      if (!acc[year]) acc[year] = [];
      acc[year].push(m);
      return acc;
    },
    {}
  );
  const years = Object.keys(memoriesByYear).sort((a, b) => Number(b) - Number(a));

  if (loading) {
    return (
      <main className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="pb-24 lg:pb-12">
      <div className="relative overflow-hidden bg-paper px-4 sm:px-8 md:px-12 pt-14 sm:pt-20 pb-16 sm:pb-20 mb-10 sm:mb-16 border-b border-line">
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
        <div className="relative z-10 max-w-2xl">
          <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em] block mb-4">
            Every Story, In One Place
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif italic text-ink leading-[1.15] mb-4">
            Memory Timeline
          </h1>
          <p className="text-stone text-sm sm:text-base leading-relaxed">
            Every saved moment, from everyone you love, woven into one story.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 md:px-12">
        {people.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 mb-10 sm:mb-14">
            <button
              onClick={() => setSelectedPersonId("all")}
              className={`flex flex-col items-center gap-2 border-2 rounded-[1.25rem] p-2.5 min-w-[76px] transition-all shrink-0 ${
                selectedPersonId === "all"
                  ? "border-accent bg-accent/5"
                  : "border-transparent bg-paper"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-serif italic text-sm ${
                  selectedPersonId === "all" ? "bg-accent text-white" : "bg-clay text-ink"
                }`}
              >
                All
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-widest ${
                  selectedPersonId === "all" ? "text-accent" : "text-stone"
                }`}
              >
                Everyone
              </span>
            </button>

            {people.map((person) => {
              const selected = person.id === selectedPersonId;
              return (
                <button
                  key={person.id}
                  onClick={() => setSelectedPersonId(person.id)}
                  className={`flex flex-col items-center gap-2 border-2 rounded-[1.25rem] p-2.5 min-w-[76px] transition-all shrink-0 ${
                    selected ? "border-accent bg-accent/5" : "border-transparent bg-paper"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-clay overflow-hidden shadow-sm">
                    {person.photo_url ? (
                      <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-serif italic text-ink text-sm">
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest truncate max-w-[64px] ${
                      selected ? "text-accent" : "text-stone"
                    }`}
                  >
                    {person.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}


      {years.length === 0 ? (
        <div className="text-center py-16 sm:py-24">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center text-accent mx-auto mb-5 shadow-inner">
            <Camera size={20} />
          </div>
          <p className="text-stone text-sm max-w-sm mx-auto leading-relaxed">
            {people.length === 0
              ? "You haven't added anyone yet. Start by adding someone you'd like to remember."
              : selectedPersonId === "all"
              ? "Nothing captured yet. Every relationship is a library of stories — start writing this one."
              : "Nothing captured for this person yet."}
          </p>
          {people.length === 0 && (
            <Link
              href="/people/new"
              className="inline-block mt-6 bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-105 hover:shadow-xl transition-all duration-300"
            >
              Add Someone
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-10 sm:space-y-12">
          {years.map((year) => (
            <div key={year}>
              <div className="relative pl-10 sm:pl-12 mb-6 sm:mb-8 flex items-center gap-3">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 sm:w-8 h-[1px] bg-gradient-to-r from-transparent to-line" />
                <span className="text-[10px] font-bold text-stone uppercase tracking-[0.3em] bg-paper px-3 py-1 rounded-full border border-line">
                  {year}
                </span>
                <div className="flex-1 h-[1px] bg-gradient-to-r from-line to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 relative">
                <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-line" />

                {memoriesByYear[year].map((memory, index) => {
                  const isRightColumn = index % 2 === 1;
                  return (
                    <div
                      key={memory.id}
                      className={`relative group ${isRightColumn ? "md:mt-16" : ""}`}
                    >
                      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-accent/15 group-hover:ring-accent/30 transition-all duration-300 z-10" />
<TimelineMemoryCard memory={memory} circleNames={circleNames} currentUserId={currentUserId} />                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => setVisibleCount((v) => v + 12)}
                className="bg-white border border-line text-ink px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-paper hover:border-accent/30 transition-all duration-300"
              >
                Load More Memories
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </main>
  );
}

function shareLabel(memory: MemoryWithPerson, circleNames: Record<string, string>): string {
  if (memory.circle_id) return `Shared in ${circleNames[memory.circle_id] || "a Circle"}`;
  if (memory.is_shared) return "Shared with Family Circle";
  if (memory.shared_with_person && memory.person) return `Shared with ${memory.person.name}`;
  return "Private — just for you";
}

function TimelineMemoryCard({
  memory,
  circleNames,
  currentUserId,
}: {
  memory: MemoryWithPerson;
  circleNames: Record<string, string>;
  currentUserId: string | null;
}) {
  const label = shareLabel(memory, circleNames);
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

    const PersonBadge = () => {
    if (currentUserId && memory.creator_id !== currentUserId) {
      return (
        <p className="text-[9px] font-bold text-accent uppercase tracking-widest mb-3">
          From {memory.creator_name || "a friend"}
        </p>
      );
    }
    if (!memory.person) return null;
    return (
      <Link
        href={`/people/${memory.person.id}`}
        className="flex items-center gap-2 mb-3 group/badge w-fit"
      >
        <div className="w-6 h-6 rounded-full bg-clay overflow-hidden shrink-0">
          {memory.person.photo_url ? (
            <img src={memory.person.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-serif italic text-ink text-[10px]">
              {memory.person.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className="text-[9px] font-bold text-stone uppercase tracking-widest group-hover/badge:text-accent transition-colors">
          {memory.person.name}
        </span>
      </Link>
    );
  };

  if (memory.type === "photo" && signedUrl) {
    return (
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-sm border border-line hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <img
          className="w-full aspect-[4/3] rounded-2xl sm:rounded-[1.5rem] object-cover mb-3 sm:mb-4"
          src={signedUrl}
          alt={memory.caption || ""}
        />
        <div className="px-1 sm:px-2">
          <PersonBadge />
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
              {memory.caption || ""}
            </h4>
            <span className="text-[10px] text-stone font-bold shrink-0 ml-2">
              {dateLabel.toUpperCase()}
            </span>
          </div>
          {memory.location && <p className="text-xs text-stone">{memory.location}</p>}
          <p className="text-[9px] text-stone/70 uppercase tracking-widest font-bold mt-2">
            {label}
          </p>
        </div>
      </div>
    );
  }

  if (memory.type === "video" && signedUrl) {
    return (
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-sm border border-line hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <video
          src={signedUrl}
          controls
          className="w-full aspect-[4/3] rounded-2xl sm:rounded-[1.5rem] object-contain mb-3 sm:mb-4 bg-black"
        />
        <div className="px-1 sm:px-2">
          <PersonBadge />
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
              {memory.caption || ""}
            </h4>
            <span className="text-[10px] text-stone font-bold shrink-0 ml-2">
              {dateLabel.toUpperCase()}
            </span>
          </div>
          <p className="text-[9px] text-stone/70 uppercase tracking-widest font-bold">
            {label}
          </p>
        </div>
      </div>
    );
  }

  if (memory.type === "voice" && signedUrl) {
    return (
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-sm border border-line hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <PersonBadge />
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
            <span className="text-[10px]">▶</span>
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
          <audio src={signedUrl} controls className="w-full mb-4" />
        <div className="flex justify-between items-center text-[10px] text-stone font-bold">
          <span>{dateLabel.toUpperCase()}</span>
          <span className="uppercase tracking-widest">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="self-start bg-paper border border-line rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 italic text-center overflow-hidden hover:shadow-md transition-shadow duration-300">
      <PersonBadge />
      <p
        dir="auto"
        className="text-ink text-base sm:text-lg leading-relaxed mb-4 sm:mb-6 font-serif break-words whitespace-pre-wrap"
      >
        &ldquo;{memory.caption}&rdquo;
      </p>
      <span className="text-[10px] text-stone not-italic font-bold uppercase tracking-[0.2em] block">
        {dateLabel.toUpperCase()}
      </span>
      <span className="text-[9px] text-stone/70 not-italic uppercase tracking-widest font-bold block mt-1">
        {label}
      </span>
    </div>
  );
}