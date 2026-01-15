/**
 * Legacy entrypoint (backward compatibility).
 *
 * Tools have been migrated to the Agent Skills platform under `src/skills/<Skill>/tools/<Tool>`.
 * Keep this file so existing imports like `../tools/tokenRisk.js` continue to work.
 *
 * Canonical implementation: `src/skills/RiskSkill/tools/tokenRisk.ts`
 */
export * from '../skills/RiskSkill/tools/tokenRisk.js';
