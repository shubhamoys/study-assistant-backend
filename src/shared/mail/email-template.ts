import { readFileSync } from 'fs';
import { join } from 'path';
import Handlebars from 'handlebars';

// Table-based layout throughout, no CSS flex/grid — Outlook's Word rendering
// engine and several other mail clients ignore or mis-render both, so the
// template (templates/email-layout.hbs) sticks to <table> for structure and
// a bulletproof-button pattern (bgcolor on a <td>, not a styled <a>/<div>)
// for the CTA. Colors are the light ("Warm Paper") theme's hex values,
// hardcoded directly into the template — CSS custom properties aren't
// supported broadly enough in email clients to reference globals.css's
// tokens directly, and email dark-mode support is too inconsistent across
// clients to rely on a `prefers-color-scheme` swap, so every email renders
// in the light theme regardless of the recipient's device setting (the same
// reasoning transactional emails from most SaaS products land on).
//
// Handlebars auto-escapes every `{{value}}` interpolation (HTML-entity
// escaping), which is also correct for the two spots ctaLink is used inside
// an `href="..."` attribute — no raw `{{{ }}}` anywhere in this template.
const template = Handlebars.compile(
  readFileSync(join(__dirname, 'templates', 'email-layout.hbs'), 'utf-8'),
);

interface EmailLayoutArgs {
  /** Shown in inbox previews (Gmail/Apple Mail) but not in the body itself — hidden via a zero-size, zero-opacity block. */
  preheader: string;
  heading: string;
  /** Each entry becomes its own paragraph. */
  paragraphs: string[];
  ctaText: string;
  ctaLink: string;
  /** A closing line after the button/link-fallback block, e.g. an expiry note. Optional. */
  footnote?: string;
}

export function renderEmail(args: EmailLayoutArgs): string {
  return template(args);
}
