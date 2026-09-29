"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HouseIcon,
  Heart,
  History,
  Sparkles,
  Settings,
  LogOut,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/home", label: "Home", icon: HouseIcon },
  { href: "/circle", label: "Family Circle", icon: Heart },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/timeline", label: "Timeline", icon: History },
  { href: "/challenges", label: "Challenges", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("");
    const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email || "");

          const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .maybeSingle();
        setAvatarUrl(profile?.avatar_url || null);

        const { count } = await supabase
          .from("friend_requests")
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", user.id)
          .eq("status", "pending");
        setPendingRequests(count || 0);
      }
    }

    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserName(session.user.user_metadata?.full_name || session.user.email || "");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const firstName = userName.split(" ")[0] || "";
  const initial = userName.charAt(0).toUpperCase() || "?";

  return (
    <aside className="hidden lg:flex w-72 bg-white border-r border-line h-screen sticky top-0 flex-col p-8 z-30">
      <div className="mb-12">
        <Link href="/home" className="font-serif text-2xl tracking-tight">
          K<span className="text-accent">i</span>ndred
        </Link>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                isActive
                  ? "bg-paper text-accent border-r-3 border-accent"
                  : "text-stone hover:bg-paper hover:text-ink"
              }`}
            >
              <span className="relative">
                <Icon size={14} />
                {item.href === "/friends" && pendingRequests > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="pt-8 border-t border-line mt-8">
        <div className="flex items-center justify-between gap-2 px-2">
          <Link href="/profile" className="flex items-center gap-3 min-w-0 hover:opacity-70 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-clay flex items-center justify-center text-ink font-bold text-sm border border-line shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink truncate">{firstName || "..."}</p>
              <p className="text-[10px] text-stone uppercase tracking-widest font-bold">
                Your Vault
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title="Log out"
            className="w-9 h-9 rounded-full flex items-center justify-center text-stone hover:text-accent hover:bg-paper transition-all shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}