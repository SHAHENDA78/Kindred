"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mic, Square, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Person, ChallengeTemplate } from "@/lib/types";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function AskContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const personChallengeId = params.questionId as string;
  const initialMode = (searchParams.get("mode") as "voice" | "text") || "voice";

  const [person, setPerson] = useState<Person | null>(null);
  const [template, setTemplate] = useState<ChallengeTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"voice" | "text">(initialMode);

  const [textAnswer, setTextAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  useEffect(() => {
    fetchData();
  }, [personChallengeId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => setRecordedSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  async function fetchData() {
    const { data: pc } = await supabase
      .from("person_challenges")
      .select("*, person:people(*), template:challenge_templates(*)")
      .eq("id", personChallengeId)
      .single();

    if (!pc) {
      router.replace("/challenges");
      return;
    }

    setPerson(pc.person);
    setTemplate(pc.template);


    setLoading(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordedSeconds(0);
    } catch {
      alert("Couldn't access your microphone. Please allow microphone access.");
    }
  }

  function stopRecording() {
    mediaRecorder?.stop();
    setIsRecording(false);
  }

  function reRecord() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordedSeconds(0);
  }

  async function handleSaveVoice() {
    if (!audioBlob || !person) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${crypto.randomUUID()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from("memories")
      .upload(filePath, audioBlob);

    if (uploadError) {
      setSaving(false);
      alert("Couldn't save the recording: " + uploadError.message);
      return;
    }

    const creatorName =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone";

    const { data: memory } = await supabase
      .from("memories")
      .insert({
        person_id: person.id,
        creator_id: user.id,
        creator_name: creatorName,
        type: "voice",
        media_url: filePath,
        duration_seconds: recordedSeconds,
        caption: template?.description || null,
        memory_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    await supabase
      .from("person_challenges")
      .update({ status: "completed", completed_memory_id: memory?.id })
      .eq("id", personChallengeId);

    setSaving(false);
    router.push(`/people/${person.id}`);
  }

  async function handleSaveText() {
    if (!textAnswer.trim() || !person) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const creatorName =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone";

    const { data: memory } = await supabase
      .from("memories")
      .insert({
        person_id: person.id,
        creator_id: user.id,
        creator_name: creatorName,
        type: "text",
        caption: textAnswer.trim(),
        memory_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    await supabase
      .from("person_challenges")
      .update({ status: "completed", completed_memory_id: memory?.id })
      .eq("id", personChallengeId);

    setSaving(false);
    router.push(`/people/${person.id}`);
  }

  async function handleSkip() {
    await supabase.from("person_challenges").delete().eq("id", personChallengeId);
    router.push("/challenges");
  }

  if (loading || !person || !template) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-paper">
      <div className="max-w-[800px] w-full">
        <header className="text-center mb-10 sm:mb-16">
          <Link href="/challenges" className="font-serif text-2xl tracking-tight mb-8 sm:mb-12 inline-block">
            K<span className="text-accent">i</span>ndred
          </Link>
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full border-4 border-white shadow-md overflow-hidden bg-clay flex items-center justify-center">
              {person.photo_url ? (
                <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-serif italic text-ink text-lg">
                  {person.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">
              Question for {person.name}
            </p>
          </div>
        </header>

        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-16 md:p-20 shadow-2xl border border-line text-center relative overflow-hidden">
          <div className="relative z-10 space-y-8 sm:space-y-10">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif text-ink italic leading-tight px-2 sm:px-4">
              &ldquo;{template.description}&rdquo;
            </h1>

            <p className="text-stone max-w-md mx-auto text-sm leading-relaxed">
              Recorded answers are automatically saved to {person.name}&apos;s
              memories.
            </p>

            {mode === "voice" ? (
              <div className="flex flex-col items-center gap-6 pt-4 sm:pt-8">
                {!audioUrl ? (
                  <>
                    <p className="text-sm text-stone tracking-widest font-mono">
                      {formatTime(recordedSeconds)}
                    </p>
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center shadow-xl shadow-accent/20 hover:scale-105 transition-all"
                      >
                        <Mic size={22} />
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-ink text-white flex items-center justify-center shadow-xl animate-pulse"
                      >
                        <Square size={20} />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-full max-w-sm flex flex-col items-center gap-4">
                    <audio src={audioUrl} controls className="w-full" />
                    <div className="flex gap-3">
                      <button
                        onClick={reRecord}
                        className="flex items-center gap-2 text-stone hover:text-accent text-xs font-bold uppercase tracking-widest"
                      >
                        <RotateCcw size={12} /> Record again
                      </button>
                    </div>
                    <button
                      onClick={handleSaveVoice}
                      disabled={saving}
                      className="w-full bg-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save This Memory"}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setMode("text")}
                  className="text-[10px] font-bold text-stone uppercase tracking-widest hover:text-ink transition-colors"
                >
                  Type instead
                </button>
              </div>
            ) : (
              <div className="max-w-md mx-auto space-y-4 pt-4 sm:pt-8">
                <textarea
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  rows={5}
                  placeholder="Write their answer here..."
                  className="w-full bg-paper border border-line rounded-2xl px-5 py-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
                <button
                  onClick={handleSaveText}
                  disabled={saving || !textAnswer.trim()}
                  className="w-full bg-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-accent/20 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save This Memory"}
                </button>
                <button
                  onClick={() => setMode("voice")}
                  className="text-[10px] font-bold text-stone uppercase tracking-widest hover:text-ink transition-colors block mx-auto"
                >
                  Record voice instead
                </button>
              </div>
            )}

            <div className="pt-6 sm:pt-10 border-t border-line">
              <button
                onClick={handleSkip}
                className="text-xs font-bold text-stone uppercase tracking-widest hover:text-ink hover:underline transition-colors py-2 px-4"
              >
                Skip for another time
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskContent />
    </Suspense>
  );
}