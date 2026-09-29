"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/sidebar";
import { AppLockGate } from "@/components/AppLockGate";
import { createClient } from "@/lib/supabase/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppLockGate>
      <div className="min-h-screen bg-paper flex">
        <Sidebar />
<div className="flex-1 min-w-0 pb-15 lg:pb-0">{children}</div> 
       <MobileNav />
      </div>
    </AppLockGate>
  );
}