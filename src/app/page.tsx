"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Feather, Sparkles, Vault } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function useFadeInOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useFadeInOnScroll();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function WelcomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      setChecking(false);
    }

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const primaryHref = isLoggedIn ? "/home" : "/signup";
  const primaryLabel = isLoggedIn ? "Go to your vault" : "Start Saving Moments";

  const whyCards = [
    {
      title: "Stories worth keeping",
      desc: "The small rituals become the big memories. We help you notice them before they slip away.",
      img: "https://images.unsplash.com/photo-1758874959820-56eb362040e5?w=700&q=80&fm=jpg&fit=crop",
    },
    {
      title: "Made for real life",
      desc: "No feeds, no likes, no noise. Just a calm place to gather what your family actually lived.",
      img: "https://images.unsplash.com/photo-1579017308347-e53e0d2fc5e9?w=700&q=80&fm=jpg&fit=crop",
    },
    {
      title: "Private by design",
      desc: "Your family's story stays yours. Encrypted, ad-free, and never sold — ever.",
      img: "https://images.unsplash.com/photo-1720534195942-d55d1760df95?w=700&q=80&fm=jpg&fit=crop",
    },
  ];

  return (
    <div className="bg-cream text-ink">

      <div className="md:hidden min-h-screen bg-ink relative overflow-hidden flex items-center justify-center p-6 pt-24">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 max-w-lg w-full text-center text-white space-y-8">
          <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em] block">
            A quiet space for what matters
          </span>

          <h1 className="font-serif text-4xl sm:text-5xl italic leading-tight">
            Save the moment before it becomes a memory.
          </h1>

          <p className="text-white/70 text-base leading-relaxed max-w-md mx-auto">
            Kindred gently prompts your family to capture the fleeting daily
            joys — then weaves them into a living story you can revisit forever.
          </p>

          {!checking && (
            <div className="flex flex-col gap-4 justify-center pt-4">
              <Link
                href={primaryHref}
                className="bg-accent text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-xs shadow-xl shadow-accent/20"
              >
                {primaryLabel}
              </Link>
              {!isLoggedIn && (
                <Link
                  href="/login"
                  className="bg-white/10 border border-white/20 text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-xs"
                >
                  Log In
                </Link>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-widest pt-8">
            <span className="w-8 h-px bg-white/20" />
            Private by design
            <span className="w-8 h-px bg-white/20" />
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-cream/80 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-8 border border-line shadow-sm">
          <span className="font-serif text-xl tracking-tight">
            K<span className="text-accent">i</span>ndred
          </span>
          <div className="flex items-center gap-1 text-sm font-medium">
            <a href="#how" className="px-4 py-2 hover:text-accent transition-colors">
              How it Works
            </a>
            <a href="#why" className="px-4 py-2 hover:text-accent transition-colors">
              Why Kindred
            </a>
          </div>
          {!checking && (
            <div className="flex items-center gap-3">
              {!isLoggedIn && (
                <Link
                  href="/login"
                  className="text-sm font-medium text-ink hover:text-accent transition-colors px-2"
                >
                  Log In
                </Link>
              )}
              <Link
                href={primaryHref}
                className="bg-accent text-white rounded-full px-5 py-2.5 text-sm font-bold hover:scale-105 transition-transform"
              >
                {isLoggedIn ? "Your Vault" : "Get Started"}
              </Link>
            </div>
          )}
        </nav>

        <section className="pt-40 pb-20 px-6 md:px-12 max-width: 1440px mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <FadeIn className="space-y-8">
              <p className="text-stone uppercase tracking-widest text-xs font-bold">
                A quiet space for what matters
              </p>
              <h1 className="font-serif text-5xl lg:text-6xl leading-[1.1]">
                Save the moment
                <br />
                before it becomes
                <br />
                a memory<span className="text-accent">.</span>
              </h1>
              <p className="text-lg text-stone max-w-md leading-relaxed">
                Kindred gently prompts your family to capture the fleeting daily
                joys — then weaves them into a living story you can revisit forever.
              </p>
              <Link
                href={primaryHref}
                className="inline-block bg-accent text-white px-8 py-4 rounded-full text-sm font-bold shadow-lg shadow-accent/20 transition-all duration-300 hover:scale-105"
              >
                {primaryLabel}
              </Link>
            </FadeIn>
            <FadeIn delay={150} className="relative  aspect-ratio: 4/5 rounded-2xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1560328055-e938bb2ed50a?w=900&h=1125&q=80&fm=jpg&fit=crop&crop=faces"
                alt="A father carrying his son, a warm candid family moment"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 background-image: linear-gradient(var(--tw-gradient-stops)) from-ink/50 via-transparent to-transparent" />
              <div className="absolute bottom-8 left-8 right-8">
                <span className="font-serif text-2xl italic text-white">
                  Every relationship is a library of stories.
                </span>
              </div>
            </FadeIn>
          </div>
        </section>

        <section id="how" className="py-24 px-6 md:px-12 max-width: 1440px mx-auto">
          <FadeIn>
            <h2 className="font-serif text-4xl mb-12">How it Works</h2>
          </FadeIn>
          <div className="border-t border-line">
            {[
              {
                num: "01",
                title: "Nudge",
                desc: "Gentle daily prompts invite each family member to write a few lines or record a short voice note about their day — no pressure, just presence.",
                icon: Feather,
              },
              {
                num: "02",
                title: "Create",
                desc: "Kindred stitches entries together into a simple, beautiful timeline — photos, words, and voices arranged in a shared family thread.",
                icon: Sparkles,
              },
              {
                num: "03",
                title: "Save",
                desc: "Everything lives in a private, secure vault — yours to revisit, share, or print as a keepsake years from now.",
                icon: Vault,
              },
            ].map((row, i) => (
              <FadeIn key={row.num} delay={i * 100}>
                <div className="border-b border-line py-12 grid grid-cols-12 gap-8 items-center">
                  <div className="col-span-1 text-stone text-sm">{row.num}</div>
                  <div className="col-span-3">
                    <h3 className="font-serif text-2xl">{row.title}</h3>
                  </div>
                  <div className="col-span-5">
                    <p className="text-stone leading-relaxed">{row.desc}</p>
                  </div>
                  <div className="col-span-3 text-right">
                    <row.icon size={28} className="inline-block opacity-30" />
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        <section id="why" className="py-24 px-6 md:px-12 max-width: 1440px mx-auto">
          <FadeIn>
            <h2 className="font-serif text-4xl mb-12">Why Kindred</h2>
          </FadeIn>
          <div className="flex gap-6 overflow-x-auto pb-8">
            {whyCards.map((card, i) => (
              <FadeIn key={card.title} delay={i * 120} className="min-w-[320px] space-y-4">
                <div className="aspect-square rounded-xl overflow-hidden bg-clay">
                  <img
                    src={card.img}
                    alt={card.title}
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700 hover:scale-105"
                  />
                </div>
                <h3 className="font-serif text-xl">{card.title}</h3>
                <p className="text-stone text-sm">{card.desc}</p>
              </FadeIn>
            ))}
          </div>
        </section>

        <section className="py-24 px-6 md:px-12 max-width: 1440px mx-auto">
          <FadeIn className="bg-paper p-12 md:p-20 rounded-[3rem] shadow-soft">
            <div className="max-w-3xl">
              <p className="font-serif text-3xl md:text-4xl leading-snug mb-10">
                &ldquo;Kindred doesn&apos;t feel like another digital chore; it feels
                like a soft conversation with my past.&rdquo;
              </p>
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-clay ring-1 ring-line flex items-center justify-center font-serif text-xl text-ink">
                  E
                </div>
                <div>
                  <p className="font-medium">Elena M.</p>
                  <p className="text-stone text-sm">Mother of two • Early companion</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        <footer className="border-t border-line bg-paper">
          <div className="px-6 md:px-12 max-width: 1440px mx-auto py-16 grid grid-cols-3 gap-12">
            <div>
              <span className="font-serif text-2xl tracking-tight">Kindred</span>
              <p className="text-stone mt-4 font-serif italic">
                Keeping family stories alive, softly.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-6">Explore</h4>
              <ul className="space-y-4 text-stone text-sm">
                <li>
                  <a href="#how" className="hover:text-ink transition-colors">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="#why" className="hover:text-ink transition-colors">
                    Why Kindred
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-6">Vault Status</h4>
              <div className="flex items-center gap-2 text-stone text-sm">
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                Safe &amp; Private
              </div>
            </div>
          </div>
          <div className="px-6 md:px-12 max-width: 1440px mx-auto py-8 border-t border-line flex justify-between items-center text-xs text-stone">
            <p>&copy; 2026 Kindred. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}