// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth_key");

  if (subsError || !subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), { status: 200 });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, notifications_enabled")
    .in("id", subs.map((s) => s.user_id))
    .eq("notifications_enabled", true);

  const optedInIds = new Set((profiles || []).map((p) => p.id));
  const targetSubs = subs.filter((s) => optedInIds.has(s.user_id));

  let sentCount = 0;

  for (const sub of targetSubs) {
    const { data: people } = await supabase
      .from("people")
      .select("id, name")
      .eq("owner_id", sub.user_id)
      .neq("relationship", "self");

    if (!people || people.length === 0) continue;

    const { data: memories } = await supabase
      .from("memories")
      .select("person_id, memory_date")
      .eq("creator_id", sub.user_id);

    let bestPerson: { id: string; name: string } | null = null;
    let bestGap = -1;

    for (const person of people) {
      const personMemories = (memories || []).filter((m) => m.person_id === person.id);
      const lastDate = personMemories
        .map((m) => new Date(m.memory_date).getTime())
        .sort((a, b) => b - a)[0];
      const gapDays = lastDate
        ? Math.floor((Date.now() - lastDate) / 86400000)
        : 9999;
      if (gapDays >= 7 && gapDays > bestGap) {
        bestGap = gapDays;
        bestPerson = person;
      }
    }

    if (!bestPerson) continue;

    const payload = JSON.stringify({
      title: "Kindred",
      body:
        bestGap >= 9999
          ? `You haven't saved a memory with ${bestPerson.name} yet.`
          : `It's been ${bestGap} days since your last memory with ${bestPerson.name}.`,
      url: `/capture?personId=${bestPerson.id}`,
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        payload
      );
      sentCount++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  return new Response(JSON.stringify({ sent: sentCount }), { status: 200 });
});