import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getCurrentEditor } from "@/lib/cms/auth";
import { BodyTooLargeError, readBodyWithLimit } from "@/lib/cms/upload";
import { hasAllowedImageSignature, isTrustedMutationRequest } from "@/lib/cms/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INPUT_BYTES = 6 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
/** Multipart framing (boundaries, text fields) on top of the file itself. */
const MULTIPART_OVERHEAD = 64 * 1024;
const headers = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request.headers)) return fail("Origem não permitida.", 403);
  const editor = await getCurrentEditor({ verify: true });
  if (!editor) return fail("Sua sessão expirou. Entre novamente para enviar a imagem.", 401);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return fail("Formato de envio inválido.", 415);
  }

  let form: FormData;
  try {
    const raw = await readBodyWithLimit(request, MAX_INPUT_BYTES + MULTIPART_OVERHEAD);
    form = await new Response(raw as BodyInit, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
  } catch (error) {
    if (error instanceof BodyTooLargeError) return fail("A imagem é maior que 6 MB.", 413);
    return fail("Não foi possível ler o arquivo enviado.", 400);
  }

  const file = form.get("file");
  const alt = String(form.get("alt") ?? "").trim();
  const credit = String(form.get("credit") ?? "").trim();
  if (!(file instanceof File) || file.size < 1) return fail("Selecione uma imagem.", 400);
  if (file.size > MAX_INPUT_BYTES) return fail("A imagem é maior que 6 MB.", 413);
  if (alt.length < 3 || alt.length > 500 || credit.length > 500) {
    return fail("Descreva a imagem (3 a 500 caracteres) e mantenha o crédito com até 500 caracteres.", 400);
  }
  const input = new Uint8Array(await file.arrayBuffer());
  if (!hasAllowedImageSignature(input)) return fail("O arquivo não é uma imagem JPEG, PNG ou WebP válida.", 415);

  try {
    const pipeline = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    if (data.byteLength > MAX_OUTPUT_BYTES) return fail("A imagem otimizada excede 4 MB. Use uma imagem menor.", 413);

    const objectKey = `${randomUUID()}/${randomUUID()}.webp`;
    const supabase = await createSupabaseServerClient();
    const upload = await supabase.storage.from("post-media").upload(objectKey, data, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (upload.error) return fail("Falha ao armazenar a imagem. Tente novamente.", 502);

    const inserted = await supabase.from("media_assets").insert({
      owner_id: editor.id, object_key: objectKey, state: "draft", mime_type: "image/webp",
      bytes: data.byteLength, width: info.width, height: info.height, alt_text: alt, credit,
      sha256: createHash("sha256").update(data).digest("hex"),
    }).select("id").single();
    if (inserted.error || !inserted.data) {
      await supabase.storage.from("post-media").remove([objectKey]);
      return fail("Falha ao registrar a imagem. Tente novamente.", 502);
    }
    await supabase.from("audit_events").insert({ actor_user_id: editor.id, action: "media_upload", entity_type: "media", entity_id: inserted.data.id });
    return NextResponse.json({ id: inserted.data.id, previewUrl: `/api/admin/media/${inserted.data.id}`, width: info.width, height: info.height }, { status: 201, headers });
  } catch {
    return fail("A imagem está corrompida ou excede as dimensões seguras.", 415);
  }
}
