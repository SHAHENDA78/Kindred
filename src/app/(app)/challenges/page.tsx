"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Mic, Camera, MessageCircle, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Person, ChallengeTemplate } from "@/lib/types";



interface ChallengeTemplateWithAudience extends ChallengeTemplate {
  audience?: "elder" | "peer" | "younger" | null;
}

function relationshipGroup(relationship: string): "elder" | "peer" | "younger" {
  const r = relationship.toLowerCase();
  if (r === "parent" || r === "grandparent" || r === "relative") return "elder";
  if (r === "child" || r === "grandchild") return "younger";
  return "peer";
}

interface Suggestion {
  template: ChallengeTemplateWithAudience;
  person: Person;
}

const CATEGORY_TONES: Record<string, string> = {
  "Your Own": "bg-ink text-white",
};

export default function ChallengesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [people, setPeople] = useState<Person[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);
  const customTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);
    async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: peopleData } = await supabase
      .from("people")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    setPeople(peopleData || []);

    const { data: globalTemplates } = await supabase
      .from("challenge_templates")
      .select("*")
      .is("owner_id", null)
      .order("created_at", { ascending: true });

    const { data: myTemplates } = await supabase
      .from("challenge_templates")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    const templatesData: ChallengeTemplateWithAudience[] = [
      ...(globalTemplates || []),
      ...(myTemplates || []),
    ];

    const { data: completedRows } = await supabase
      .from("person_challenges")
      .select("person_id, template_id")
      .eq("status", "completed");

    const pairs = new Set(
      (completedRows || []).map((r) => `${r.person_id}:${r.template_id}`)
    );

    const { data: memoryRows } = await supabase
      .from("memories")
      .select("person_id")
      .eq("creator_id", user.id);

    const memoryCountByPerson: Record<string, number> = {};
    (memoryRows || []).forEach((m) => {
      if (!m.person_id) return;
      memoryCountByPerson[m.person_id] = (memoryCountByPerson[m.person_id] || 0) + 1;
    });

    const askablePeople = (peopleData || []).filter((p) => p.linked_user_id !== user.id);
