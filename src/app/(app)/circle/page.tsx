"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { UserPlus, Copy, Check, Trash2, X, Plus, ArrowRight, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSignedMemoryUrl } from "@/lib/getSignedMemoryUrl";
import { Person, Circle, CircleMember, CircleInvite, Memory } from "@/lib/types";

interface CircleSummary extends Circle {
  people: Person[];
  memberCount: number;
}

interface CircleMemory extends Memory {
  person: Person | null;
}

interface CircleMemberWithMethod extends CircleMember {
  added_via?: "direct" | "invite_link" | null;
}

async function enrichWithProfilePhotos(
  supabaseClient: ReturnType<typeof createClient>,
  people: Person[]
) {
  const linkedIds = Array.from(
    new Set(people.filter((p) => p.linked_user_id).map((p) => p.linked_user_id as string))
  );
  if (linkedIds.length === 0) return people;

  const { data: linkedProfiles } = await supabaseClient
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", linkedIds);

  const map = Object.fromEntries((linkedProfiles || []).map((p) => [p.id, p]));

  return people.map((p) =>
    p.linked_user_id && map[p.linked_user_id]
      ? {
          ...p,
          name: map[p.linked_user_id].full_name || p.name,
          photo_url: p.photo_url || map[p.linked_user_id].avatar_url || null,
        }
      : p
  );
}

async function officializeForOthers(
  supabaseClient: ReturnType<typeof createClient>,
  people: Person[]
) {
  const linkedIds = Array.from(
    new Set(people.filter((p) => p.linked_user_id).map((p) => p.linked_user_id as string))
  );
  if (linkedIds.length === 0) return people;

  const { data: profiles } = await supabaseClient
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", linkedIds);

  const map = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  return people.map((p) => {
    if (p.linked_user_id && map[p.linked_user_id]) {
      const prof = map[p.linked_user_id];
      return {
        ...p,
        name: prof.full_name || p.name,
        photo_url: prof.avatar_url || null,
      };
    }
    return p;
  });
}

function FamilyCircleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [joinedCircles, setJoinedCircles] = useState<CircleSummary[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(
    searchParams.get("circle")
  );
  const [isJoinedView, setIsJoinedView] = useState(false);
  const [detailTab, setDetailTab] = useState<"members" | "memories">("members");

  const [members, setMembers] = useState<CircleMemberWithMethod[]>([]);
  const [invites, setInvites] = useState<CircleInvite[]>([]);
  const [sharedMemories, setSharedMemories] = useState<CircleMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");
  const [newCirclePeopleIds, setNewCirclePeopleIds] = useState<string[]>([]);
  const [savingCircle, setSavingCircle] = useState(false);

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [pastedLink, setPastedLink] = useState("");

  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [showAddFriendMember, setShowAddFriendMember] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [openLinkDropdownId, setOpenLinkDropdownId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myConnectionIds, setMyConnectionIds] = useState<Set<string>>(new Set());
  const [myOutgoingRequestIds, setMyOutgoingRequestIds] = useState<Set<string>>(new Set());
  const [sendingFriendTo, setSendingFriendTo] = useState<string | null>(null);

  const [inviterNames, setInviterNames] = useState<Record<string, string>>({});
  const inviteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (selectedCircleId && !isJoinedView) {
      loadCircleDetail(selectedCircleId);
      const url = new URL(window.location.href);
      url.searchParams.set("circle", selectedCircleId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [selectedCircleId, isJoinedView]);

  useEffect(() => {
    const owned = circles.find((c) => c.id === selectedCircleId);
    const joined = joinedCircles.find((c) => c.id === selectedCircleId);
    const active = isJoinedView ? joined : owned;
    if (detailTab === "memories" && active) {
      loadSharedMemories(active.id, active.people.map((p) => p.id));
    }
  }, [detailTab, selectedCircleId, isJoinedView, circles, joinedCircles]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".kindred-dropdown")) {
        setShowAddPerson(false);
        setShowAddFriendMember(false);
        setOpenLinkDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setCurrentUserId(user.id);

    const { data: peopleData } = await supabase
      .from("people")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    const enrichedPeopleData = await enrichWithProfilePhotos(supabase, peopleData || []);
    setAllPeople(enrichedPeopleData);

    const { data: connectionRows } = await supabase
      .from("connections")
      .select("user_a, user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    const friendIds = (connectionRows || []).map((c) =>
      c.user_a === user.id ? c.user_b : c.user_a
    );
    if (friendIds.length > 0) {
      const { data: friendProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", friendIds);
      setFriends(
        (friendProfiles || []).map((p) => ({ id: p.id, name: p.full_name || "Friend" }))
      );
    }

    setMyConnectionIds(new Set(friendIds));

    const { data: outgoingRows } = await supabase
      .from("friend_requests")
      .select("receiver_id")
      .eq("sender_id", user.id)
      .eq("status", "pending");
    setMyOutgoingRequestIds(new Set((outgoingRows || []).map((r) => r.receiver_id)));

    const { data: circlesData } = await supabase
      .from("circles")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    const enriched = await Promise.all(
      (circlesData || []).map(async (circle) => {
        const { data: circlePeopleRows } = await supabase
          .from("circle_people")
          .select("person_id")
          .eq("circle_id", circle.id);
        const personIds = (circlePeopleRows || []).map((r) => r.person_id);
        const people = enrichedPeopleData.filter((p) => personIds.includes(p.id));

        const { count: memberCount } = await supabase
          .from("circle_members")
          .select("id", { count: "exact", head: true })
          .eq("circle_id", circle.id)
          .eq("status", "accepted");
        return { ...circle, people, memberCount: memberCount || 0 };
      })
    );
    setCircles(enriched);

    const { data: membershipRows } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", user.id)
      .eq("status", "accepted");

    const joinedCircleIds = (membershipRows || [])
      .map((r) => r.circle_id)
      .filter((id) => !enriched.some((c) => c.id === id));

    if (joinedCircleIds.length > 0) {
      const { data: joinedCirclesData } = await supabase
        .from("circles")
        .select("*")
        .in("id", joinedCircleIds);

      const joinedEnriched = await Promise.all(
        (joinedCirclesData || []).map(async (circle) => {
          const { data: cpRows } = await supabase
            .from("circle_people")
            .select("person_id")
            .eq("circle_id", circle.id);
          const personIds = (cpRows || []).map((r) => r.person_id);

          const { data: peopleRows } = await supabase
            .from("people")
            .select("*")
            .in(
              "id",
              personIds.length > 0
                ? personIds
                : ["00000000-0000-0000-0000-000000000000"]
            );
          const officialJoinedPeople = await officializeForOthers(supabase, peopleRows || []);
          return { ...circle, people: officialJoinedPeople, memberCount: 0 };
        })
      );
      setJoinedCircles(joinedEnriched);

      if (!selectedCircleId && enriched.length === 0 && joinedEnriched.length > 0) {
        setSelectedCircleId(joinedEnriched[0].id);
        setIsJoinedView(true);
        setDetailTab("memories");
      }
    }

    setLoading(false);

    if (!selectedCircleId && enriched.length > 0) {
      setSelectedCircleId(enriched[0].id);
    }
  }

  async function loadCircleDetail(circleId: string) {
    setLoadingDetail(true);
    setError(null);

    const { data: membersData } = await supabase
      .from("circle_members")
      .select("*")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: true });
    setMembers(membersData || []);

    const inviterIds = Array.from(
      new Set((membersData || []).map((m) => m.invited_by).filter(Boolean))
    ) as string[];
    if (inviterIds.length > 0) {
      const { data: inviterProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", inviterIds);
      setInviterNames(
        Object.fromEntries((inviterProfiles || []).map((p) => [p.id, p.full_name || "Someone"]))
      );
    }

    const { data: invitesData } = await supabase
      .from("circle_invites")
      .select("*")
      .eq("circle_id", circleId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setInvites(invitesData || []);

    setLoadingDetail(false);
  }

  async function sendFriendRequestToPerson(targetUserId: string) {
    if (!currentUserId || targetUserId === currentUserId) return;
    setSendingFriendTo(targetUserId);

    const { error: insertError } = await supabase.from("friend_requests").insert({
      sender_id: currentUserId,
      receiver_id: targetUserId,
      status: "pending",
    });

    setSendingFriendTo(null);

    if (!insertError) {
      setMyOutgoingRequestIds((prev) => new Set(prev).add(targetUserId));
    }
  }

  async function loadSharedMemories(circleId: string, personIds: string[]) {
    setLoadingMemories(true);

    const directPromise = supabase
      .from("memories")
      .select("*, person:people(*)")
      .eq("circle_id", circleId);

    const viaPersonPromise =
      personIds.length > 0
        ? supabase
            .from("memories")
            .select("*, person:people(*)")
            .in("person_id", personIds)
            .eq("is_shared", true)
        : Promise.resolve({ data: [] as CircleMemory[] });

    const [directResult, viaPersonResult] = await Promise.all([
      directPromise,
      viaPersonPromise,
    ]);

    const combined = [...(directResult.data || []), ...(viaPersonResult.data || [])];
    const unique = Array.from(new Map(combined.map((m) => [m.id, m])).values());
    unique.sort(
      (a, b) => new Date(b.memory_date).getTime() - new Date(a.memory_date).getTime()
    );

    setSharedMemories(unique as unknown as CircleMemory[]);
    setLoadingMemories(false);
  }

  async function refreshSelectedCircle() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: circlesData } = await supabase
      .from("circles")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    if (!circlesData) return;

    const enriched = await Promise.all(
      circlesData.map(async (circle) => {
        const { data: circlePeopleRows } = await supabase
          .from("circle_people")
          .select("person_id")
          .eq("circle_id", circle.id);
        const personIds = (circlePeopleRows || []).map((r) => r.person_id);
        const people = allPeople.filter((p) => personIds.includes(p.id));
        const { count: memberCount } = await supabase
          .from("circle_members")
          .select("id", { count: "exact", head: true })
          .eq("circle_id", circle.id)
          .eq("status", "accepted");
        return { ...circle, people, memberCount: memberCount || 0 };
      })
    );
    setCircles(enriched);
  }

  async function handleCreateCircle() {
    if (!newCircleName.trim()) {
      setError("Please give your circle a name.");
      return;
    }
    setSavingCircle(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newCircle, error: createError } = await supabase
      .from("circles")
      .insert({ owner_id: user.id, name: newCircleName.trim() })
      .select("*")
      .single();

    if (createError || !newCircle) {
      setError("Couldn't create the circle. Please try again.");
      setSavingCircle(false);
      return;
    }

    if (newCirclePeopleIds.length > 0) {
      await supabase.from("circle_people").insert(
        newCirclePeopleIds.map((personId) => ({
          circle_id: newCircle.id,
          person_id: personId,
        }))
      );
    }

    const { data: selfPerson } = await supabase
      .from("people")
      .select("id")
      .eq("owner_id", user.id)
      .eq("linked_user_id", user.id)
      .maybeSingle();

    let selfPersonId = selfPerson?.id;
    if (!selfPersonId) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const { data: newSelfPerson } = await supabase
        .from("people")
        .insert({
          owner_id: user.id,
          linked_user_id: user.id,
          name: profileRow?.full_name || "You",
          relationship: "self",
        })
        .select("id")
        .single();
      selfPersonId = newSelfPerson?.id;
    }
    if (selfPersonId) {
      await supabase.from("circle_people").insert({
        circle_id: newCircle.id,
        person_id: selfPersonId,
      });
    }

    setSavingCircle(false);
    setShowCreateForm(false);
    setNewCircleName("");
    setNewCirclePeopleIds([]);
    await loadAll();
    setSelectedCircleId(newCircle.id);
    setIsJoinedView(false);
    setDetailTab("members");
  }

  async function handleAddPersonToCircle(personId: string) {
    if (!selectedCircleId) return;
    await supabase.from("circle_people").insert({
      circle_id: selectedCircleId,
      person_id: personId,
    });

    const person = allPeople.find((p) => p.id === personId);
    if (person?.linked_user_id) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: existingMember } = await supabase
        .from("circle_members")
        .select("id")
        .eq("circle_id", selectedCircleId)
        .eq("user_id", person.linked_user_id)
        .maybeSingle();

      if (!existingMember) {
        await supabase.from("circle_members").insert({
          circle_id: selectedCircleId,
          user_id: person.linked_user_id,
          invited_email: person.name,
          role: "member",
          status: "accepted",
          joined_at: new Date().toISOString(),
          invited_by: user?.id,
          added_via: "direct",
        });
      }
    }

    setShowAddPerson(false);
    await loadCircleDetail(selectedCircleId);
    await refreshSelectedCircle();
  }

  async function handleLinkPersonToMember(personId: string, userId: string) {
    await supabase.from("people").update({ linked_user_id: userId }).eq("id", personId);
    await refreshSelectedCircle();
  }

  async function handleAddFriendAsMember(friendId: string) {
    if (!selectedCircleId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const friend = friends.find((f) => f.id === friendId);

    await supabase.from("circle_members").insert({
      circle_id: selectedCircleId,
      user_id: friendId,
      invited_email: friend?.name || null,
      role: "member",
      status: "accepted",
      joined_at: new Date().toISOString(),
      invited_by: user.id,
      added_via: "direct",
    });

    let personId: string | null = null;
    const { data: existingPerson } = await supabase
      .from("people")
      .select("id")
      .eq("owner_id", user.id)
      .eq("linked_user_id", friendId)
      .maybeSingle();

    if (existingPerson) {
      personId = existingPerson.id;
    } else {
      const { data: newPerson } = await supabase
        .from("people")
        .insert({
          owner_id: user.id,
          linked_user_id: friendId,
          name: friend?.name || "Friend",
          relationship: "friend",
        })
        .select("id")
        .single();
      personId = newPerson?.id || null;
    }

    if (personId) {
      await supabase.from("circle_people").insert({
        circle_id: selectedCircleId,
        person_id: personId,
      });
    }

    setShowAddFriendMember(false);
    await loadAll();
  }

  async function handleRemovePersonFromCircle(personId: string) {
    if (!selectedCircleId) return;
    await supabase
      .from("circle_people")
      .delete()
      .eq("circle_id", selectedCircleId)
      .eq("person_id", personId);
    await refreshSelectedCircle();
  }

  async function handleDeleteCircle(circleId: string) {
    await supabase.from("circles").delete().eq("id", circleId);
    const remaining = circles.filter((c) => c.id !== circleId);
    setCircles(remaining);
    if (selectedCircleId === circleId) {
      setSelectedCircleId(remaining[0]?.id ?? null);
    }
  }

  async function handleRemoveFromCircle(personId: string | null, linkedUserId: string | null) {
    if (!selectedCircleId) return;
    if (personId) {
      await supabase
        .from("circle_people")
        .delete()
        .eq("circle_id", selectedCircleId)
        .eq("person_id", personId);
    }
    if (linkedUserId) {
      await supabase
        .from("circle_members")
        .delete()
        .eq("circle_id", selectedCircleId)
        .eq("user_id", linkedUserId);
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== linkedUserId));
    await loadCircleDetail(selectedCircleId);
    await refreshSelectedCircle();
  }

  async function handleCreateInvite() {
    if (!selectedCircleId || isJoinedView) return;
    setCreatingInvite(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: newInvite, error: insertError } = await supabase
      .from("circle_invites")
      .insert({
        circle_id: selectedCircleId,
        token,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("*")
      .single();

    setCreatingInvite(false);

    if (insertError || !newInvite) {
      setError("Couldn't create an invite link. Please try again.");
      return;
    }

    setInvites((prev) => [newInvite, ...prev]);
    setTimeout(() => {
      inviteInputRef.current?.focus();
      inviteInputRef.current?.select();
    }, 0);
  }

  async function handleRemoveMember(memberId: string) {
    await supabase.from("circle_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    await refreshSelectedCircle();
  }

  async function handleLeaveCircle() {
    if (!selectedCircleId || !currentUserId) return;
    await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", selectedCircleId)
      .eq("user_id", currentUserId);
    await loadAll();
    setSelectedCircleId(null);
    setIsJoinedView(false);
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleJoinFromPaste() {
    if (!pastedLink.trim()) return;
    const match = pastedLink.trim().match(/join\/([a-zA-Z0-9-]+)/);
    const token = match ? match[1] : pastedLink.trim();
    router.push(`/join/${token}`);
  }

  const ownedCircle = circles.find((c) => c.id === selectedCircleId);
  const joinedCircle = joinedCircles.find((c) => c.id === selectedCircleId);
  const displayCircle = isJoinedView ? joinedCircle : ownedCircle;

  const activeInvite = invites[0] || null;
  const acceptedMembers = members.filter((m) => m.status === "accepted");
  const peopleNotInCircle = allPeople.filter(
    (p) => !ownedCircle?.people.some((sp) => sp.id === p.id)
  );

  const memoriesByYear = sharedMemories.reduce<Record<string, CircleMemory[]>>(
    (acc, m) => {
      const year = new Date(m.memory_date).getFullYear().toString();
      if (!acc[year]) acc[year] = [];
      acc[year].push(m);
      return acc;
    },
    {}
  );
  const sortedYears = Object.keys(memoriesByYear).sort((a, b) => Number(b) - Number(a));

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
            d="M0 260 C 150 200, 250 280, 400 220 S 650 160, 800 200"
            stroke="#c36241"
            strokeWidth="1.5"
            strokeDasharray="2 8"
            fill="none"
            opacity="0.35"
          />
        </svg>
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div className="max-w-2xl">
            <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em] block mb-4">
              Private Sharing
            </span>
            <h1 className="text-3xl sm:text-5xl font-serif italic text-ink leading-[1.15] mb-4">
              Your Family
              <br />
              Circles
            </h1>
            <p className="text-stone text-sm sm:text-base leading-relaxed max-w-md">
              Group the people you love into circles, and invite family or
              friends to share memories with each one.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-accent text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-105 transition-all flex items-center gap-2 shrink-0 w-fit"
          >
            <Plus size={12} /> New Circle
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-8 md:px-12">
        <div className="max-w-6xl mx-auto mb-10 sm:mb-14 bg-white border border-line rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={pastedLink}
            onChange={(e) => setPastedLink(e.target.value)}
            placeholder="Have an invite link? Paste it here"
            className="flex-1 bg-paper border border-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          <button
            onClick={handleJoinFromPaste}
            disabled={!pastedLink.trim()}
            className="bg-ink text-white px-5 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-accent transition-all flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            Join <ArrowRight size={12} />
          </button>
        </div>

        {showCreateForm && (
          <div className="max-w-6xl mx-auto mb-10 sm:mb-14 bg-white border-2 border-accent rounded-[2rem] p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-lg italic text-ink">Create a new circle</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-stone hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
                  Circle name
                </label>
                <input
                  type="text"
                  value={newCircleName}
                  onChange={(e) => setNewCircleName(e.target.value)}
                  placeholder="e.g. Family, Friends, Neighbors"
                  className="w-full bg-paper border border-line rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
                />
              </div>

              {allPeople.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
                    Who&apos;s in this circle?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allPeople.filter((p) => p.relationship !== "self").map((person) => {
                      const selected = newCirclePeopleIds.includes(person.id);
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() =>
                            setNewCirclePeopleIds((prev) =>
                              selected
                                ? prev.filter((id) => id !== person.id)
                                : [...prev, person.id]
                            )
                          }
                          className={`flex items-center gap-2 border-2 rounded-full pl-1.5 pr-4 py-1.5 transition-all ${
                            selected
                              ? "border-accent bg-accent/5"
                              : "border-line hover:bg-paper"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-clay overflow-hidden shrink-0">
                            {person.photo_url ? (
                              <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-serif italic text-ink text-[10px]">
                                {person.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className={`text-xs font-bold ${selected ? "text-accent" : "text-ink"}`}>
                            {person.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-red-600 text-xs bg-red-50 rounded-lg p-3">{error}</p>
              )}

              <button
                onClick={handleCreateCircle}
                disabled={savingCircle}
                className="w-full bg-accent text-white py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {savingCircle ? "Creating..." : "Create Circle"}
              </button>
            </div>
          </div>
        )}

        {circles.length === 0 && joinedCircles.length === 0 && !showCreateForm ? (
          <div className="text-center py-16 max-w-md mx-auto">
            <p className="text-stone text-sm mb-6">
              You haven&apos;t created or joined a circle yet.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-block bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-105 transition-all"
            >
              Create Your First Circle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12 max-w-6xl mx-auto">
            <div className="lg:col-span-2 space-y-10 sm:space-y-12">
              {circles.length > 0 && (
                <section className="space-y-4 sm:space-y-6">
                  <h2 className="text-sm font-bold text-stone uppercase tracking-widest px-1">
                    Your Circles
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {circles.map((circle) => {
                      const selected = circle.id === selectedCircleId && !isJoinedView;
                      return (
                        <button
                          key={circle.id}
                          onClick={() => {
                            setSelectedCircleId(circle.id);
                            setIsJoinedView(false);
                            setDetailTab("members");
                          }}
                          className={`rounded-3xl p-5 sm:p-6 flex items-center gap-4 sm:gap-5 text-left transition-all ${
                            selected
                              ? "bg-white border-2 border-accent shadow-md"
                              : "bg-white/60 border border-line hover:bg-white"
                          }`}
                        >
                          <div className="flex -space-x-3 shrink-0">
                            {circle.people.slice(0, 3).map((person) => (
                              <div
                                key={person.id}
                                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 shadow-sm overflow-hidden ${
                                  selected ? "border-paper" : "border-white"
                                }`}
                              >
                                {person.photo_url ? (
                                  <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-serif italic text-ink text-xs bg-clay">
                                    {person.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ))}
                            {circle.people.length === 0 && (
                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-white bg-clay flex items-center justify-center text-stone shrink-0">
                                <UserPlus size={14} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3
                              className={`font-serif text-base sm:text-lg italic leading-none mb-1 truncate ${
                                selected ? "text-ink" : "text-stone"
                              }`}
                            >
                              {circle.name}
                            </h3>
                            <p
                              className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest ${
                                selected ? "text-stone" : "text-stone/60"
                              }`}
                            >
                              {circle.people.length}{" "}
                              {circle.people.length === 1 ? "Person" : "People"} •{" "}
                              {circle.memberCount}{" "}
                              {circle.memberCount === 1 ? "Member" : "Members"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {joinedCircles.length > 0 && (
                <section className="space-y-4 sm:space-y-6">
                  <h2 className="text-sm font-bold text-stone uppercase tracking-widest px-1">
                    Circles You&apos;ve Joined
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {joinedCircles.map((circle) => {
                      const selected = circle.id === selectedCircleId && isJoinedView;
                      return (
                        <button
                          key={circle.id}
                          onClick={() => {
                            setSelectedCircleId(circle.id);
                            setIsJoinedView(true);
                            setDetailTab("memories");
                          }}
                          className={`rounded-3xl p-5 sm:p-6 flex items-center gap-4 sm:gap-5 text-left transition-all ${
                            selected
                              ? "bg-white border-2 border-accent shadow-md"
                              : "bg-white/60 border border-line hover:bg-white"
                          }`}
                        >
                          <div className="flex -space-x-3 shrink-0">
                            {circle.people.slice(0, 3).map((person) => (
                              <div
                                key={person.id}
                                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-white shadow-sm overflow-hidden"
                              >
                                {person.photo_url ? (
                                  <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-serif italic text-ink text-xs bg-clay">
                                    {person.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ))}
                            {circle.people.length === 0 && (
                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-white bg-clay flex items-center justify-center text-stone shrink-0">
                                <UserPlus size={14} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-serif text-base sm:text-lg italic leading-none mb-1 truncate text-ink">
                              {circle.name}
                            </h3>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-stone">
                              {circle.people.length}{" "}
                              {circle.people.length === 1 ? "Person" : "People"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {displayCircle && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between px-1">
                    <nav className="flex gap-6 border-b border-line -mb-px">
                      <button
                        onClick={() => setDetailTab("members")}
                        className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                          detailTab === "members"
                            ? "text-accent border-b-2 border-accent"
                            : "text-stone hover:text-ink"
                        }`}
                      >
                        {isJoinedView ? "People" : "Members"}
                      </button>
                      <button
                        onClick={() => setDetailTab("memories")}
                        className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                          detailTab === "memories"
                            ? "text-accent border-b-2 border-accent"
                            : "text-stone hover:text-ink"
                        }`}
                      >
                        Memories
                      </button>
                    </nav>
                    {!isJoinedView ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-[10px] font-bold text-stone hover:text-red-500 uppercase tracking-widest transition-colors shrink-0"
                      >
                        Delete Circle
                      </button>
                    ) : (
                      <button
                        onClick={handleLeaveCircle}
                        className="text-[10px] font-bold text-stone hover:text-red-500 uppercase tracking-widest transition-colors shrink-0"
                      >
                        Leave Circle
                      </button>
                    )}
                  </div>

                  {detailTab === "members" && (
                    <div className="space-y-6 pt-2">
                      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-line shadow-sm overflow-hidden">
                        <div className="p-5 sm:p-6 border-b border-line">
                          <h3 className="text-[10px] font-bold text-stone uppercase tracking-widest">
                            People in {displayCircle.name}
                          </h3>
                        </div>

                        {loadingDetail ? (
                          <div className="p-10 flex justify-center">
                            <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
                          </div>
                        ) : displayCircle.people.length === 0 ? (
                          <div className="p-6 text-center">
                            <p className="text-stone text-xs">No one in this circle yet.</p>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const sortedPeople = [...displayCircle.people].sort((a, b) => {
                                const aIsMe = a.linked_user_id === currentUserId;
                                const bIsMe = b.linked_user_id === currentUserId;
                                if (aIsMe && !bIsMe) return -1;
                                if (!aIsMe && bIsMe) return 1;
                                return 0;
                              });

                              const visiblePeople = showAllMembers
                                ? sortedPeople
                                : sortedPeople.slice(0, 4);

                              return (
                                <div className="divide-y divide-line">
                                  {visiblePeople.map((person) => {
                                    const linkedId = person.linked_user_id;
                                    const isMe = linkedId === currentUserId;
                                    const isFriend = linkedId && myConnectionIds.has(linkedId);
                                    const isRequested = linkedId && myOutgoingRequestIds.has(linkedId);
                                    const canAddFriend = linkedId && !isMe && !isFriend && !isRequested;
                                    const matchedMember = members.find((m) => m.user_id === linkedId);

                                    let subtext: string;
                                    if (isMe) {
                                      subtext = isJoinedView ? "You" : "You • Owner";
                                    } else if (!isJoinedView && matchedMember) {
                                      subtext =
                                        matchedMember.added_via === "direct"
                                          ? `Added by ${
                                              matchedMember.invited_by
                                                ? inviterNames[matchedMember.invited_by] || "you"
                                                : "you"
                                            }`
                                          : matchedMember.added_via === "invite_link"
                                          ? "Joined via invite link"
                                          : linkedId
                                          ? "On Kindred"
                                          : "Not on Kindred yet";
                                    } else {
                                      subtext = linkedId ? "On Kindred" : "Not on Kindred yet";
                                    }

                                    return (
                                      <div
                                        key={person.id}
                                        className="p-4 sm:p-5 flex items-start justify-between gap-3 group hover:bg-paper transition-colors"
                                      >
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                          <div className="w-11 h-11 rounded-full bg-clay overflow-hidden shrink-0">
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
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <h4 className="text-sm font-bold text-ink leading-none truncate">
                                                {person.name}
                                              </h4>
                                              {isFriend && (
                                                <span className="text-[8px] text-accent font-bold uppercase tracking-widest flex items-center gap-0.5">
                                                  <Check size={9} /> Friends
                                                </span>
                                              )}
                                              {isRequested && (
                                                <span className="text-[8px] text-stone font-bold uppercase tracking-widest">
                                                  Sent
                                                </span>
                                              )}
                                              {canAddFriend && (
                                                <button
                                                  onClick={() => sendFriendRequestToPerson(linkedId!)}
                                                  disabled={sendingFriendTo === linkedId}
                                                  className="text-accent hover:text-ink transition-colors disabled:opacity-50"
                                                  title="Add as friend"
                                                >
                                                  <UserPlus size={11} />
                                                </button>
                                              )}
                                            </div>
                                            <p className="text-[10px] text-stone uppercase tracking-widest font-bold mt-0.5">
                                              {subtext}
                                            </p>
                                          </div>
                                        </div>
                                        {!isJoinedView && !isMe && (
                                          <button
                                            onClick={() => handleRemoveFromCircle(person.id, linkedId ?? null)}
                                            className="text-stone hover:text-red-500 text-xs transition-colors shrink-0 mt-1"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {displayCircle.people.length > 4 && (
                              <div className="p-4 text-center border-t border-line">
                                <button
                                  onClick={() => setShowAllMembers((v) => !v)}
                                  className="text-[10px] font-bold text-stone hover:text-accent uppercase tracking-widest transition-colors"
                                >
                                  {showAllMembers ? "Show Less" : `See All ${displayCircle.people.length} People`}
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {!isJoinedView && (
                          <div className="p-5 sm:p-6 bg-paper/50 flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-line">
                            <div className="relative kindred-dropdown">
                              <button
                                onClick={() => setShowAddPerson((v) => !v)}
                                className="text-[10px] font-bold text-ink uppercase tracking-[0.2em] hover:underline"
                              >
                                Add Someone
                              </button>
                              {showAddPerson && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-line rounded-2xl shadow-xl p-2 z-20 min-w-[200px] max-h-64 overflow-y-auto">
                                  {peopleNotInCircle.length === 0 &&
                                  friends.filter(
                                    (f) => !displayCircle.people.some((p) => p.linked_user_id === f.id)
                                  ).length === 0 ? (
                                    <p className="text-xs text-stone px-3 py-2">
                                      Everyone is already in this circle.
                                    </p>
                                  ) : (
                                    <>
                                      {peopleNotInCircle.length > 0 && (
                                        <>
                                          <p className="text-[9px] font-bold text-stone/60 uppercase tracking-widest px-3 pt-1 pb-1">
                                            Your People
                                          </p>
                                          {peopleNotInCircle.map((person) => (
                                            <button
                                              key={person.id}
                                              onClick={() => handleAddPersonToCircle(person.id)}
                                              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-paper transition-colors text-left"
                                            >
                                              <div className="w-6 h-6 rounded-full bg-clay overflow-hidden shrink-0">
                                                {person.photo_url ? (
                                                  <img
                                                    src={person.photo_url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                  />
                                                ) : (
                                                  <div className="w-full h-full flex items-center justify-center font-serif italic text-ink text-[9px]">
                                                    {person.name.charAt(0).toUpperCase()}
                                                  </div>
                                                )}
                                              </div>
                                              <span className="text-xs font-bold text-ink">{person.name}</span>
                                            </button>
                                          ))}
                                        </>
                                      )}
                                      {friends.filter(
                                        (f) => !displayCircle.people.some((p) => p.linked_user_id === f.id)
                                      ).length > 0 && (
                                        <>
                                          <p className="text-[9px] font-bold text-stone/60 uppercase tracking-widest px-3 pt-2 pb-1">
                                            Friends
                                          </p>
                                          {friends
                                            .filter(
                                              (f) =>
                                                !displayCircle.people.some((p) => p.linked_user_id === f.id)
                                            )
                                            .map((f) => (
                                              <button
                                                key={f.id}
                                                onClick={() => handleAddFriendAsMember(f.id)}
                                                className="w-full text-left px-3 py-2 rounded-xl hover:bg-paper text-xs font-bold text-ink"
                                              >
                                                {f.name}
                                              </button>
                                            ))}
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            <span className="text-stone text-[10px]">or</span>
                            <button
                              onClick={handleCreateInvite}
                              disabled={creatingInvite}
                              className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] hover:underline disabled:opacity-50"
                            >
                              Invite via Link
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {detailTab === "memories" && (
                    <div className="pt-2">
                      <div className="flex justify-end mb-4">
                        <Link
                          href={`/capture?circleId=${displayCircle.id}`}
                          className="bg-accent text-white px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 hover:shadow-lg hover:shadow-accent/20 transition-all duration-300"
                        >
                          Add Memory to {displayCircle.name}
                        </Link>
                      </div>
                      {loadingMemories ? (
                        <div className="py-16 flex justify-center">
                          <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
                        </div>
                      ) : displayCircle.people.length === 0 ? (
                        <p className="text-stone text-sm text-center py-16">
                          Add people to this circle first, then shared memories
                          about them will show up here.
                        </p>
                      ) : sharedMemories.length === 0 ? (
                        <p className="text-stone text-sm text-center py-16">
                          No shared memories yet. Turn on &ldquo;Share with
                          Family Circle&rdquo; when adding a memory for anyone
                          in this circle.
                        </p>
                      ) : (
                        <div className="space-y-10 sm:space-y-12">
                          {sortedYears.map((year) => (
                            <div key={year}>
                              <div className="relative pl-10 sm:pl-12 mb-6 sm:mb-8 flex items-center gap-3">
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 sm:w-8 h-[1px] bg-gradient-to-r from-transparent to-line" />
                                <span className="text-[10px] font-bold text-stone uppercase tracking-[0.3em] bg-paper px-3 py-1 rounded-full border border-line">
                                  {year}
                                </span>
                                <div className="flex-1 h-[1px] bg-gradient-to-r from-line to-transparent" />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 relative">
                                <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-line" />
                                {memoriesByYear[year].map((memory, index) => {
                                  const isRight = index % 2 === 1;
                                  return (
                                    <div
                                      key={memory.id}
                                      className={`relative group ${isRight ? "md:mt-16" : ""}`}
                                    >
                                      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-accent/15 group-hover:ring-accent/30 transition-all duration-300 z-10" />
                                      <CircleMemoryCard
                                        memory={memory}
                                        circleName={displayCircle.name}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>

            {displayCircle && !isJoinedView && (
              <div className="space-y-8 sm:space-y-12">
                <section className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 border border-line space-y-5 sm:space-y-6">
                  <h3 className="font-serif text-lg sm:text-xl italic text-ink">
                    Invite via Link
                  </h3>
                  <p className="text-stone text-xs leading-relaxed">
                    Send this unique link to family or friends. It grants them
                    access to view memories shared in {displayCircle.name}.
                  </p>

                  {error && (
                    <p className="text-red-600 text-xs bg-red-50 rounded-lg p-3">{error}</p>
                  )}

                  {activeInvite ? (
                    <div className="relative">
                      <input
                        ref={inviteInputRef}
                        type="text"
                        readOnly
                        value={`${
                          typeof window !== "undefined" ? window.location.origin : ""
                        }/join/${activeInvite.token}`}
                        className="w-full bg-paper border border-line rounded-xl px-4 py-4 text-xs font-mono text-stone pr-12 focus:outline-none focus:ring-1 focus:ring-accent truncate"
                      />
                      <button
                        onClick={() => copyLink(activeInvite.token)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-accent hover:text-ink transition-colors"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-stone text-xs italic bg-paper border border-line rounded-xl px-4 py-4">
                      No active invite link yet.
                    </p>
                  )}

                  <div className="pt-2 sm:pt-4 space-y-3">
                    <button
                      onClick={handleCreateInvite}
                      disabled={creatingInvite}
                      className="w-full bg-ink text-white py-3.5 sm:py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-accent transition-all disabled:opacity-50"
                    >
                      {creatingInvite ? "Generating..." : "Generate New Link"}
                    </button>
                    <p className="text-[9px] text-stone text-center italic">
                      Links expire after 7 days for security.
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && displayCircle && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-white border border-line rounded-[2rem] shadow-2xl p-6 sm:p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-4">
              <Trash2 size={18} />
            </div>
            <h3 className="font-serif text-xl italic text-ink mb-2">
              Delete &ldquo;{displayCircle.name}&rdquo;?
            </h3>
            <p className="text-stone text-xs leading-relaxed mb-6">
              This can&apos;t be undone. Memories inside this circle will stay
              in each person&apos;s own timeline, but the circle itself and
              its members will be gone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-paper border border-line text-stone py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteCircle(displayCircle.id);
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 bg-red-500 text-white py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function circleShareLabel(memory: CircleMemory, circleName: string): string {
  const sharedWithPerson = (memory as CircleMemory & { shared_with_person?: boolean })
    .shared_with_person;

  if (memory.circle_id) return `Shared in ${circleName}`;
  if (memory.is_shared) return "Shared with Family Circle";
  if (sharedWithPerson && memory.person) return `Shared with ${memory.person.name}`;
  return "Private";
}

function CircleMemoryCard({
  memory,
  circleName,
}: {
  memory: CircleMemory;
  circleName: string;
}) {
  const label = circleShareLabel(memory, circleName);
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

  const AuthorBadge = () => (
    <div className="flex items-center gap-2 mb-3 w-fit">
      <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 font-serif italic text-[10px]">
        {(memory.creator_name || "?").charAt(0).toUpperCase()}
      </div>
      <span className="text-[9px] font-bold text-stone uppercase tracking-widest">
        {memory.creator_name || "Someone"}
        {memory.person && (
          <span className="text-stone/60"> • about {memory.person.name}</span>
        )}
      </span>
    </div>
  );

  if (memory.type === "photo" && signedUrl) {
    return (
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-sm border border-line hover:shadow-xl transition-all">
        <img
          className="w-full aspect-[4/3] rounded-2xl sm:rounded-[1.5rem] object-cover mb-3 sm:mb-4"
          src={signedUrl}
          alt={memory.caption || ""}
        />
        <div className="px-1 sm:px-2">
          <AuthorBadge />
          <div className="flex justify-between items-center mb-2">
            {memory.caption && (
              <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
                {memory.caption}
              </h4>
            )}
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
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 shadow-sm border border-line hover:shadow-xl transition-all">
        <video
          src={signedUrl}
          controls
          className="w-full aspect-[4/3] rounded-2xl sm:rounded-[1.5rem] object-contain mb-3 sm:mb-4 bg-black"
        />
        <div className="px-1 sm:px-2">
          <AuthorBadge />
          <div className="flex justify-between items-center mb-2">
            {memory.caption && (
              <h4 className="font-serif text-base sm:text-lg italic text-ink truncate">
                {memory.caption}
              </h4>
            )}
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
      <div className="self-start bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-sm border border-line hover:shadow-xl transition-all">
        <AuthorBadge />
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
        <div className="flex justify-between items-center">
          <p className="text-[10px] text-stone font-bold">{dateLabel.toUpperCase()}</p>
          <p className="text-[9px] text-stone/70 uppercase tracking-widest font-bold">
            {label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="self-start bg-paper border border-line rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 italic text-center overflow-hidden">
      <AuthorBadge />
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

export default function FamilyCirclePage() {
  return (
    <Suspense fallback={null}>
      <FamilyCircleContent />
    </Suspense>
  );
}
