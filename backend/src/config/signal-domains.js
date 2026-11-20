/**
 * Sender domain categories for the deterministic signals (card #246). Suffix match:
 * "example.hu" also covers "x.example.hu". Only generic examples here: the owner's
 * own list (banks, insurers, school, work...) is kept locally.
 * A category is a signal, not a verdict: marketing mail from a bank is still bulk.
 */
export default {
  government: ['gov.hu', 'magyarorszag.hu', 'nav.gov.hu', 'tarsadalombiztositasilevelek.hu'],
  work: ['apache.org', 'mifos.org'],
};
