import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const bucket = process.env.SUPABASE_STORAGE_BUCKET || "tms-documents";
export const storage = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export async function uploadPrivatePdf(path: string, contents: Buffer) {
  if (!storage) throw new Error("Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  const { error } = await storage.storage.from(bucket).upload(path, contents, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(`Document upload failed: ${error.message}`);
  return path;
}

export async function signedDocumentUrl(path: string) {
  if (!storage) throw new Error("Supabase Storage is not configured");
  const { data, error } = await storage.storage.from(bucket).createSignedUrl(path, 60 * 5);
  if (error || !data) throw new Error(`Document access failed: ${error?.message || "unknown error"}`);
  return data.signedUrl;
}
