"use client";

import { useActionState, useEffect, useRef } from "react";
import { loginAction, type ActionState } from "@/app/admin/actions";

const initialState: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error, state.nonce]);
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;
  return (
    <form action={action} className="admin-form" noValidate aria-busy={pending} onSubmit={(event) => { if (pending) event.preventDefault(); }}>
      <div key={state.nonce ?? 0} className="admin-fields">
        <div className="admin-field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="username" defaultValue={state.values?.email ?? ""} required aria-required="true"
            aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? "email-error" : undefined} />
          {emailError && <p id="email-error" className="admin-field-error">{emailError}</p>}
        </div>
        <div className="admin-field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required aria-required="true"
            aria-invalid={passwordError ? true : undefined} aria-describedby={passwordError ? "password-error" : undefined} />
          {passwordError && <p id="password-error" className="admin-field-error">{passwordError}</p>}
        </div>
      </div>
      {state.error && <p ref={errorRef} tabIndex={-1} role="alert" className="admin-error">{state.error}</p>}
      <button className="btn btn--mint" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
