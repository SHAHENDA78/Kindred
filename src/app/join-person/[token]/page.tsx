"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinPersonPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [personName, setPersonName] = useState<string>("");
  const [expired, setExpired] = useState(false);
  const [alreadyLinked, setAlreadyLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    run();
  }, [token]);

  async function run() {
    const supabase = createClient();

    const { data: invite, error: inviteError } = await supabase
      .from("person_invites")
      .select("*, person:people(id, name, linked_user_id)")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      setError("This invite link is invalid.");
      setLoading(false);
      return;
    }

    if (new Date(invite.expires_at) < new Date()) {
      setExpired(true);
      setLoading(false);
      return;
    }

    if (invite.person?.linked_user_id) {
      setAlreadyLinked(true);
      setLoading(false);
      return;
    }

    setPersonName(invite.person?.name || "this person");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/signup?redirect=/join-person/${token}`);
      return;
    }

    const { data: result, error: rpcError } = await supabase.rpc("claim_person_invite", {
      invite_token: token,
    });

    if (rpcError || !result?.success) {
      setError("Couldn't complete the link. This invite may already be used or expired.");
      setLoading(false);
      return;
    }

    setJoined(true);
    setLoading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-xl border border-line p-8 sm:p-10 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-serif text-ink mb-3">Invite not found</h1>
            <p className="text-stone text-sm mb-6">{error}</p>
          </>
        ) : expired ? (
          <>
            <h1 className="text-xl font-serif text-ink mb-3">This invite has expired</h1>
            <p className="text-stone text-sm mb-6">
              Ask whoever sent this link to create a new one.
            </p>
          </>
        ) : alreadyLinked ? (
          <>
            <h1 className="text-xl font-serif text-ink mb-3">Already connected</h1>
            <p className="text-stone text-sm mb-6">
              This person is already linked to an account.
            </p>
          </>
        ) : joined ? (
          <>
            <h1 className="text-2xl font-serif italic text-ink mb-3">You&apos;re connected </h1>
            <p className="text-stone text-sm mb-6">
              You&apos;re now connected as {personName}. You can see and add
              your own memories.
            </p>
            <a
              href="/home"
              className="inline-block bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px]"
            >
              Go to Kindred
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}