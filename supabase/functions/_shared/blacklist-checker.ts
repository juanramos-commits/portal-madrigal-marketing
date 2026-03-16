/**
 * Blacklist checker for Cold Email.
 *
 * Checks the ce_blacklist table for an exact email match
 * or a domain-level match.
 */

/**
 * Extract the domain portion from an email address.
 * Returns lowercase domain or null if parsing fails.
 */
function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * Check whether an email (or its domain) appears in ce_blacklist.
 *
 * The table is expected to have a column `valor` that stores either
 * a full email address or a bare domain. Both are checked.
 */
export async function isBlacklisted(
  supabase: any,
  email: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = extractDomain(normalizedEmail);

  // Build the list of values to check against.
  const valuesToCheck: string[] = [normalizedEmail];
  if (domain) {
    valuesToCheck.push(domain);
  }

  const { data, error } = await supabase
    .from("ce_blacklist")
    .select("id")
    .in("valor", valuesToCheck)
    .limit(1);

  if (error) {
    throw new Error(`ce_blacklist lookup failed: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}
