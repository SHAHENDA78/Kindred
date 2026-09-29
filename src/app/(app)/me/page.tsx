"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Play, Pause } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSignedMemoryUrl } from "@/lib/getSignedMemoryUrl";
import { Person, Memory } from "@/lib/types";

export default function MyMemoriesPage() {
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: personData } = await supabase
      .from("people")
      .select("*")
      .eq("linked_user_id", user.id)
      .maybeSingle();

    if (!personData) {
      router.replace("/home");
      return;
    }
    setPerson(personData);

    const { data: memoriesData } = await supabase
      .from("memories")
      .select("*")
      .eq("person_id", personData.id)
      .order("memory_date", { ascending: false });

    setMemories(memoriesData || []);
    setLoading(false);
  }

  if (loading || !person) {
    return (
      <main className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  const memoriesByYear = memories.reduce<Record<string, Memory[]>>((acc, m) => {
    const year = new Date(m.memory_date).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(m);
    return acc;
  }, {});
  const years = Object.keys(memoriesByYear).sort((a, b) => Number(b) - Number(a));

  return (
    <main className="pb-24 lg:pb-12 max-w-4xl mx-auto px-4 sm:px-8 md:px-12 pt-8 sm:pt-16">
      <header className="flex flex-col sm:flex-row items-center gap-6 mb-10 sm:mb-14 text-center sm:text-left">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-clay border-4 border-white shadow-xl overflow-hidden shrink-0">
          {person.photo_url ? (
            <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-serif text-2xl text-ink">
              {person.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-1">
            Your Kindred Space
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif text-ink">
            {person.name}&apos;s Memories
          </h1>
          <p className="text-stone text-sm mt-1">
            {memories.length} {memories.length === 1 ? "memory" : "memories"} saved with you
          </p>
        </div>
        <Link
          href={`/capture?personId=${person.id}`}
          className="bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-105 transition-all shrink-0"
        >
          Add Memory
        </Link>
      </header>

      {years.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent mx-auto mb-5">
            <Camera size={20} />
          </div>
          <p className="text-stone text-sm max-w-sm mx-auto leading-relaxed">
            No memories here yet. Add your first one, or wait for family to
            share theirs with you.
          </p>
        </div>
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
                  <MyMemoryCard key={memory.id} memory={memory} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function MyMemoryCard({ memory }: { memory: Memory }) {
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
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
              {memory.caption || ""}
            </h4>
            <span className="text-[10px] text-stone font-bold shrink-0 ml-2">
              {dateLabel.toUpperCase()}
            </span>
          </div>
          {memory.location && <p className="text-xs text-stone">{memory.location}</p>}
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
          className="w-full aspect-[4/3] rounded-2xl sm:rounded-[1.5rem] object-contain mb-3 sm:mb-4 bg-black"
        />
        <div className="px-1 sm:px-2">
          <div className="flex justify-between items-center mb-2">
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