if (askablePeople.length > 0 && templatesData.length > 0) {
  const sortedPeople = [...askablePeople].sort(
        (a, b) =>
          (memoryCountByPerson[a.id] || 0) - (memoryCountByPerson[b.id] || 0)
      );
      const candidatesByPerson = sortedPeople.map((person) => {
        const group = relationshipGroup(person.relationship);
        const options = templatesData.filter((t) => {
          if (pairs.has(`${person.id}:${t.id}`)) return false;
          if (!t.audience) return true;
          return t.audience === group;
        });
        options.sort(() => Math.random() - 0.5);
        return { person, options };
      });
      const built: Suggestion[] = [];
      let cursor = 0;
      let progress = true;
      while (built.length < 4 && progress) {
        progress = false;
        for (const entry of candidatesByPerson) {
          if (built.length >= 4) break;
          const next = entry.options.shift();
          if (next) {
            built.push({ template: next, person: entry.person });
            progress = true;
          }
        }
        cursor++;
        if (cursor > 20) break; 
      }

      setSuggestions(built);
    } else {
      setSuggestions([]);
    }

    setLoading(false);
  }

  async function handleStart(suggestion: Suggestion, mode: "voice" | "text") {
    const key = `${suggestion.person.id}:${suggestion.template.id}`;
    setStarting(key);

    const { data: pc, error } = await supabase
      .from("person_challenges")
      .insert({
        person_id: suggestion.person.id,
        template_id: suggestion.template.id,
        status: "pending",
      })
      .select("id")
      .single();

    setStarting(null);

    if (error || !pc) {
      alert("Couldn't start this. Please try again.");
      return;
    }

    router.push(`/ask/${pc.id}?mode=${mode}`);
  }

  async function handleSaveCustom() {
    if (!customTitle.trim() || !customQuestion.trim()) return;
    setSavingCustom(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("challenge_templates").insert({
      owner_id: user.id,
      title: customTitle.trim(),
      description: customQuestion.trim(),
      category: "Your Own",
      suggested_type: "text",
    });

    setSavingCustom(false);

    if (!error) {
      setShowCustomForm(false);
      setCustomTitle("");
      setCustomQuestion("");
      await fetchData();
    }
  }

  if (loading) {
    return (
      <main className="p-6 sm:p-12 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="pb-24 lg:pb-12">
      <div className="relative overflow-hidden bg-paper px-4 sm:px-8 md:px-12 pt-14 sm:pt-20 pb-14 sm:pb-16 mb-10 sm:mb-16 border-b border-line">
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
            Active Companion
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif italic text-ink leading-[1.15] mb-4">
            Small prompts,
            <br />
            beautiful memories.
          </h1>
          <p className="text-stone text-sm sm:text-base leading-relaxed max-w-md">
            A few light, optional suggestions to help you capture the details
            that usually go unrecorded.
          </p>
        </div>
      </div>

      <div className="px-4 sm:px-8 md:px-12">
        {showCustomForm && (
          <div className="max-w-6xl mx-auto mb-10 sm:mb-14 bg-white border-2 border-accent rounded-[2rem] p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-lg italic text-ink">Write your own question</h3>
              <button
                onClick={() => setShowCustomForm(false)}
                className="text-stone hover:text-ink transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
                  Short title
                </label>
                <input
                  ref={customTitleRef}
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Their wedding day"
                  className="w-full bg-paper border border-line rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
                  The question
                </label>
                <textarea
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  rows={3}
                  placeholder="What do you want to ask them?"
                  className="w-full bg-paper border border-line rounded-2xl px-5 py-3.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <button
                onClick={handleSaveCustom}
                disabled={savingCustom || !customTitle.trim() || !customQuestion.trim()}
                className="w-full bg-accent text-white py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 disabled:opacity-70"
              >
                {savingCustom ? "Saving..." : "Add to My Questions"}
              </button>
            </div>
          </div>
        )}

        {people.length === 0 ? (
          <div className="text-center py-16 max-w-md mx-auto">
            <p className="text-stone text-sm mb-6">
              Add someone first, then we&apos;ll suggest small ways to capture
              memories with them.
            </p>
            <Link
              href="/people/new"
              className="inline-block bg-accent text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20"
            >
              Add Someone
            </Link>
          </div>
        ) : (
          <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <button
              onClick={() => {
                setShowCustomForm(true);
                setTimeout(() => customTitleRef.current?.focus(), 0);
              }}
              className="bg-paper border-2 border-dashed border-line rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 hover:border-accent hover:bg-white transition-all group flex flex-col items-center justify-center text-center min-h-[280px]"
            >
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center border-2 border-line text-line group-hover:text-accent group-hover:border-accent transition-all mb-5">
                <Plus size={22} />
              </div>
              <h4 className="font-serif text-lg italic text-stone group-hover:text-ink transition-colors mb-1">
                Write your own
              </h4>
              <p className="text-[9px] text-stone/60 font-bold uppercase tracking-widest">
                A question only you would ask
              </p>
            </button>

            {suggestions.length === 0 ? (
              <div className="sm:col-span-2 flex flex-col items-center justify-center text-center py-10 min-h-[280px]">
                <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-5">
                  <Sparkles size={20} />
                </div>
                <p className="text-stone text-sm max-w-xs">
                  You&apos;ve gone through every suggestion for now. Write
                  your own, or check back later.
                </p>
              </div>
            ) : (
              suggestions.map((s) => {
                const key = `${s.person.id}:${s.template.id}`;
                const isStarting = starting === key;
                const isAskable = s.template.suggested_type === "voice" || s.template.suggested_type === "text";
                const tone = CATEGORY_TONES[s.template.category] || "bg-white text-accent border border-accent/20";

                return (
                  <div
                    key={key}
                    className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-line shadow-sm hover:shadow-2xl hover:border-accent/30 transition-all duration-300 group flex flex-col h-full"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-clay overflow-hidden shrink-0">
                        {s.person.photo_url ? (
                          <img src={s.person.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-serif italic text-ink text-sm">
                            {s.person.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-stone uppercase tracking-widest">
                        For {s.person.name}
                      </span>
                      <span className={`ml-auto px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${tone}`}>
                        {s.template.category}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3">
                      <h3 className="text-xl font-serif italic text-ink leading-snug">
                        {s.template.title}
                      </h3>
                      <p className="text-stone text-xs leading-relaxed">
                        {s.template.description}
                      </p>
                    </div>

                    <div className="pt-8 mt-auto flex gap-2">
                      {isAskable ? (
                        <>
                          <button
                            onClick={() => handleStart(s, "voice")}
                            disabled={isStarting}
                            title="Record a voice answer"
                            className="flex-1 bg-ink text-white rounded-full py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <Mic size={12} /> Ask
                          </button>
                          <button
                            onClick={() => handleStart(s, "text")}
                            disabled={isStarting}
                            title="Type an answer instead"
                            className="w-10 h-10 rounded-full bg-paper text-stone flex items-center justify-center hover:bg-accent hover:text-white transition-all disabled:opacity-50 shrink-0"
                          >
                            <MessageCircle size={13} />
                          </button>
                        </>
                      ) : (
                        <Link
                          href={`/capture?personId=${s.person.id}`}
                          className="flex-1 bg-ink text-white rounded-full py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all flex items-center justify-center gap-1.5"
                        >
                          <Camera size={12} /> Capture
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}
      </div>
    </main>
  );
}