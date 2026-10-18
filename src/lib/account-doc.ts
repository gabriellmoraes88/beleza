import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createAdminClient } from "@/lib/supabase/admin";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Hash do CPF/CNPJ (só dígitos) com sal. O número em si nunca é guardado. */
async function hashDoc(doc: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(doc, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function matches(doc: string, stored: string): Promise<boolean> {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(doc, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function saveAccountDocument(userId: string, doc: string) {
  const { error } = await createAdminClient()
    .from("account_documents")
    .upsert({ user_id: userId, doc_hash: await hashDoc(doc) }, { onConflict: "user_id" });
  return !error;
}

export async function hasAccountDocument(userId: string): Promise<boolean> {
  const { count } = await createAdminClient()
    .from("account_documents")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

/** Devolve o id da conta se o e-mail e o CPF/CNPJ conferem; senão null. */
export async function findAccountByDocument(email: string, doc: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: userId } = await admin.rpc("user_id_by_email", { p_email: email });
  // Sem conta ou sem documento: mesmo trabalho de hash, para não revelar pela demora se o e-mail existe.
  const stored = userId
    ? (await admin.from("account_documents").select("doc_hash").eq("user_id", userId).maybeSingle()).data?.doc_hash
    : null;
  const ok = await matches(doc, stored ?? `scrypt$${randomBytes(16).toString("base64")}$${randomBytes(32).toString("base64")}`);
  return ok && stored ? (userId as string) : null;
}
