import { createClient } from "@/lib/supabase/client";


export async function getSignedMemoryUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("memories")
    .createSignedUrl(path, 60 * 60); 

  if (error || !data) return null;
  return data.signedUrl;
}