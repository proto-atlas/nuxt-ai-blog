export interface SummaryQualityFixture {
  slug: string;
  sourceText: string;
  summary: string;
  requiredTerms: string[];
  forbiddenTerms: string[];
  maxCharacters?: number;
}

export interface SummaryQualityCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface SummaryQualityResult {
  slug: string;
  passed: boolean;
  checks: SummaryQualityCheck[];
}

const DEFAULT_MAX_CHARACTERS = 150;
const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/u;
const SECRET_LIKE_FRAGMENTS = [
  String.raw`sk-[a-z0-9_-]{10,}`,
  ['NUXT_', '[A-Z0-9_]*', 'KEY'].join(''),
  ['process', String.raw`\.`, 'env'].join(''),
  ['BEGIN ', '[A-Z ]*', 'PRIVATE ', 'KEY'].join(''),
  ['A', 'K', 'I', 'A', '[0-9A-Z]{16}'].join(''),
];
const SECRET_LIKE_PATTERN = new RegExp(`(${SECRET_LIKE_FRAGMENTS.join('|')})`, 'u');
const MARKDOWN_STRUCTURE_PATTERN = /(^|\n)\s*(#{1,6}\s|-\s|\*\s|>\s|```)/u;

export function evaluateSummaryQuality(fixture: SummaryQualityFixture): SummaryQualityResult {
  const maxCharacters = fixture.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const checks: SummaryQualityCheck[] = [
    {
      name: 'non-empty',
      passed: fixture.summary.trim().length > 0,
      detail: 'summary is not empty',
    },
    {
      name: 'within-length',
      passed: [...fixture.summary].length <= maxCharacters,
      detail: `summary length <= ${maxCharacters}`,
    },
    {
      name: 'japanese-text',
      passed: JAPANESE_TEXT_PATTERN.test(fixture.summary),
      detail: 'summary contains Japanese text',
    },
    {
      name: 'plain-prose',
      passed: !MARKDOWN_STRUCTURE_PATTERN.test(fixture.summary),
      detail: 'summary is plain prose, not markdown structure',
    },
    {
      name: 'no-secret-like-text',
      passed: !SECRET_LIKE_PATTERN.test(fixture.summary),
      detail: 'summary does not contain obvious secret-like strings',
    },
    {
      name: 'required-terms',
      passed: fixture.requiredTerms.every(
        (term) => fixture.sourceText.includes(term) && fixture.summary.includes(term),
      ),
      detail: 'summary includes required terms that exist in source text',
    },
    {
      name: 'forbidden-terms',
      passed: fixture.forbiddenTerms.every((term) => !fixture.summary.includes(term)),
      detail: 'summary does not add configured out-of-scope terms',
    },
  ];

  return {
    slug: fixture.slug,
    passed: checks.every((check) => check.passed),
    checks,
  };
}

export function countPassedChecks(result: SummaryQualityResult): number {
  return result.checks.filter((check) => check.passed).length;
}

export const SUMMARY_QUALITY_LIMITS = {
  DEFAULT_MAX_CHARACTERS,
};
