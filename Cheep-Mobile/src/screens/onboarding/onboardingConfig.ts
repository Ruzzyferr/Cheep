/**
 * 🐦 Onboarding Config
 * 5-question wizard driven by this config — no hardcoding in the screen.
 *
 * `title`, `mascot` and every option's `label` hold i18n KEYS (not literal text) —
 * the screen(s) that render them call `t(key)` at render time (see
 * OnboardingScreen.tsx and ProfileScreen.tsx, which reuses these option lists
 * for the preferences editor).
 */

export type QuestionType = 'single' | 'multi' | 'budget';

export interface OnboardingQuestion {
  key: 'household_size' | 'diet' | 'avoid' | 'allergies' | 'weekly_budget';
  type: QuestionType;
  title: string; // i18n key
  mascot: string; // i18n key — short encouragement text
  options?: { value: string; label: string }[]; // label = i18n key
  allowCustom?: boolean; // shows a free-text TextInput
  optional?: boolean;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    key: 'household_size',
    type: 'single',
    title: 'onboarding.q.household_size.title',
    mascot: 'onboarding.q.household_size.mascot',
    options: [
      { value: '1', label: 'onboarding.q.household_size.options.1' },
      { value: '2', label: 'onboarding.q.household_size.options.2' },
      { value: '3-4', label: 'onboarding.q.household_size.options.3-4' },
      { value: '5+', label: 'onboarding.q.household_size.options.5plus' },
    ],
  },
  {
    key: 'diet',
    type: 'single',
    title: 'onboarding.q.diet.title',
    mascot: 'onboarding.q.diet.mascot',
    options: [
      { value: 'omnivore', label: 'onboarding.q.diet.options.omnivore' },
      { value: 'vegetarian', label: 'onboarding.q.diet.options.vegetarian' },
      { value: 'vegan', label: 'onboarding.q.diet.options.vegan' },
      { value: 'pescatarian', label: 'onboarding.q.diet.options.pescatarian' },
    ],
  },
  {
    key: 'avoid',
    type: 'multi',
    title: 'onboarding.q.avoid.title',
    mascot: 'onboarding.q.avoid.mascot',
    options: [
      { value: 'pork_gelatin', label: 'onboarding.q.avoid.options.pork_gelatin' },
      { value: 'alcohol', label: 'onboarding.q.avoid.options.alcohol' },
    ],
  },
  {
    key: 'allergies',
    type: 'multi',
    title: 'onboarding.q.allergies.title',
    mascot: 'onboarding.q.allergies.mascot',
    allowCustom: true,
    options: [
      { value: 'lactose', label: 'onboarding.q.allergies.options.lactose' },
      { value: 'gluten', label: 'onboarding.q.allergies.options.gluten' },
      { value: 'peanut', label: 'onboarding.q.allergies.options.peanut' },
      { value: 'tree_nut', label: 'onboarding.q.allergies.options.tree_nut' },
      { value: 'none', label: 'onboarding.q.allergies.options.none' },
    ],
  },
  {
    key: 'weekly_budget',
    type: 'budget',
    title: 'onboarding.q.weekly_budget.title',
    mascot: 'onboarding.q.weekly_budget.mascot',
    optional: true,
  },
];
