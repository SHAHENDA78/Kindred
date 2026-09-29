"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface InviteInfo {
  circleId: string;
  circleName: string;
}

export default function JoinCirclePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    run();
  }, [token]);

  async function run() {
    const supabase = createClient();
    if (!token) return;

    const { data, error: rpcError } = await supabase.rpc("get_invite_circle_name", {
      p_token: token,
    });

    if (rpcError || !data || !data.valid) {
      if (data?.reason === "expired") {
        setExpired(true);
      } else {
        setError("This invite link is invalid.");
      }
      setLoading(false);
      return;
    }

    const info: InviteInfo = { circleId: data.circle_id, circleName: data.circle_name };
    setInvite(info);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/signup?redirect=/join/${token}`);
      return;
    }

    const { data: joinResult, error: joinError } = await supabase.rpc("accept_circle_invite", {
      p_token: token,
    });

    if (joinError || !joinResult?.success) {
      setError("Couldn't join this circle. The link may already be used.");
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
            <a
              href="/home"
              className="inline-block bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px]"
            >
              Go to Kindred
            </a>
          </>
        ) : expired ? (
          <>
            <h1 className="text-xl font-serif text-ink mb-3">This invite has expired</h1>
            <p className="text-stone text-sm mb-6">
              Ask whoever sent this link to create a new one.
            </p>
          </>
        ) : joined && invite ? (
          <>
            <h1 className="text-2xl font-serif italic text-ink mb-3">You&apos;re joined </h1>
            <p className="text-stone text-sm mb-6">
              You&apos;ve successfully joined {invite.circleName}.
            </p>
            <a
              href={`/circle?circle=${invite.circleId}`}
              className="inline-block bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px]"
            >
              Go to {invite.circleName}
            </a>
          </>
        ) : null}
      </div>
    </main>
  );
}