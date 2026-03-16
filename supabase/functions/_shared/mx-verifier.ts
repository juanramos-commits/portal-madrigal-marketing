/**
 * MX record verification for Cold Email.
 *
 * Uses Deno's built-in DNS resolver to check whether a domain
 * has valid MX records. Results are cached in memory for the
 * lifetime of the edge function invocation.
 */

interface MXResult {
  valid: boolean;
  records?: string[];
}

/** In-memory cache: domain -> MXResult. Lives for the function invocation. */
const mxCache = new Map<string, MXResult>();

/**
 * Extract the domain from an email address.
 */
function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * Verify that the domain of the given email has MX records.
 *
 * Returns cached results when available.
 */
export async function verifyMX(email: string): Promise<MXResult> {
  const domain = extractDomain(email);
  if (!domain) {
    return { valid: false };
  }

  // Check cache first.
  const cached = mxCache.get(domain);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const records = await Deno.resolveDns(domain, "MX");

    if (records && records.length > 0) {
      const exchanges = records.map(
        (r: { exchange: string; preference: number }) => r.exchange,
      );
      const result: MXResult = { valid: true, records: exchanges };
      mxCache.set(domain, result);
      return result;
    }

    const result: MXResult = { valid: false };
    mxCache.set(domain, result);
    return result;
  } catch (_err) {
    // DNS resolution failure -> treat as invalid.
    const result: MXResult = { valid: false };
    mxCache.set(domain, result);
    return result;
  }
}

/**
 * Verify MX records for multiple emails, deduplicating by domain.
 *
 * @returns Map from email address to validity boolean.
 */
export async function batchVerifyMX(
  emails: string[],
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Group emails by domain to avoid redundant lookups.
  const domainToEmails = new Map<string, string[]>();
  for (const email of emails) {
    const domain = extractDomain(email);
    if (!domain) {
      results.set(email, false);
      continue;
    }
    const list = domainToEmails.get(domain) ?? [];
    list.push(email);
    domainToEmails.set(domain, list);
  }

  // Resolve all unique domains concurrently.
  const domainEntries = [...domainToEmails.entries()];
  const verifications = await Promise.all(
    domainEntries.map(async ([_domain, domainEmails]) => {
      // Use the first email of each domain group for verification.
      const mxResult = await verifyMX(domainEmails[0]);
      return { domainEmails, valid: mxResult.valid };
    }),
  );

  for (const { domainEmails, valid } of verifications) {
    for (const email of domainEmails) {
      results.set(email, valid);
    }
  }

  return results;
}
