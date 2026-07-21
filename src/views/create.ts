// Create view (Phase 1b shell). Creator sign-in arrives in Phase 2 and the card
// form (text + theme + cover, public/sealed) in Phases 3–4; this shell proves
// the route is reachable and gives those phases a mount point.
export function renderCreate(app: HTMLElement): void {
  app.replaceChildren();

  const h = document.createElement('h1');
  h.textContent = 'Create a greeting';

  const note = document.createElement('p');
  note.textContent = 'Sign-in and the card form arrive in the next phases.';

  const back = document.createElement('a');
  back.href = '#/';
  back.className = 'button';
  back.textContent = 'Back';

  app.append(h, note, back);
}
