"use client";

import { useState } from "react";

export function VisualEditor({ initialValue = "", error }: { initialValue?: string; error?: string }) {
  const [value, setValue] = useState(initialValue);
  const paragraphs = value.split(/\r?\n\s*\r?\n/).map((item) => item.trim()).filter(Boolean);
  return (
    <div className="visual-editor admin-field">
      <label htmlFor="body">Conteúdo</label>
      <p id="body-hint" className="admin-help">Separe parágrafos com uma linha em branco. A prévia ao lado usa a tipografia real do artigo.</p>
      <div className="editor-grid">
        <textarea id="body" name="body" value={value} onChange={(event) => setValue(event.target.value)} rows={18} required aria-required="true"
          aria-invalid={error ? true : undefined} aria-describedby={error ? "body-hint body-error" : "body-hint"} />
        <section className="editor-preview" aria-label="Prévia do conteúdo">
          {paragraphs.length ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p className="admin-muted">A prévia aparece aqui.</p>}
        </section>
      </div>
      <p className="admin-help">{paragraphs.length} {paragraphs.length === 1 ? "parágrafo" : "parágrafos"} · {value.length.toLocaleString("pt-BR")} de 50.000 caracteres</p>
      {error && <p id="body-error" className="admin-field-error">{error}</p>}
    </div>
  );
}
