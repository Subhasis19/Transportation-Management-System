export type RefreshTokenCandidate = {
  tokenHash: string;
};

type RefreshTokenLookup<T extends RefreshTokenCandidate> = {
  findById: () => Promise<T | null>;
  findLegacy: () => Promise<T[]>;
};

export async function findMatchingRefreshToken<
  T extends RefreshTokenCandidate,
>(
  rawToken: string,
  lookup: RefreshTokenLookup<T>,
  compare: (rawToken: string, tokenHash: string) => Promise<boolean>,
) {
  const exact = await lookup.findById();
  if (exact) {
    return (await compare(rawToken, exact.tokenHash)) ? exact : null;
  }

  const legacyCandidates = await lookup.findLegacy();
  for (const candidate of legacyCandidates) {
    if (await compare(rawToken, candidate.tokenHash)) return candidate;
  }

  return null;
}
