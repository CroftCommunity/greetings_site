// Create view (Phase 3). Signed-out: the OAuth sign-in form. Signed-in: the
// public card form (text + theme + recipient + optional cover) — on submit it
// writes the record to the creator's PDS via the onCreatePublic handler and
// shows the share link. Sealed (server-blind) cards arrive in Phase 4.
import type { AuthMode } from '../auth-core';

export const THEMES = ['plain', 'sunrise', 'meadow', 'night'] as const;
export type Theme = (typeof THEMES)[number];

export type CreateAuthView = {
  mode: AuthMode;
  signedIn: boolean;
  who: string | null;
};

export type PublicCardFormInput = {
  text: string;
  theme: Theme;
  to: string;
  file: File | null;
};

export type CreateHandlers = {
  onSignIn: (handle: string) => void;
  onSignOut: () => void;
  /** Write a public card; resolves to the shareable URL. */
  onCreatePublic: (input: PublicCardFormInput) => Promise<string>;
  /** Write a server-blind (sealed) card; resolves to the shareable URL with #k=. */
  onCreateSealed: (input: PublicCardFormInput) => Promise<string>;
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
    app.append(renderCardForm(view, handlers));
    return;
  }

  app.append(...renderSignIn(handlers));
}

function renderCardForm(view: CreateAuthView, handlers: CreateHandlers): HTMLElement {
  const wrap = document.createElement('div');

  const whoami = document.createElement('p');
  whoami.textContent = `Signed in as ${view.who ?? 'your account'}.`;

  const form = document.createElement('form');
  form.className = 'card-form';
  form.setAttribute('novalidate', '');

  const text = fieldTextarea('Your message', 'text', 'Write your greeting…');
  const to = fieldInput('To (recipient name)', 'to', 'e.g. Grandma — they don’t need an account');
  const theme = fieldSelect('Theme', 'theme', THEMES);
  const cover = fieldFile('Cover image (optional)', 'cover');
  const privacy = fieldSelect('Privacy', 'privacy', ['public', 'server-blind']);
  const privacyHint = document.createElement('p');
  privacyHint.className = 'card-form__status';
  privacyHint.textContent =
    'Public: anyone with the link can read it. Server-blind: encrypted in your browser — only people with the full link (which carries the key) can read it; your PDS stores only ciphertext.';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'button';
  submit.textContent = 'Create card';

  const status = document.createElement('p');
  status.className = 'card-form__status';
  status.setAttribute('role', 'status');
  status.hidden = true;

  const result = document.createElement('div');
  result.className = 'card-form__result';
  result.hidden = true;

  form.append(text.label, to.label, theme.label, cover.label, privacy.label, privacyHint, submit, status, result);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const message = text.input.value.trim();
    if (message === '') {
      status.hidden = false;
      status.textContent = 'Write a message first.';
      return;
    }
    const sealed = privacy.select.value === 'server-blind';
    submit.disabled = true;
    submit.textContent = 'Creating…';
    status.hidden = false;
    status.textContent = sealed
      ? 'Encrypting in your browser and writing ciphertext to your PDS…'
      : 'Writing your card to your PDS…';
    result.hidden = true;

    const input: PublicCardFormInput = {
      text: message,
      theme: (theme.select.value as Theme) || 'plain',
      to: to.input.value.trim(),
      file: cover.input.files?.[0] ?? null,
    };
    (sealed ? handlers.onCreateSealed(input) : handlers.onCreatePublic(input))
      .then((shareUrl) => {
        status.textContent = 'Card created. Share this link:';
        result.replaceChildren(shareRow(shareUrl));
        result.hidden = false;
      })
      .catch((err: unknown) => {
        console.error('greetings: create card failed', err);
        status.textContent = 'Could not create the card. Please try again.';
      })
      .finally(() => {
        submit.disabled = false;
        submit.textContent = 'Create card';
      });
  });

  wrap.append(whoami, form, signOutButton(handlers));
  return wrap;
}

function renderSignIn(handlers: CreateHandlers): Node[] {
  const intro = document.createElement('p');
  intro.textContent = 'Sign in with your Bluesky handle to make a card.';

  const form = document.createElement('form');
  form.className = 'signin';
  form.setAttribute('novalidate', '');

  const label = document.createElement('label');
  label.className = 'signin__label';
  label.textContent = 'Bluesky handle';
  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'handle';
  input.className = 'signin__input';
  input.placeholder = 'you.bsky.social';
  input.autocomplete = 'username';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  label.append(input);

  const hint = document.createElement('p');
  hint.className = 'signin__hint';
  hint.textContent =
    'Your handle, not your email — e.g. you.bsky.social. You enter your email and password on Bluesky’s screen next.';

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

  form.append(label, hint, submit, error);
  return [intro, form, homeLink()];
}

// --- small DOM builders ---
function fieldTextarea(labelText: string, name: string, placeholder: string) {
  const label = document.createElement('label');
  label.className = 'field';
  const span = document.createElement('span');
  span.className = 'field__label';
  span.textContent = labelText;
  const input = document.createElement('textarea');
  input.name = name;
  input.className = 'field__input';
  input.rows = 4;
  input.placeholder = placeholder;
  label.append(span, input);
  return { label, input };
}

function fieldInput(labelText: string, name: string, placeholder: string) {
  const label = document.createElement('label');
  label.className = 'field';
  const span = document.createElement('span');
  span.className = 'field__label';
  span.textContent = labelText;
  const input = document.createElement('input');
  input.type = 'text';
  input.name = name;
  input.className = 'field__input';
  input.placeholder = placeholder;
  label.append(span, input);
  return { label, input };
}

function fieldSelect(labelText: string, name: string, options: readonly string[]) {
  const label = document.createElement('label');
  label.className = 'field';
  const span = document.createElement('span');
  span.className = 'field__label';
  span.textContent = labelText;
  const select = document.createElement('select');
  select.name = name;
  select.className = 'field__input';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    select.append(o);
  }
  label.append(span, select);
  return { label, select };
}

function fieldFile(labelText: string, name: string) {
  const label = document.createElement('label');
  label.className = 'field';
  const span = document.createElement('span');
  span.className = 'field__label';
  span.textContent = labelText;
  const input = document.createElement('input');
  input.type = 'file';
  input.name = name;
  input.className = 'field__input';
  input.accept = 'image/*';
  label.append(span, input);
  return { label, input };
}

function shareRow(url: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'share';
  const field = document.createElement('input');
  field.type = 'text';
  field.className = 'share__url';
  field.readOnly = true;
  field.value = url;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'button button--ghost';
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => {
    field.select();
    navigator.clipboard?.writeText(url).catch(() => field.select());
  });
  const open = document.createElement('a');
  open.className = 'button button--ghost';
  open.href = url;
  open.target = '_blank';
  open.rel = 'noopener';
  open.textContent = 'Open';
  row.append(field, copy, open);
  return row;
}

function signOutButton(handlers: CreateHandlers): HTMLButtonElement {
  const out = document.createElement('button');
  out.type = 'button';
  out.className = 'button button--ghost';
  out.textContent = 'Sign out';
  out.addEventListener('click', () => handlers.onSignOut());
  return out;
}

function homeLink(): HTMLAnchorElement {
  const back = document.createElement('a');
  back.href = '#/';
  back.className = 'button button--ghost';
  back.textContent = 'Back';
  return back;
}
