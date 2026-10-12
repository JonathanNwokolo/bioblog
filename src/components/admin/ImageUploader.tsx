"use client";

import { useRef, useState } from "react";

const MAX_INPUT_BYTES = 6 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

interface ImageUploaderProps {
  initialId?: string | null;
  initialAlt?: string;
  initialCredit?: string;
  errors?: Partial<Record<string, string>>;
}

export function ImageUploader({ initialId = null, initialAlt = "", initialCredit = "", errors = {} }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);
  const creditRef = useRef<HTMLInputElement>(null);
  const [mediaId, setMediaId] = useState(initialId ?? "");
  const [message, setMessage] = useState<{ kind: "status" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  async function upload() {
    const file = inputRef.current?.files?.[0];
    const alt = (altRef.current?.value ?? "").trim();
    const credit = (creditRef.current?.value ?? "").trim();
    if (!file) return setMessage({ kind: "error", text: "Selecione uma imagem JPEG, PNG ou WebP." });
    if (!ACCEPTED.includes(file.type)) return setMessage({ kind: "error", text: "Formato não aceito. Use JPEG, PNG ou WebP." });
    if (file.size > MAX_INPUT_BYTES) return setMessage({ kind: "error", text: "A imagem é maior que 6 MB. Reduza o arquivo e tente de novo." });
    if (alt.length < 3) {
      altRef.current?.focus();
      return setMessage({ kind: "error", text: "Descreva a imagem (ao menos 3 caracteres) antes de enviar." });
    }
    setUploading(true);
    setMessage({ kind: "status", text: "Enviando e otimizando a imagem… isso pode levar alguns segundos." });
    const data = new FormData();
    data.set("file", file); data.set("alt", alt); data.set("credit", credit);
    try {
      const response = await fetch("/api/admin/media", { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fallback = response.status === 401 ? "Sua sessão expirou. Entre novamente em outra aba e tente de novo." : "Não foi possível enviar a imagem. Tente novamente.";
        setMessage({ kind: "error", text: result.error ?? fallback });
        return;
      }
      setMediaId(result.id);
      setPreviewFailed(false);
      if (inputRef.current) inputRef.current.value = "";
      setMessage({ kind: "status", text: "Imagem enviada e guardada em modo privado. Salve o rascunho para vinculá-la à publicação." });
    } catch {
      setMessage({ kind: "error", text: "Sem conexão com o servidor. Verifique a internet e toque em “Enviar imagem” para tentar de novo." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <fieldset className="image-uploader" aria-busy={uploading}>
      <legend>Imagem de capa</legend>
      <input type="hidden" name="heroMediaId" value={mediaId} />
      <div className="admin-field">
        <label htmlFor="image-alt">Texto alternativo (descrição da imagem)</label>
        <p id="image-alt-hint" className="admin-help">Descreva o que a imagem mostra para quem não a enxerga. Obrigatório, de 3 a 500 caracteres.</p>
        <input ref={altRef} id="image-alt" name="heroAlt" maxLength={500} defaultValue={initialAlt} autoComplete="off"
          aria-describedby={errors.heroAlt ? "image-alt-hint image-alt-error" : "image-alt-hint"} aria-invalid={errors.heroAlt ? true : undefined} />
        {errors.heroAlt && <p id="image-alt-error" className="admin-field-error">{errors.heroAlt}</p>}
      </div>
      <div className="admin-field">
        <label htmlFor="image-credit">Crédito ou atribuição</label>
        <input ref={creditRef} id="image-credit" name="heroCredit" maxLength={500} defaultValue={initialCredit} autoComplete="off" />
      </div>
      <div className="admin-field">
        <label htmlFor="image-file">Arquivo de imagem</label>
        <p id="image-file-hint" className="admin-help">JPEG, PNG ou WebP, até 6 MB. A imagem é convertida para WebP e fica privada até a publicação.</p>
        <input ref={inputRef} id="image-file" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="image-file-hint" />
      </div>
      <button type="button" className="btn btn--outline" onClick={upload} disabled={uploading}>{uploading ? "Enviando…" : mediaId ? "Substituir imagem" : "Enviar imagem"}</button>
      <div aria-live="polite" className="admin-feedback">
        {message && <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "admin-error" : "admin-help"}>{message.text}</p>}
      </div>
      {mediaId && !previewFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="admin-image-preview" src={`/api/admin/media/${mediaId}`} alt="Prévia privada da imagem de capa"
          onError={() => setPreviewFailed(true)} />
      )}
      {mediaId && previewFailed && <p className="admin-help">Não foi possível carregar a prévia da imagem. Recarregue a página; a imagem continua vinculada.</p>}
    </fieldset>
  );
}
