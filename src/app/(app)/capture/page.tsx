"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";
import {
  ChevronLeft, Camera, Mic, Video as VideoIcon, PenLine,
  Pause, RotateCcw, Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MemoryType = "photo" | "video" | "voice" | "text";

interface PersonOption {
  id: string;
  name: string;
  photo_url: string | null;
  linked_user_id: string | null;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function enrichWithProfilePhotos(
  supabaseClient: ReturnType<typeof createClient>,
  people: PersonOption[]
) {
  const missingPhotoLinkedIds = Array.from(
    new Set(
      people
        .filter((p) => !p.photo_url && p.linked_user_id)
        .map((p) => p.linked_user_id as string)
    )
  );
  if (missingPhotoLinkedIds.length === 0) return people;

  const { data: linkedProfiles } = await supabaseClient
    .from("profiles")
    .select("id, avatar_url")
    .in("id", missingPhotoLinkedIds);

  const avatarMap = Object.fromEntries(
    (linkedProfiles || []).map((p) => [p.id, p.avatar_url])
  );

  return people.map((p) =>
    !p.photo_url && p.linked_user_id && avatarMap[p.linked_user_id]
      ? { ...p, photo_url: avatarMap[p.linked_user_id] }
      : p
  );
}

function CaptureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const preselectedPersonId = searchParams.get("personId");
    const circleId = searchParams.get("circleId");

  const [memoryType, setMemoryType] = useState<MemoryType>("photo");
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [taggedPersonId, setTaggedPersonId] = useState<string>(preselectedPersonId ?? "");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [circleOptions, setCircleOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
    const [sharedWithPerson, setSharedWithPerson] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isSelfLocked, setIsSelfLocked] = useState(false);

  useEffect(() => {
    async function loadPeople() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
        const { data: ownedPeople } = await supabase
        .from("people")
        .select("id, name, photo_url, linked_user_id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });

      if (ownedPeople && ownedPeople.length > 0) {
        const linkedIds = ownedPeople.map((p) => p.linked_user_id).filter(Boolean) as string[];
        let accountAvatars: Record<string, string> = {};
        let accountNames: Record<string, string> = {};

        if (linkedIds.length > 0) {
          const { data: linkedProfiles } = await supabase
            .from("profiles")
            .select("id, avatar_url, full_name")
            .in("id", linkedIds);
          accountAvatars = Object.fromEntries(
            (linkedProfiles || [])
              .filter((p) => p.avatar_url)
              .map((p) => [p.id, p.avatar_url as string])
          );
          accountNames = Object.fromEntries(
            (linkedProfiles || [])
              .filter((p) => p.full_name)
              .map((p) => [p.id, p.full_name as string])
          );
        }

        const peopleWithFallback = ownedPeople.map((p) => ({
          ...p,
          name: (p.linked_user_id ? accountNames[p.linked_user_id] : null) || p.name,
          photo_url: p.photo_url || (p.linked_user_id ? accountAvatars[p.linked_user_id] : null) || null,
        }));

        setPeople(peopleWithFallback);
        return;
      }

      if (preselectedPersonId) {
        const { data: selfPerson } = await supabase
          .from("people")
          .select("id, name, photo_url, linked_user_id")
          .eq("id", preselectedPersonId)
          .maybeSingle();

        if (selfPerson) {
          const enrichedSelfPerson = await enrichWithProfilePhotos(supabase, [selfPerson]);
          setPeople(enrichedSelfPerson);
          setIsSelfLocked(true);
        }
      }
    }
    loadPeople();
  }, [supabase, preselectedPersonId]);

    useEffect(() => {
    async function loadPersonCircles() {
      if (!taggedPersonId) {
        setCircleOptions([]);
        setSelectedCircleIds([]);
        return;
      }
      const { data: circlePeopleRows } = await supabase
        .from("circle_people")
        .select("circle_id")
        .eq("person_id", taggedPersonId);

      const circleIds = (circlePeopleRows || []).map((r) => r.circle_id);
      if (circleIds.length === 0) {
        setCircleOptions([]);
        setSelectedCircleIds([]);
        return;
      }

      const { data: circlesData } = await supabase
        .from("circles")
        .select("id, name")
        .in("id", circleIds);

      setCircleOptions(circlesData || []);
      setSelectedCircleIds([]);
    }
    loadPersonCircles();
  }, [taggedPersonId, supabase]);

  function resetMedia() {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setRawImageSrc(null);
    setCropModalOpen(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordedSeconds(0);
  }

  function handleTypeChange(type: MemoryType) {
    resetMedia();
    setMemoryType(type);
  }

  function handleFileChange(file: File | null) {
    if (!file) {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaFile(null);
      setMediaPreview(null);
      return;
    }

    if (memoryType === "photo") {
      const reader = new FileReader();
      reader.onload = () => {
        setRawImageSrc(reader.result as string);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
      return;
    }

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }

  function handleCroppedPhoto(file: File) {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setCropModalOpen(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordedSeconds(0);
      timerRef.current = setInterval(() => setRecordedSeconds((s) => s + 1), 1000);
    } catch {
      setError("Couldn't access your microphone. Please allow microphone access and try again.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function reRecord() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordedSeconds(0);
  }

  async function handleSave() {
    setError(null);

    if (!taggedPersonId && !circleId) {
      setError("Please tag who this memory is about.");
      return;
    }
    if ((memoryType === "photo" || memoryType === "video") && !mediaFile) {
      setError(`Please choose a ${memoryType}.`);
      return;
    }
    if (memoryType === "voice" && !audioBlob) {
      setError("Please record a voice memory first.");
      return;
    }
    if (memoryType === "text" && !caption.trim()) {
      setError("Please write your story before saving.");
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You're not logged in. Please log in again.");
      setSaving(false);
      return;
    }

    let mediaUrl: string | null = null;
    let durationSeconds: number | null = null;

    if (memoryType === "photo" || memoryType === "video") {
      const fileExt = mediaFile!.name.split(".").pop();
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("memories")
        .upload(filePath, mediaFile!);

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }
      mediaUrl = filePath;
    }

    if (memoryType === "voice" && audioBlob) {
      const filePath = `${user.id}/${crypto.randomUUID()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("memories")
        .upload(filePath, audioBlob);

      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }
      mediaUrl = filePath;
      durationSeconds = recordedSeconds;
    }

const { data: myProfile } = await supabase
  .from("profiles")
  .select("full_name")
  .eq("id", user.id)
  .maybeSingle();
const creatorName =
  myProfile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Someone";
    const { data: newMemory, error: insertError } = await supabase
      .from("memories")
      .insert({
        person_id: circleId ? null : taggedPersonId,
        circle_id: circleId || null,
        creator_id: user.id,
        creator_name: creatorName,
        type: memoryType,
        media_url: mediaUrl,
        duration_seconds: durationSeconds,
        caption: caption.trim() || null,
        memory_date: date,
        location: location.trim() || null,
        is_shared: circleId ? true : selectedCircleIds.length > 0,
        shared_with_person: sharedWithPerson,
      })
      .select("id")
      .single();

    if (insertError || !newMemory) {
      setSaving(false);
      setError(insertError?.message || "Couldn't save the memory.");
      return;
    }

    if (!circleId && selectedCircleIds.length > 0) {
      await supabase.from("memory_circles").insert(
        selectedCircleIds.map((cId) => ({ memory_id: newMemory.id, circle_id: cId }))
      );
    }

    const allCircleIds = circleId ? [circleId] : selectedCircleIds;
    if (sharedWithPerson || allCircleIds.length > 0) {
      try {
        await supabase.functions.invoke("send-memory-shared-notification", {
          body: {
            creator_id: user.id,
            creator_name: creatorName,
            person_id: circleId ? null : taggedPersonId,
            shared_with_person: sharedWithPerson,
            circle_ids: allCircleIds,
          },
        });
      } catch {
      }
    }

    setSaving(false);
       if (circleId) {
      window.location.href = `/circle?circle=${circleId}`;
    } else {
      router.replace(`/people/${taggedPersonId}`);
    }
  }

  const TYPE_OPTIONS: { type: MemoryType; label: string; icon: typeof Camera }[] = [
    { type: "photo", label: "Photo", icon: Camera },
    { type: "voice", label: "Voice", icon: Mic },
    { type: "video", label: "Video", icon: VideoIcon },
    { type: "text", label: "Text", icon: PenLine },
  ];

  function MediaBlock({ compact = false }: { compact?: boolean }) {
    const circleSize = compact ? "w-24 h-24" : "w-32 h-32";
    const iconSize = compact ? 30 : 40;

    if (memoryType === "photo") {
      return (
        <div className="w-full flex flex-col items-center text-center">
          {mediaPreview ? (
            <div className={`relative w-full ${compact ? "max-w-[240px]" : "max-w-sm"} aspect-[4/3] rounded-[2rem] overflow-hidden shadow-xl mb-4`}>
              <img src={mediaPreview} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className={`${circleSize} rounded-full bg-accent/10 flex items-center justify-center text-accent mb-6 shadow-lg shadow-accent/10 border-4 border-white`}>
              <Camera size={iconSize} />
            </div>
          )}
<div className={`flex items-center gap-3 ${compact ? "flex-wrap justify-center" : ""}`}>    
          <label className={`bg-ink text-white rounded-full font-bold uppercase tracking-widest cursor-pointer hover:bg-accent transition-colors ${
  compact ? "px-4 py-2.5 text-[9px]" : "px-6 py-3 text-[10px]"
}`}>
  {mediaPreview ? "Choose a different photo" : "Choose a photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
            {mediaPreview && rawImageSrc && (
              <button
                type="button"
                onClick={() => setCropModalOpen(true)}
className={`bg-paper border border-line text-stone rounded-full font-bold uppercase tracking-widest hover:bg-clay transition-colors ${
      compact ? "px-4 py-2.5 text-[9px]" : "px-5 py-3 text-[10px]"
    }`}              >
                Adjust crop
              </button>
            )}
          </div>
        </div>
      );
    }

    if (memoryType === "video") {
      return (
        <div className="w-full flex flex-col items-center text-center">
          {mediaPreview ? (
            <video
              src={mediaPreview}
              controls
              className={`w-full ${compact ? "max-w-[240px]" : "max-w-sm"} aspect-[4/3] rounded-[2rem] overflow-hidden shadow-xl mb-6 object-contain bg-black`}
            />
          ) : (
            <div className={`${circleSize} rounded-full bg-accent/10 flex items-center justify-center text-accent mb-6 shadow-lg shadow-accent/10 border-4 border-white`}>
              <VideoIcon size={iconSize} />
            </div>
          )}
          <label className="bg-ink text-white px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-accent transition-colors">
            {mediaPreview ? "Choose a different video" : "Choose a video"}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      );
    }

    if (memoryType === "voice") {
      return (
        <div className="w-full flex flex-col items-center text-center">
          <div
            className={`${circleSize} rounded-full bg-accent/10 flex items-center justify-center text-accent mb-4 shadow-lg shadow-accent/10 border-4 border-white ${
              isRecording ? "animate-pulse" : ""
            }`}
          >
            <Mic size={iconSize} />
          </div>

          <h2 className={`${compact ? "text-xl" : "text-2xl md:text-3xl"} font-serif italic text-ink mb-1`}>
            {isRecording ? "Recording Story..." : audioUrl ? "Recording ready" : "Ready to record"}
          </h2>
          <p className="text-sm text-stone mb-6 tracking-widest font-mono">
            {formatTime(recordedSeconds)}
          </p>

          {isRecording && (
            <div className="w-full h-14 flex items-center justify-center gap-1 mb-6">
              {[16, 32, 44, 32, 16].map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-accent rounded-full animate-bounce"
                  style={{ height: `${h}px`, animationDelay: `${(i % 3) * 0.1}s` }}
                />
              ))}
            </div>
          )}

          {!isRecording && !audioUrl && (
            <button
              onClick={startRecording}
              className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
            >
              <Mic size={20} />
            </button>
          )}

          {isRecording && (
            <div className="flex gap-3">
              <button
                onClick={stopRecording}
                className="w-12 h-12 rounded-full bg-ink text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <Pause size={18} />
              </button>
              <button
                onClick={() => { stopRecording(); reRecord(); }}
                className="w-12 h-12 rounded-full bg-white border border-line text-stone flex items-center justify-center shadow-md active:scale-95 transition-all"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          )}

          {!isRecording && audioUrl && (
            <div className="flex flex-col items-center gap-3 w-full">
              <audio src={audioUrl} controls className="w-full" />
              <button
                onClick={reRecord}
                className="flex items-center gap-2 text-stone hover:text-accent text-xs font-bold uppercase tracking-widest"
              >
                <RotateCcw size={12} /> Record again
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="w-full text-center">
        <div className={`${circleSize} rounded-full bg-accent/10 flex items-center justify-center text-accent mb-4 mx-auto shadow-lg shadow-accent/10 border-4 border-white`}>
          <PenLine size={iconSize} />
        </div>
        <h2 className={`${compact ? "text-xl" : "text-2xl"} font-serif italic text-ink mb-1`}>
          Write it down
        </h2>
        <p className="text-sm text-stone leading-relaxed">
          Sometimes words are enough.
        </p>
      </div>
    );
  }

  const TypeSelector = ({ compact = false }: { compact?: boolean }) => (
    <div className={`grid grid-cols-4 gap-2 ${compact ? "" : ""}`}>
      {TYPE_OPTIONS.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => handleTypeChange(type)}
          className={`border rounded-2xl py-3 flex flex-col items-center gap-2 transition-all ${
            memoryType === type
              ? "bg-accent text-white border-accent"
              : "border-line hover:bg-paper text-ink"
          }`}
        >
          <Icon size={14} />
          <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
        </button>
      ))}
    </div>
  );
  const TagSomeone = () => (
  <div className="space-y-3">
    <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1">
      {isSelfLocked ? "This memory is about" : "Tag Someone"}
    </label>
    {isSelfLocked && people[0] ? (
      <div className="flex items-center gap-3 border-2 border-accent bg-accent/5 rounded-[1.25rem] p-3 w-fit">
        <div className="w-10 h-10 rounded-full bg-clay overflow-hidden shrink-0 flex items-center justify-center">
          {people[0].photo_url ? (
             <img src={people[0].photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
             <span className="font-serif italic text-sm text-ink">
                {people[0].name.charAt(0).toUpperCase()}
              </span>
          )}
        </div>
        <span className="text-xs font-bold text-accent uppercase tracking-widest">
          {people[0].name} (You)
        </span>
      </div>
    ) : people.length === 0 ? (
      <p className="text-xs text-stone italic">
        You haven&apos;t added anyone yet.{" "}
        <Link href="/people/new" className="text-accent font-bold">
          Add someone
        </Link>
      </p>
    ) : (
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {people.map((person) => {
          const selected = person.id === taggedPersonId;
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => setTaggedPersonId(person.id)}
              className={`flex flex-col items-center gap-2 border-2 rounded-[1.25rem] p-2.5 min-w-[76px] transition-all shrink-0 ${
                selected ? "border-accent bg-accent/5" : "border-transparent bg-paper"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-clay overflow-hidden shadow-sm flex items-center justify-center">
                {person.photo_url ? (
                  <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-serif italic text-sm text-ink">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                )}
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-widest truncate max-w-[64px] ${
                  selected ? "text-accent" : "text-stone"
                }`}
              >
                {person.name}
              </span>
            </button>
          );
        })}
      </div>
    )}
  </div>
);

  const DetailFields = () => (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
          {memoryType === "text" ? "Write your story" : "Short Caption"}
        </label>
        <textarea
  value={caption}
  onChange={(e) => setCaption(e.target.value)}
  rows={memoryType === "text" ? 5 : 2}
  placeholder={memoryType === "text" ? "Tell the story..." : "The story of his first car..."}
  className="w-full bg-paper border border-line rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm resize-none"
/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
            Date
          </label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1 block mb-2">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Seattle, WA"
            className="w-full bg-paper border border-line rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm"
          />
        </div>
      </div>
    </div>
  );

    const taggedPerson = people.find((p) => p.id === taggedPersonId);

    const ShareToggle = () => (
    <div className="space-y-3">
      {circleOptions.length > 0 && (
        <div className="bg-paper rounded-3xl p-5 border border-line space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Users size={13} />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Share with a Circle</p>
              <p className="text-[9px] text-stone italic uppercase tracking-tighter">
                Off by default (Private) — pick any that apply
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-12">
            {circleOptions.map((circle) => {
              const selected = selectedCircleIds.includes(circle.id);
              return (
                <button
                  key={circle.id}
                  type="button"
                  onClick={() =>
                    setSelectedCircleIds((prev) =>
                      selected ? prev.filter((id) => id !== circle.id) : [...prev, circle.id]
                    )
                  }
                  className={`px-3.5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
                    selected
                      ? "bg-accent text-white border-accent"
                      : "bg-white text-stone border-line hover:border-accent/40"
                  }`}
                >
                  {circle.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {taggedPerson && !isSelfLocked && (
        <div className="bg-paper rounded-3xl p-5 border border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Users size={13} />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">
                Let {taggedPerson.name} see this directly
              </p>
              <p className="text-[9px] text-stone italic uppercase tracking-tighter">
                Off by default (Private)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSharedWithPerson((v) => !v)}
            className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
              sharedWithPerson ? "bg-accent" : "bg-clay"
            }`}
          >
            <div
              className={`absolute top-[2px] w-5 h-5 bg-white rounded-full transition-all ${
                sharedWithPerson ? "right-[2px]" : "left-[2px]"
              }`}
            />
          </button>
        </div>
      )}
    </div>
  );
  return (
    <>
      <div className="md:hidden bg-cream min-h-screen">
        <div className="sticky top-0 z-10 bg-cream/90 backdrop-blur-md border-b border-line px-4 py-3 flex items-center gap-3">
          <Link
            href="/home"
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm text-stone border border-line active:scale-95 transition-transform"
          >
            <ChevronLeft size={14} />
          </Link>
          <div>
            <span className="text-[9px] font-bold text-accent uppercase tracking-widest block">
              New Capture
            </span>
            <h1 className="text-base font-serif text-ink leading-none">Details of the moment</h1>
          </div>
        </div>

<div className="p-4 pb-6 space-y-6">
  {TypeSelector({ compact: true })}

  <div className="relative rounded-3xl border border-line overflow-hidden">
    <img
      className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
      src="https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_9d63a7bfe4_33e039bc9ea33b03.png"
      alt=""
    />
    <div className="relative z-10 bg-paper/90 p-6 flex items-center justify-center">
      <MediaBlock compact />
    </div>
  </div>

  {!circleId && TagSomeone()}
  {DetailFields()}
  {ShareToggle()}

  {error && (
    <p className="text-red-600 text-xs bg-red-50 rounded-lg p-3">{error}</p>
  )}

  <div className="flex gap-3 pt-2">
    <Link
      href="/home"
      className="flex-1 bg-paper border border-line text-stone py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] text-center active:scale-[0.98] transition-all"
    >
      Discard
    </Link>
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      className="flex-[2] bg-accent text-white py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 active:scale-[0.98] transition-all disabled:opacity-50"
    >
      {saving ? "Saving..." : "Save Memory"}
    </button>
  </div>
</div>

      </div>

      <div className="hidden md:flex bg-ink/5 min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-[1100px] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-row border border-line h-[85vh]">
          <div className="w-1/2 bg-paper relative flex flex-col items-center justify-center p-12 border-r border-line overflow-hidden">
            <img
              className="absolute inset-0 w-full h-full object-cover opacity-10"
              src="https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_9d63a7bfe4_33e039bc9ea33b03.png"
              alt=""
            />
            <div className="absolute top-8 left-8 z-10">
              <Link
                href="/home"
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-stone hover:text-accent transition-colors"
              >
                <ChevronLeft size={14} />
              </Link>
            </div>
            <div className="relative z-10 w-full max-w-sm">
              <MediaBlock />
            </div>
          </div>

          <div className="w-1/2 p-12 overflow-y-auto">
            <header className="mb-10">
              <span className="text-[10px] font-bold text-accent uppercase tracking-widest mb-2 block">
                New Capture
              </span>
              <h1 className="text-2xl font-serif text-ink">Details of the moment</h1>
            </header>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-stone uppercase tracking-widest px-1">
                  Memory Type
                </label>
                {TypeSelector({})}
              </div>
              {!circleId && TagSomeone()}
              {DetailFields()}
              {ShareToggle()}

              {error && (
                <p className="text-red-600 text-xs bg-red-50 rounded-lg p-3">{error}</p>
              )}

              <div className="pt-2 flex gap-4">
                <Link
                  href="/home"
                  className="flex-1 bg-paper border border-line text-stone py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-clay transition-all text-center"
                >
                  Discard
                </Link>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-[2] bg-accent text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Finish & Save Memory"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {cropModalOpen && rawImageSrc && (
        <ImageCropperModal
          imageSrc={rawImageSrc}
          aspect={4 / 3}
          cropShape="rect"
          outputFileName="memory.jpg"
          onCancel={() => setCropModalOpen(false)}
          onCropDone={handleCroppedPhoto}
        />
      )}
    </>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={null}>
      <CaptureForm />
    </Suspense>
  );
}