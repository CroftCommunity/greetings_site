// Home view (Phase 1b shell). The real landing content evolves later; for now
// it names the product and links to the create flow.
export function renderHome(app: HTMLElement): void {
  app.replaceChildren();

  const h = document.createElement('h1');
  h.textContent = 'greetings';

  const tagline = document.createElement('p');
  tagline.textContent = 'Send a 1:1 greeting card by link — public, or server-blind.';

  const cta = document.createElement('a');
  cta.href = '#/create';
  cta.className = 'button';
  cta.textContent = 'Create a greeting';

  app.append(h, tagline, cta);
}
