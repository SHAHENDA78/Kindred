"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Image as ImageIcon, Mic, Video, Users, Camera, Check, UserPlus, Copy, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Person, ConnectionWithProfile } from "@/lib/types";
interface PersonWithStats extends Person {
  memoryCount: number;
  lastCaptureDate: string | null;
}

interface NudgeSuggestion {
  person: PersonWithStats;
  daysSince: number;
}

async function enrichWithProfilePhotos(
  supabaseClient: ReturnType<typeof createClient>,
  people: PersonWithStats[]
) {
  const missingPhotoLinkedIds = Array.from(
    new Set(
      people
        .filter((p) => !p.photo_url && p.linked_user_id)
        .map((p) => p.linked_user_id as string)
    )
  );
  if (missingPhotoLinkedIds.length === 0) return people;

  const { data: linkedProfiles } = await supabaseClient
    .from("profiles")
    .select("id, avatar_url")
    .in("id", missingPhotoLinkedIds);

  const avatarMap = Object.fromEntries(
    (linkedProfiles || []).map((p) => [p.id, p.avatar_url])
  );

  return people.map((p) =>
    !p.photo_url && p.linked_user_id && avatarMap[p.linked_user_id]
      ? { ...p, photo_url: avatarMap[p.linked_user_id] }
      : p
  );
}

