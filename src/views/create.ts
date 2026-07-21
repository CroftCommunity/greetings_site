// Create view (Phase 2). Gates on creator auth: signed-out shows the OAuth
// sign-in form; signed-in confirms the account (the card form itself — text +
// theme + cover, public/sealed — arrives in Phases 3–4); a read-only origin
// (PR preview / fork) says so rather than offering a sign-in that can't work.
import type { AuthMode } from '../auth-core';

export type CreateAuthView = {
  mode: AuthMode;
  signedIn: boolean;
  who: string | null;
};

export type CreateHandlers = {
  onSignIn: (handle: string) => void;
  onSignOut: () => void;
};

export function renderCreate(app: HTMLElement, view: CreateAuthView, handlers: CreateHandlers): void {
  app.replaceChildren();

  const h = document.createElement('h1');
  h.textContent = 'Create a greeting';
  app.append(h);

  if (view.mode === 'none') {
    const note = document.createElement('p');
    note.textContent = 'Sign-in is available on greetings.croft.ing only. This origin is read-only.';
    app.append(note, homeLink());
    return;
  }

  if (view.signedIn) {
    const status = document.createElement('p');
    status.textContent = `Signed in as ${view.who ?? 'your account'}.`;
    const next = document.createElement('p');
    next.textContent = 'The card form (text, theme, cover — public or server-blind) arrives next.';
    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'button button--ghost';
    out.textContent = 'Sign out';
    out.addEventListener('click', () => handlers.onSignOut());
    app.append(status, next, out);
    return;
  }

  // Signed out: the OAuth sign-in form.
  const intro = document.createElement('p');
  intro.textContent = 'Sign in with your Bluesky / atproto handle to make a card.';

  const form = document.createElement('form');
  form.className = 'signin';
  form.setAttribute('novalidate', '');

  const label = document.createElement('label');
  label.className = 'signin__label';
  label.textContent = 'Handle';
  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'handle';
  input.className = 'signin__input';
  input.placeholder = 'you.bsky.social';
  input.autocomplete = 'username';
  label.append(input);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button';
  submit.textContent = 'Sign in';

  const error = document.createElement('p');
  error.className = 'signin__error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (value === '') {
      error.textContent = 'Enter your handle to continue.';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Redirecting…';
    handlers.onSignIn(value);
  });

  form.append(label, submit, error);
  app.append(intro, form, homeLink());
}

function homeLink(): HTMLAnchorElement {
  const back = document.createElement('a');
  back.href = '#/';
  back.className = 'button button--ghost';
  back.textContent = 'Back';
  return back;
}
