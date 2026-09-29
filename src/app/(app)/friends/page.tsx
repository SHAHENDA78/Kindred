"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, X, Check, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConnectionWithProfile } from "@/lib/types";

interface SearchResult {
  id: string;
  fullName: string;
  email: string | null;
}

interface IncomingRequest {
  id: string;
  senderId: string;
  senderName: string;
}

export default function FriendsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<ConnectionWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [connectionIds, setConnectionIds] = useState<Set<string>>(new Set());
  const [outgoingRequestIds, setOutgoingRequestIds] = useState<Set<string>>(new Set());
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [addFriendSuccess, setAddFriendSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    const supabase = createClient();
    const channel = supabase
      .channel("friend-requests-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => {
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connections" },
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
    setCurrentUserId(user.id);

    const { data: connectionRows } = await supabase
      .from("connections")
      .select("user_a, user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    const otherIds = (connectionRows || []).map((c) =>
      c.user_a === user.id ? c.user_b : c.user_a
    );
    setConnectionIds(new Set(otherIds));

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

    const { data: incomingRows } = await supabase
      .from("friend_requests")
      .select("id, sender_id")
      .eq("receiver_id", user.id)
      .eq("status", "pending");

    if (incomingRows && incomingRows.length > 0) {
      const senderIds = incomingRows.map((r) => r.sender_id);
      const { data: senderProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);
      const nameMap = new Map(
        (senderProfiles || []).map((p) => [p.id, p.full_name || "Someone"])
      );
      setIncomingRequests(
        incomingRows.map((r) => ({
          id: r.id,
          senderId: r.sender_id,
          senderName: nameMap.get(r.sender_id) || "Someone",
        }))
      );
    } else {
      setIncomingRequests([]);
    }

    const { data: outgoingRows } = await supabase
      .from("friend_requests")
      .select("receiver_id")
      .eq("sender_id", user.id)
      .eq("status", "pending");
    setOutgoingRequestIds(new Set((outgoingRows || []).map((r) => r.receiver_id)));

    setLoading(false);
  }

  async function handleSearch() {
    if (!searchQuery.trim() || !currentUserId) return;
    setSearching(true);
    setAddFriendError(null);
    setSearchedOnce(true);

    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("full_name", `%${searchQuery.trim()}%`)
      .limit(10);

    const results = (data || [])
      .filter((p) => p.id !== currentUserId)
      .map((p) => ({
        id: p.id,
        fullName: p.full_name || "Someone",
        email: p.email || null,
      }));

    setSearchResults(results);
    setSearching(false);
  }

    useEffect(() => {
    if (!showAddFriend) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchedOnce(false);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, showAddFriend]);

  async function sendFriendRequest(receiverId: string) {
    if (!currentUserId) return;
    setSendingTo(receiverId);
    setAddFriendError(null);
    setAddFriendSuccess(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("friend_requests").insert({
      sender_id: currentUserId,
      receiver_id: receiverId,
      status: "pending",
    });

    setSendingTo(null);

    if (insertError) {
      setAddFriendError("Couldn't send the request. You may have already sent one.");
      return;
    }

    setOutgoingRequestIds((prev) => new Set(prev).add(receiverId));
    setAddFriendSuccess("Friend request sent!");

    try {
      await supabase.functions.invoke("send-friend-request-notification", {
        body: { sender_id: currentUserId, receiver_id: receiverId },
      });
    } catch {
   }
  }

  async function respondToRequest(requestId: string, senderId: string, accept: boolean) {
    if (!currentUserId) return;
    setRespondingId(requestId);

    const supabase = createClient();

    if (accept) {
      await supabase.rpc("accept_friend_request", { p_request_id: requestId });
    } else {
      await supabase
        .from("friend_requests")
        .update({ status: "declined" })
        .eq("id", requestId);
    }

    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
    setRespondingId(null);

    if (accept) {
      await fetchData();
    }
  }

  function closeAddFriend() {
    setShowAddFriend(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchedOnce(false);
    setAddFriendError(null);
    setAddFriendSuccess(null);
  }

  const TONES = ["bg-clay", "bg-paper", "bg-white"];
  const tilt = (i: number) => {
    const angles = [-2, 1.5, -1, 2, -1.5, 1];
    return angles[i % angles.length];
  };

  if (loading) {
    return (
      <main className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="pb-24 lg:pb-12 min-h-screen bg-cream">
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
            Woven Together
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif italic text-ink leading-[1.15] mb-4">
            Every story has more
            <br />
            than one voice.
          </h1>
          <p className="text-stone text-sm sm:text-base leading-relaxed max-w-md">
            The people you&apos;re connected with — sharing memories back and
            forth, one small moment at a time.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 md:px-16 pb-8 sm:pb-12">
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowAddFriend(true)}
            className="bg-accent text-white px-5 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-105 hover:shadow-xl transition-all duration-300 flex items-center gap-2"
          >
            <UserPlus size={13} /> Add Friend
          </button>
        </div>

        {incomingRequests.length > 0 && (
          <div className="mb-10 sm:mb-14 bg-white border border-line rounded-[2rem] p-5 sm:p-6 shadow-sm">
            <h2 className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] mb-4 px-1">
              Friend Requests
            </h2>
            <div className="space-y-2">
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 bg-paper/60 rounded-2xl px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-clay flex items-center justify-center font-serif italic text-ink text-base shrink-0">
                      {req.senderName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif italic text-sm text-ink truncate">
                        {req.senderName}
                      </p>
                      <p className="text-[9px] text-stone uppercase tracking-widest font-bold">
                        Wants to connect
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => respondToRequest(req.id, req.senderId, true)}
                      disabled={respondingId === req.id}
                      className="bg-accent text-white w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50"
                      title="Accept"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => respondToRequest(req.id, req.senderId, false)}
                      disabled={respondingId === req.id}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-stone hover:text-red-500 hover:bg-white transition-all disabled:opacity-50"
                      title="Decline"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {connections.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-stone mx-auto mb-6 border border-line shadow-sm">
              <span className="font-serif italic text-2xl text-accent">?</span>
            </div>
            <p className="font-serif italic text-lg sm:text-xl text-ink mb-2">
              No one here, yet.
            </p>
            <p className="text-stone text-sm max-w-sm mx-auto leading-relaxed">
              When someone accepts an invite from you, they&apos;ll show up
              here like a photo tucked into the album.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-8">
            {connections.map((conn, i) => (
              <Link
                key={conn.connectionUserId}
                href={`/together/${conn.connectionUserId}`}
                className="group"
                style={{ transform: `rotate(${tilt(i)}deg)` }}
              >
                <div
                  className={`${TONES[i % TONES.length]} rounded-[1.25rem] p-3 pb-5 shadow-sm border border-line w-full sm:w-40 hover:shadow-xl hover:-translate-y-1 hover:rotate-0 transition-all duration-300`}
                >
                  <div className="aspect-square rounded-lg bg-ink/5 border border-line/60 flex items-center justify-center mb-3 overflow-hidden">
                    {conn.avatarUrl ? (
                      <img src={conn.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-serif italic text-4xl sm:text-5xl text-ink/70">
                        {conn.fullName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="font-serif italic text-sm sm:text-base text-ink text-center truncate px-1">
                    {conn.fullName}
                  </p>
                  <p className="text-[8px] text-accent font-bold uppercase tracking-widest text-center mt-1">
                    Shared Story
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
            {showAddFriend && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-md flex items-end sm:items-center justify-center z-50">
          <div className="w-full sm:max-w-sm bg-cream rounded-t-[2.5rem] sm:rounded-[2.5rem] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="relative px-6 sm:px-8 pt-7 sm:pt-9 pb-6 text-center shrink-0">
              <button
                onClick={closeAddFriend}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white flex items-center justify-center text-stone hover:text-ink shadow-sm transition-colors"
              >
                <X size={14} />
              </button>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent mx-auto mb-3">
                <UserPlus size={18} />
              </div>
              <h3 className="font-serif text-2xl italic text-ink mb-1">Find a friend</h3>
              <p className="text-stone text-xs">
                Search by name and send them an invite.
              </p>
            </div>

            <div className="px-6 sm:px-8 pb-4 shrink-0">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Type a name..."
                  className="w-full bg-white border border-line rounded-full pl-11 pr-24 py-3.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || searching}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-accent text-white px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-40 disabled:scale-100"
                >
                  Search
                </button>
              </div>

              {addFriendError && (
                <p className="text-red-600 text-xs bg-red-50 rounded-xl p-3 mt-3">
                  {addFriendError}
                </p>
              )}
              {addFriendSuccess && (
                <p className="text-accent text-xs bg-accent/5 rounded-xl p-3 mt-3 flex items-center gap-2">
                  <Check size={12} /> {addFriendSuccess}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8">
              {searching ? (
                <div className="py-14 flex justify-center">
                  <div className="w-5 h-5 border-2 border-line border-t-accent rounded-full animate-spin" />
                </div>
              ) : !searchedOnce ? (
                <div className="text-center py-14">
                  <p className="text-stone text-xs leading-relaxed max-w-[200px] mx-auto">
                    Everyone you find here is already part of Kindred — just
                    waiting to be added.
                  </p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-14">
                  <p className="font-serif italic text-ink text-sm mb-1">
                    No one found.
                  </p>
                  <p className="text-stone text-xs">
                    Try a different spelling of their name.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((result) => {
                    const isFriend = connectionIds.has(result.id);
                    const isRequested = outgoingRequestIds.has(result.id);
                    return (
                      <div
                        key={result.id}
                        className="flex items-center gap-3 bg-white rounded-[1.25rem] p-3 shadow-sm border border-line/60"
                      >
                        <div className="w-12 h-12 rounded-full bg-clay flex items-center justify-center font-serif italic text-ink text-lg shrink-0">
                          {result.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-serif italic text-base text-ink truncate">
                            {result.fullName}
                          </p>
                          {result.email && (
                            <p className="text-[10px] text-stone truncate">{result.email}</p>
                          )}
                        </div>
                        {isFriend ? (
                          <span className="text-[9px] font-bold text-stone uppercase tracking-widest shrink-0 bg-paper px-3 py-2 rounded-full">
                            Friends
                          </span>
                        ) : isRequested ? (
                          <span className="text-[9px] font-bold text-accent uppercase tracking-widest shrink-0 flex items-center gap-1 bg-accent/5 px-3 py-2 rounded-full">
                            <Check size={11} /> Sent
                          </span>
                        ) : (
                          <button
                            onClick={() => sendFriendRequest(result.id)}
                            disabled={sendingTo === result.id}
                            className="bg-ink text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-accent hover:scale-110 transition-all disabled:opacity-50 shrink-0"
                          >
                            {sendingTo === result.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            ) : (
                              <UserPlus size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