export default function HomePage() {
  const [userName, setUserName] = useState("");
  const [people, setPeople] = useState<PersonWithStats[]>([]);
  const [nudge, setNudge] = useState<NudgeSuggestion | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [showAllPeople, setShowAllPeople] = useState(false);
    const [showAllConnected, setShowAllConnected] = useState(false);
  const [stats, setStats] = useState({ photos: 0, voices: 0, videos: 0, circles: 0 });
    const [connections, setConnections] = useState<ConnectionWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
      const [creatingInviteFor, setCreatingInviteFor] = useState<string | null>(null);
  const [inviteModal, setInviteModal] = useState<{ name: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);


    useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserName(user.user_metadata?.full_name?.split(" ")[0] || "there");

      const { data: peopleData } = await supabase
        .from("people")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      const { data: memoriesData } = await supabase
        .from("memories")
        .select("*")
        .eq("creator_id", user.id);

      const memories = memoriesData || [];
      const peopleList = (peopleData || []).filter((p) => p.relationship !== "self");

      const linkedFriendIds = Array.from(
        new Set(peopleList.filter((p) => p.linked_user_id).map((p) => p.linked_user_id as string))
      );

      const reverseMemoriesByFriend: Record<string, typeof memories> = {};
      if (linkedFriendIds.length > 0) {
        const { data: reverseRows } = await supabase
          .from("people")
          .select("id, owner_id")
          .eq("linked_user_id", user.id)
          .in("owner_id", linkedFriendIds);

        const reverseIds = (reverseRows || []).map((r) => r.id);

        if (reverseIds.length > 0) {
          const { data: reverseMemoriesData } = await supabase
            .from("memories")
            .select("*")
            .in("person_id", reverseIds)
            .eq("shared_with_person", true);

          const rowToOwner = Object.fromEntries(
            (reverseRows || []).map((r) => [r.id, r.owner_id])
          );

          (reverseMemoriesData || []).forEach((m) => {
            const ownerId = rowToOwner[m.person_id];
            if (!ownerId) return;
            if (!reverseMemoriesByFriend[ownerId]) reverseMemoriesByFriend[ownerId] = [];
            reverseMemoriesByFriend[ownerId].push(m);
          });
        }
      }

      const peopleWithStats: PersonWithStats[] = peopleList.map((p) => {
        const personMemories = memories.filter((m) => m.person_id === p.id);
        const reverseMemories = p.linked_user_id
          ? reverseMemoriesByFriend[p.linked_user_id] || []
          : [];
        const allMemories = [...personMemories, ...reverseMemories];
        const sorted = [...allMemories].sort(
          (a, b) => new Date(b.memory_date).getTime() - new Date(a.memory_date).getTime()
        );
        return {
          ...p,
          memoryCount: allMemories.length,
          lastCaptureDate: sorted[0]?.memory_date || null,
        };
      });

      const enrichedPeopleWithStats = await enrichWithProfilePhotos(supabase, peopleWithStats);
      setPeople(enrichedPeopleWithStats);

      const withGaps = enrichedPeopleWithStats
        .map((p) => {
          const daysSince = p.lastCaptureDate
            ? Math.floor((Date.now() - new Date(p.lastCaptureDate).getTime()) / 86400000)
            : 9999;
          return { person: p, daysSince };
        })
        .filter((n) => n.daysSince >= 7)
        .sort((a, b) => b.daysSince - a.daysSince);

      if (withGaps.length > 0) {
        setNudge(withGaps[0]);
      }

      const { count: circlesCount } = await supabase
        .from("circles")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user.id);

      setStats({
        photos: memories.filter((m) => m.type === "photo").length,
        voices: memories.filter((m) => m.type === "voice").length,
        videos: memories.filter((m) => m.type === "video").length,
        circles: circlesCount || 0,
      });

      const { data: connectionRows } = await supabase
        .from("connections")
        .select("user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      const otherIds = (connectionRows || []).map((c) =>
        c.user_a === user.id ? c.user_b : c.user_a
      );

      if (otherIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", otherIds);

        setConnections(
          (profilesData || []).map((p) => ({
            connectionUserId: p.id,
            fullName: p.full_name || "Someone",
            avatarUrl: p.avatar_url || null,
          }))
        );
      }

      setLoading(false);
    }

    fetchData();
  }, []);

    async function handleCreatePersonInvite(personId: string, personName: string) {
    setCreatingInviteFor(personId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error } = await supabase
      .from("person_invites")
      .insert({ person_id: personId, created_by: user.id, expires_at: expiresAt.toISOString() })
      .select("*")
      .single();

    setCreatingInviteFor(null);

    if (error || !invite) {
      alert("Couldn't create an invite link. Please try again.");
      return;
    }

    setInviteModal({
      name: personName,
      link: `${window.location.origin}/join-person/${invite.token}`,
    });
  }

  const relationshipLabel = (r: string) =>
    r.replace("_", " / ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <main className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  const joinedCount = people.filter((p) => p.linked_user_id).length;

  return (
    <main className="p-6 sm:p-12 pb-24 lg:pb-12">
      <header className="flex flex-col sm:flex-row justify-between sm:items-start gap-4 mb-10 sm:mb-12">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif mb-2 leading-tight">
            Welcome home, {userName}.
          </h1>
          <p className="text-stone text-sm">There are small moments waiting to be saved today.</p>
        </div>
        <Link
          href="/capture"
          className="bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-105 transition-all flex items-center justify-center gap-2 w-fit"
        >
          <Plus size={12} /> Add Memory
        </Link>
            </header>
      {nudge && !nudgeDismissed && (
        <section className="mb-10 sm:mb-12">
          <div className="bg-clay rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 border border-line relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
            <div className="flex-1 space-y-5 relative z-10 text-center md:text-left">
              <span className="inline-block px-3 py-1 bg-white rounded-full text-[10px] font-bold text-accent uppercase tracking-widest border border-accent/20">
                Daily Nudge
              </span>
              <h2 className="text-xl sm:text-2xl font-serif italic text-ink">
                {nudge.daysSince >= 9999
                  ? `You haven't saved a memory with ${nudge.person.name} yet.`
                  : `Take a photo with ${nudge.person.name} today?`}
              </h2>
              <p className="text-stone leading-relaxed max-w-md text-sm">
                {nudge.daysSince >= 9999
                  ? "A simple candid photo today will be a treasure years from now."
                  : `It's been ${nudge.daysSince} days since your last memory together.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-center md:justify-start">
                <Link
                  href={`/capture?personId=${nudge.person.id}`}
                  className="bg-ink text-white px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-colors text-center"
                >
                  I&apos;ll do it
                </Link>
                <button
                  onClick={() => setNudgeDismissed(true)}
                  className="bg-white border border-line text-stone px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-paper transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
            {nudge.person.photo_url && (
              <div className="w-full md:w-1/3 aspect-square rounded-[2rem] overflow-hidden shadow-soft relative z-10 shrink-0">
                <img
                  src={nudge.person.photo_url}
                  alt={nudge.person.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-end mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl font-serif italic">Your People</h3>
          {people.length > 3 && (
            <button
              onClick={() => setShowAllPeople((v) => !v)}
              className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
            >
              {showAllPeople ? "Show Less" : "View All"}
            </button>
          )}
        </div>

        {people.length === 0 ? (
          <div className="bg-paper rounded-3xl border border-line border-dashed p-10 text-center">
            <p className="text-stone text-sm mb-4">
              You haven&apos;t added anyone yet. Start with the people who matter most.
            </p>
            <Link
              href="/onboarding"
              className="inline-block bg-accent text-white px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest"
            >
              Add Someone
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {(showAllPeople ? people : people.slice(0, 3)).map((person) => (
              <Link
                key={person.id}
                href={`/people/${person.id}`}
                className="bg-white rounded-3xl p-6 sm:p-8 border border-line shadow-sm hover:shadow-xl hover:border-accent/30 transition-all group flex flex-col items-center text-center"
              >
                <div className="relative mb-6">
                  {person.photo_url ? (
                    <img
                      src={person.photo_url}
                      alt={person.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-md grayscale group-hover:grayscale-0 group-active:grayscale-0 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-clay border-4 border-white shadow-md flex items-center justify-center font-serif text-2xl text-ink">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <h4 className="font-serif text-lg sm:text-xl mb-1 text-ink">{person.name}</h4>
                <p className="text-[10px] text-stone font-bold uppercase tracking-[0.2em] mb-4">
                  {relationshipLabel(person.relationship)}
                </p>
                <div className="w-full h-[1px] bg-line mb-4" />
                <div className="flex gap-6 justify-center">
                  <div className="text-center">
                    <p className="text-xs font-bold text-ink">{person.memoryCount}</p>
                    <p className="text-[9px] text-stone uppercase tracking-widest font-bold">
                      Memories
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-accent italic">
                      {person.lastCaptureDate
                        ? `${Math.floor(
                            (Date.now() - new Date(person.lastCaptureDate).getTime()) / 86400000
                          )}d ago`
                        : "—"}
                    </p>
                    <p className="text-[9px] text-stone uppercase tracking-widest font-bold">
                      Last Capture
                    </p>
                  </div>
                </div>
              </Link>
            ))}

            <Link
              href="/people/new"
              className="bg-paper border-2 border-dashed border-line rounded-3xl p-6 sm:p-8 hover:border-accent active:border-accent hover:bg-white active:bg-white transition-all group flex flex-col items-center justify-center text-center"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center border-2 border-line text-line group-hover:text-accent group-active:text-accent group-hover:border-accent group-active:border-accent transition-all mb-4">
                <Plus size={22} />
              </div>
              <h4 className="font-serif text-base sm:text-lg text-stone group-hover:text-ink transition-colors">
                Add Someone
              </h4>
              <p className="text-[9px] text-stone/60 font-bold uppercase tracking-widest">
                Grow your circle
              </p>
            </Link>
          </div>
        )}
      </section>

      {people.length > 0 && (
        <section className="mt-12 sm:mt-16">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-serif italic">Connected People</h3>
            <span className="text-[10px] font-bold text-stone uppercase tracking-widest">
              {joinedCount} of {people.length} joined
            </span>
          </div>

          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-line shadow-sm overflow-hidden">
            <div className="divide-y divide-line">
              {(showAllConnected ? people : people.slice(0, 3)).map((person) => (
                <div
                  key={person.id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-clay overflow-hidden shrink-0">
                      {person.photo_url ? (
                        <img
                          src={person.photo_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-serif italic text-ink text-sm">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{person.name}</p>
                      <p className="text-[9px] text-stone uppercase tracking-widest font-bold">
                        {relationshipLabel(person.relationship)}
                      </p>
                    </div>
                  </div>

                  {person.linked_user_id ? (
                    <span className="flex items-center gap-1.5 bg-accent/10 text-accent px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest shrink-0">
                      <Check size={11} /> Joined
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCreatePersonInvite(person.id, person.name)}
                      disabled={creatingInviteFor === person.id}
                      className="flex items-center gap-1.5 bg-paper border border-line text-stone px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-clay transition-colors shrink-0 disabled:opacity-50"
                    >
                      <UserPlus size={11} /> {creatingInviteFor === person.id ? "..." : "Invite"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {people.length > 3 && (
              <div className="p-3 text-center border-t border-line">
                <button
                  onClick={() => setShowAllConnected((v) => !v)}
                  className="text-[10px] font-bold text-stone hover:text-accent uppercase tracking-widest transition-colors"
                >
                  {showAllConnected ? "Show Less" : `See All ${people.length}`}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-12 sm:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { icon: ImageIcon, value: stats.photos, label: "Photos Saved" },
          { icon: Mic, value: stats.voices, label: "Voices Kept" },
          { icon: Video, value: stats.videos, label: "Videos Kept" },
          { icon: Users, value: stats.circles, label: "Active Circles" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-line rounded-2xl p-4 sm:p-6 flex items-center gap-3 sm:gap-4"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <stat.icon size={14} />
            </div>
            <div>
              <p className="text-base sm:text-lg font-bold text-ink leading-none">{stat.value}</p>
              <p className="text-[8px] sm:text-[9px] text-stone uppercase tracking-widest font-bold">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </section>

      <Link
        href="/capture"
        className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 w-14 h-14 lg:w-16 lg:h-16 bg-accent text-white rounded-full shadow-2xl shadow-accent/40 flex items-center justify-center text-xl hover:scale-110 active:scale-95 transition-all z-40 group"
      >
        <Mic size={20} className="group-hover:hidden group-active:hidden lg:size-[22px]" />
        <Camera size={20} className="hidden group-hover:block group-active:block lg:size-[22px]" />
      </Link>

            {inviteModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg italic text-ink">Invite {inviteModal.name}</h3>
              <button
                onClick={() => {
                  setInviteModal(null);
                  setCopied(false);
                }}
                className="text-stone hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-stone text-xs leading-relaxed">
              Send this link to {inviteModal.name}. Once they sign up and open
              it, they&apos;ll be connected automatically.
            </p>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={inviteModal.link}
                className="w-full bg-paper border border-line rounded-xl px-4 py-4 text-xs font-mono text-stone pr-12 truncate"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteModal.link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-accent hover:text-ink transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}