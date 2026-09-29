
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HouseIcon, Heart, History, Sparkles, Settings, User, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/home", label: "Home", icon: HouseIcon },
  { href: "/circle", label: "Circle", icon: Heart },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/timeline", label: "Timeline", icon: History },
  { href: "/challenges", label: "Challenges", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function fetchPending() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("friend_requests")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("status", "pending");
      setPendingRequests(count || 0);
    }

    fetchPending();
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-40 lg:hidden">
      <div className="flex items-center justify-between px-1 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-xl transition-colors ${
                isActive ? "text-accent" : "text-stone"
              }`}
            >
              <span className="relative">
                <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                {item.href === "/friends" && pendingRequests > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </span>
              <span className="text-[7px] font-bold uppercase tracking-tighter">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}