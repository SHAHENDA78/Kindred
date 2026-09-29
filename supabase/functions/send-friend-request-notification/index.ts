// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  const { sender_id, receiver_id } = await req.json();
  if (!sender_id || !receiver_id) {
    return new Response(JSON.stringify({ error: "missing ids" }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", sender_id)
    .maybeSingle();

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", receiver_id);

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), { status: 200 });
  }

  const payload = JSON.stringify({
    title: "Kindred",
    body: `${senderProfile?.full_name || "Someone"} sent you a friend request.`,
    url: "/friends",
  });

  let sentCount = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
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