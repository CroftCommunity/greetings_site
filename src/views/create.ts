// Create view (Phase 3). Signed-out: the OAuth sign-in form. Signed-in: the
// public card form (text + theme + recipient + optional cover) — on submit it
// writes the record to the creator's PDS via the onCreatePublic handler and
// shows the share link. Sealed (server-blind) cards arrive in Phase 4.
import type { AuthMode } from '../auth-core';
import { ATMO_GLOSS, featuredProviders, otherProviders, canCreateAccount, type Provider } from '../signin/providers';

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
  /** `target` is a provider entryway (https origin) or a handle; options are forwarded verbatim. */
  onSignIn: (target: string, options?: { readonly prompt?: 'create' }) => void;
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

// The sign-in step, as the workspace pattern (croft-pwa/docs/DESIGN.md § Flows ›
// Sign in, § Copy). INLINE, not a sheet: the signed-out create view IS the
// choose-a-provider step — there is nothing behind it to return to — so the two
// panels render as the page. The sheet is the recorded exception to "pages, not
// modals" for a step that interrupts something else; this one interrupts nothing.
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string | boolean>> = {},
  ...kids: readonly (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) continue;
    if (k === 'hidden') node.hidden = true;
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...kids);
  return node;
}

// One row shape for both panels. Open offers Create; invite-only shows the WORDS
// in the create slot, so the column stays aligned and the italic explains the
// button that is missing (an invite-only provider still advertises create — it
// would land on a screen that then demands a code). Posture decides, so a
// provider that changes posture moves panels and controls in one registry edit.
function providerRow(p: Provider, handlers: CreateHandlers): HTMLElement {
  const actions = el('div', { class: 'signin-actions' });
  if (canCreateAccount(p)) {
    const create = el('button', { type: 'button', class: 'button button--sm', 'data-provider-create': '' }, 'Create account');
    create.addEventListener('click', () => handlers.onSignIn(p.entryway, { prompt: 'create' }));
    actions.append(create);
  } else {
    actions.append(el('span', { class: 'signin-invite' }, 'invite only'));
  }
  const go = el('button', { type: 'button', class: 'button button--ghost button--sm', 'data-provider-signin': '' }, 'Sign in');
  go.addEventListener('click', () => handlers.onSignIn(p.entryway));
  actions.append(go);
  return el('div', { class: 'signin-row', 'data-provider-row': p.id }, el('span', { class: 'signin-provider' }, p.label), actions);
}

function renderSignIn(handlers: CreateHandlers): Node[] {
  const wrap = el('section', { class: 'signin', 'data-signin': '', 'aria-labelledby': 'signin-title' });

  // "atmo" carries a native <abbr title> gloss — hover on a desktop, read by
  // assistive tech — but touch cannot hover, so the sentence below says the same
  // thing in plain sight and the tooltip is a bonus, not the only copy.
  const title = el('h2', { id: 'signin-title' }, 'Choose your ', el('abbr', { class: 'signin-gloss', title: ATMO_GLOSS }, 'atmo'), ' provider');
  const intro = el('p', { class: 'signin__hint' },
    `To make a card you sign in with an account from an atmo provider — ${ATMO_GLOSS.charAt(0).toLowerCase()}${ATMO_GLOSS.slice(1)}. Bluesky is one of many, and each sets its own rules. Your cards are written to your own account.`);

  // Front page: the providers a newcomer can JOIN from here.
  const list = el('div', { class: 'signin-list' }, ...featuredProviders().map((p) => providerRow(p, handlers)));

  // Everything not on the short list reaches the same seam: invite-only
  // providers first, then a handle on any atproto host at all. The list is an
  // editorial convenience, not a boundary.
  const input = el('input', {
    type: 'text', name: 'handle', id: 'signin-handle', class: 'signin__input', placeholder: 'you.example.com',
    autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false',
  });
  const error = el('p', { class: 'signin__error', role: 'alert', hidden: true });
  const submit = el('button', { type: 'submit', class: 'button button--sm', 'data-provider-handle-go': '' }, 'Continue');
  const form = el('form', { class: 'signin-other-form', novalidate: '' },
    el('label', { for: 'signin-handle', class: 'signin__hint' }, 'Your handle on any atmo provider'),
    el('div', { class: 'signin-handle-row' }, input, submit),
    error);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim().replace(/^@+/, '');
    if (value === '') {
      error.textContent = 'Enter your handle to continue — for example you.example.com.';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Redirecting…';
    handlers.onSignIn(value);
  });
  const panel = el('div', { class: 'signin-other', hidden: true },
    el('div', { class: 'signin-list' }, ...otherProviders().map((p) => providerRow(p, handlers))), form);
  const other = el('button', { type: 'button', class: 'button button--ghost signin-more', 'data-provider-other': '' }, 'Another provider');
  other.addEventListener('click', () => {
    other.hidden = true;
    panel.hidden = false;
    input.focus();
  });

  wrap.append(title, intro, list, other, panel);
  return [wrap, homeLink()];
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
