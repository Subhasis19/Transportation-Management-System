import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
export const bucket = env.SUPABASE_STORAGE_BUCKET;
export const storage = createClient(url, key, { auth: { persistSession: false } });

export async function uploadPrivatePdf(path: string, contents: Buffer) {
  const { error } = await storage.storage.from(bucket).upload(path, contents, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`Document upload failed: ${error.message}`);
  return path;
}

export async function signedDocumentUrl(path: string) {
  const { data, error } = await storage.storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (error || !data) throw new Error(`Document access failed: ${error?.message || "unknown error"}`);
  return data.signedUrl;
}
