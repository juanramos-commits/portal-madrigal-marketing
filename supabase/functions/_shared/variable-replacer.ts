/**
 * Template variable replacement for Cold Email.
 *
 * Replaces {{variable}} placeholders in email templates with
 * contact data fields.
 */

/** Regex that matches {{variableName}} placeholders. */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/** Regex that matches URLs (http/https/www). */
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"\)]+/gi;

/**
 * Remove all hyperlinks/URLs from text to avoid spam filters.
 * Replaces URLs with empty string and cleans up extra whitespace.
 */
export function stripLinks(text: string): string {
  return text
    .replace(URL_PATTERN, "")
    .replace(/  +/g, " ")
    .replace(/\n /g, "\n")
    .trim();
}

/**
 * Check if text contains any URLs/hyperlinks.
 */
export function containsLinks(text: string): boolean {
  return URL_PATTERN.test(text);
}

/**
 * Extract the "company name" from an email domain.
 *
 * Examples:
 *   "acme.com"       -> "Acme"
 *   "bodas-garcia.es" -> "Bodas Garcia"
 *   "hotel-sol.co.uk" -> "Hotel Sol"
 *
 * Strips common TLDs/SLDs, splits on hyphens/dots, and title-cases.
 */
function domainToCompanyName(domain: string): string {
  // Remove known multi-part TLDs first, then single TLDs.
  const cleaned = domain
    .replace(
      /\.(com|net|org|info|biz|co|io)\.(ar|br|mx|uk|es|co|in)$/i,
      "",
    )
    .replace(
      /\.(com|net|org|es|fr|de|it|pt|uk|io|co|info|biz|eu|cat|gal|eus|mx|ar|cl|pe|ec|ve)$/i,
      "",
    );

  // Split on dots and hyphens, title-case each part.
  return cleaned
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Replace all {{variable}} placeholders in a template string.
 *
 * Standard variables:
 *   - {{nombre}}           -> contacto.nombre
 *   - {{empresa}}          -> contacto.empresa
 *   - {{cargo}}            -> contacto.cargo
 *   - {{email}}            -> contacto.email
 *   - {{dominio_empresa}}  -> human-readable company name from email domain
 *
 * Any key present in contacto.campos_custom (JSONB) is also available.
 * Unknown variables are replaced with an empty string.
 */
export function replaceVariables(
  template: string,
  contacto: Record<string, any>,
): string {
  // Build a flat lookup map.
  const values: Record<string, string> = {};

  // Standard fields.
  if (contacto.nombre != null) values.nombre = String(contacto.nombre);
  if (contacto.empresa != null) values.empresa = String(contacto.empresa);
  if (contacto.cargo != null) values.cargo = String(contacto.cargo);
  if (contacto.email != null) values.email = String(contacto.email);
  if (contacto.telefono != null) values.telefono = String(contacto.telefono);
  if (contacto.categoria != null) values.categoria = String(contacto.categoria);
  if (contacto.zona != null) values.zona = String(contacto.zona);

  // Derived: dominio_empresa.
  if (contacto.email) {
    const at = String(contacto.email).lastIndexOf("@");
    if (at !== -1) {
      const domain = String(contacto.email).slice(at + 1).toLowerCase();
      values.dominio_empresa = domainToCompanyName(domain);
    }
  }

  // Merge custom fields (campos_custom JSONB).
  if (contacto.campos_custom && typeof contacto.campos_custom === "object") {
    for (const [key, val] of Object.entries(contacto.campos_custom)) {
      if (val != null) {
        values[key] = String(val);
      }
    }
  }

  return template.replace(VARIABLE_PATTERN, (_match, varName: string) => {
    return values[varName] ?? "";
  });
}

/**
 * Extract the list of variable names found in a template string.
 *
 * @returns Deduplicated array of variable names (without braces).
 */
export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_PATTERN.source, "g");
  while ((match = re.exec(template)) !== null) {
    found.add(match[1]);
  }
  return [...found];
}
