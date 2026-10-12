"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/app/admin/actions";
import { ImageUploader } from "./ImageUploader";
import { VisualEditor } from "./VisualEditor";

interface Category { id: string; label: string }
interface PostFormProps {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  categories: Category[];
  post?: {
    id: string; title: string; excerpt: string; body: string; categoryId: string;
    mediaId: string | null; mediaAlt: string; mediaCredit: string;
  };
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      {hint && <p id={`${id}-hint`} className="admin-help">{hint}</p>}
      {children}
      {error && <p id={`${id}-error`} className="admin-field-error">{error}</p>}
    </div>
  );
}

export function PostForm({ action, categories, post }: PostFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  // Unsaved edits: the state object that was current when the author last typed. A newer *successful*
  // result means that edit was saved; a failed result leaves the edit unsaved.
  const [editedAt, setEditedAt] = useState<ActionState | null>(null);
  const dirty = editedAt !== null && (editedAt === state || !state.success);
  const summaryRef = useRef<HTMLDivElement>(null);
  const values = state.values;
  const errors = state.fieldErrors ?? {};
  const describe = (id: string, hint = false) => [hint ? `${id}-hint` : null, errors[id as keyof typeof errors] ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  // Warn before the tab is closed or reloaded while there are unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Move focus to the summary so assistive tech announces what failed and keyboard users land on it.
  useEffect(() => {
    if (state.error) summaryRef.current?.focus();
  }, [state.error, state.nonce]);

  const initial = {
    title: values?.title ?? post?.title ?? "",
    excerpt: values?.excerpt ?? post?.excerpt ?? "",
    categoryId: values?.categoryId ?? post?.categoryId ?? "",
    body: values?.body ?? post?.body ?? "",
    mediaId: values?.heroMediaId ?? post?.mediaId ?? "",
    mediaAlt: values?.heroAlt ?? post?.mediaAlt ?? "",
    mediaCredit: values?.heroCredit ?? post?.mediaCredit ?? "",
  };

  return (
    <form
      action={formAction}
      className="admin-form admin-editor-form"
      noValidate
      aria-busy={pending}
      onChange={() => setEditedAt(state)}
      onSubmit={(event) => { if (pending) event.preventDefault(); }}
    >
      {post && <input type="hidden" name="id" value={post.id} />}
      <div key={state.nonce ?? 0} className="admin-fields">
        <Field id="title" label="Título" error={errors.title}>
          <input id="title" name="title" defaultValue={initial.title} maxLength={180} required aria-required="true"
            aria-invalid={errors.title ? true : undefined} aria-describedby={describe("title")} autoComplete="off" />
        </Field>
        <Field id="excerpt" label="Resumo" hint="Aparece na listagem do Diário e nas prévias. De 10 a 420 caracteres." error={errors.excerpt}>
          <textarea id="excerpt" name="excerpt" defaultValue={initial.excerpt} maxLength={420} rows={4} required aria-required="true"
            aria-invalid={errors.excerpt ? true : undefined} aria-describedby={describe("excerpt", true)} />
        </Field>
        <Field id="categoryId" label="Categoria" error={errors.categoryId}>
          <select id="categoryId" name="categoryId" defaultValue={initial.categoryId} required aria-required="true"
            aria-invalid={errors.categoryId ? true : undefined} aria-describedby={describe("categoryId")}>
            <option value="" disabled>Selecione</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </Field>
        <VisualEditor initialValue={initial.body} error={errors.body} />
        {post
          ? <ImageUploader initialId={initial.mediaId} initialAlt={initial.mediaAlt} initialCredit={initial.mediaCredit} errors={errors} />
          : <p className="admin-help">Salve o rascunho para habilitar o envio seguro da imagem de capa.</p>}
      </div>

      <div ref={summaryRef} tabIndex={-1} className="admin-feedback" aria-live="polite">
        {state.error && (
          <p role="alert" className="admin-error">
            {state.error}
            {state.sessionExpired && <> <Link href="/admin/login" target="_blank" rel="noopener">Entrar novamente (nova aba)</Link></>}
          </p>
        )}
        {state.success && <p role="status" className="admin-success">{state.success}</p>}
        {dirty && !state.error && !state.success && <p className="admin-help">Alterações ainda não salvas.</p>}
      </div>
      <div className="admin-form-actions">
        <button className="btn btn--mint" disabled={pending}>{pending ? "Salvando…" : post ? "Salvar alterações" : "Criar rascunho"}</button>
      </div>
    </form>
  );
}
