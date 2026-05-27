/**
 * Intelligent Name Matcherc core utility for student verification.
 * Implements:
 * 1. Tokenized Set-Based Matching (Order-Insensitive)
 * 2. Double-Sided Phonetic Matching (Soundex)
 * 3. Fuzzy String Distance (Levenshtein Distance)
 */

/**
 * Normalizes name strings by removing accents, converting to lowercase,
 * stripping special characters, and splitting into tokens.
 */
export function tokenizeName(name: string): string[] {
  if (!name) return [];
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Strip special characters & punctuation
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Translates a single word into its standard Soundex phonetic representation.
 */
export function soundex(word: string): string {
  if (!word) return '';
  const str = word.toUpperCase();
  const firstLetter = str[0];

  const mappings: { [key: string]: string } = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6'
  };

  let code = firstLetter;
  let prevCode = mappings[firstLetter] || '';

  for (let i = 1; i < str.length; i++) {
    const char = str[i];
    const currCode = mappings[char] || '';
    if (currCode && currCode !== prevCode) {
      code += currCode;
      prevCode = currCode;
    } else if (!currCode) {
      // If it's a vowel/separator, reset prevCode so same numbers separated by vowel are allowed
      if (['A', 'E', 'I', 'O', 'U', 'Y'].includes(char)) {
        prevCode = '';
      }
    }
  }

  // Pad or truncate to exact letter + 3 numbers (size 4)
  return (code.replace(/[^0-9]/g, '') + '000').substring(0, 4);
}

/**
 * Computes standard Levenshtein edit distance between two strings
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculates a normalized similarity score representation from 0.0 to 1.0
 */
export function getSimilarityScore(a: string, b: string): number {
  const distance = getLevenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

export interface MatchResult {
  isProgrammaticMatch: boolean;
  isTokenMatch: boolean;
  isPhoneticMatch: boolean;
  isFuzzyMatch: boolean;
  isNearMiss: boolean;
  score: number;
  matchType: 'programmatic' | 'none';
  reasons: string[];
}

/**
 * Executes programmatic checks to see if student names match.
 */
export function checkProgrammaticMatch(masterName: string, inputName: string): MatchResult {
  const masterTokens = tokenizeName(masterName);
  const userTokens = tokenizeName(inputName);

  const reasons: string[] = [];

  if (masterTokens.length === 0 || userTokens.length === 0) {
    return {
      isProgrammaticMatch: false,
      isTokenMatch: false,
      isPhoneticMatch: false,
      isFuzzyMatch: false,
      isNearMiss: false,
      score: 0.0,
      matchType: 'none',
      reasons: ['One or both names are empty after normalization.']
    };
  }

  // 1. Tokenized Set-Based Matching (Order-Insensitive)
  // Ensure every user-typed token matches a token in the master record.
  const matchedTokens = userTokens.filter(token => masterTokens.includes(token));
  const isTokenSubset = userTokens.every(token => masterTokens.includes(token));
  // At least 2 tokens must match to prevent John matching Jonathan/John etc easily.
  const isTokenMatch = isTokenSubset && matchedTokens.length >= Math.min(2, masterTokens.length);

  if (isTokenMatch) {
    reasons.push(`Token Set Match: All ${userTokens.length} user name tags matched official record.`);
  }

  // 2. Double-Sided Phonetic Matching
  const masterSoundex = masterTokens.map(soundex);
  const userSoundex = userTokens.map(soundex);
  const matchedSoundex = userSoundex.filter(code => masterSoundex.includes(code));
  const isPhoneticSubset = userSoundex.every(code => masterSoundex.includes(code));
  const isPhoneticMatch = isPhoneticSubset && matchedSoundex.length >= Math.min(2, masterSoundex.length);

  if (isPhoneticMatch && !isTokenMatch) {
    reasons.push(`Phonetic Match: All typed names match official records sound signatures.`);
  }

  // 3. Fuzzy Levenshtein Score (Direct vs Order-Sorted)
  const scoreDirect = getSimilarityScore(masterName.toLowerCase().trim(), inputName.toLowerCase().trim());
  
  // Sort and join to handle order inversion in fuzzy checking
  const sortedMaster = [...masterTokens].sort().join(' ');
  const sortedUser = [...userTokens].sort().join(' ');
  const scoreSorted = getSimilarityScore(sortedMaster, sortedUser);

  const finalFuzzyScore = Math.max(scoreDirect, scoreSorted);
  const isFuzzyMatch = finalFuzzyScore >= 0.85;

  if (isFuzzyMatch && !isTokenMatch && !isPhoneticMatch) {
    reasons.push(`Fuzzy Match: Levenshtein similarity score is ${(finalFuzzyScore * 100).toFixed(0)}% (threshold 85%).`);
  }

  const isProgrammaticMatch = isTokenMatch || isPhoneticMatch || isFuzzyMatch;

  // 4. Near Miss Calculation (e.g. Fuzzy Score between 0.70 and 0.85, or partial token overlap matching)
  const isNearMiss = !isProgrammaticMatch && (finalFuzzyScore >= 0.70 || matchedTokens.length >= 1 || matchedSoundex.length >= 1);

  if (isNearMiss) {
    reasons.push(`Near Miss identified: Fuzzy score is ${(finalFuzzyScore * 100).toFixed(0)}%, token intersection is ${matchedTokens.length}/${userTokens.length}. Routing to AI Semantic Clarifier.`);
  }

  return {
    isProgrammaticMatch,
    isTokenMatch,
    isPhoneticMatch,
    isFuzzyMatch,
    isNearMiss,
    score: finalFuzzyScore,
    matchType: isProgrammaticMatch ? 'programmatic' : 'none',
    reasons
  };
}
