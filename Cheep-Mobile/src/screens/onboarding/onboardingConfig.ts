/**
 * 🐦 Onboarding Config
 * 5-question wizard driven by this config — no hardcoding in the screen.
 */

export type QuestionType = 'single' | 'multi' | 'budget';

export interface OnboardingQuestion {
  key: 'household_size' | 'diet' | 'avoid' | 'allergies' | 'weekly_budget';
  type: QuestionType;
  title: string;
  mascot: string; // short encouragement text
  options?: { value: string; label: string }[];
  allowCustom?: boolean; // shows "Sen yaz…" TextInput
  optional?: boolean;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    key: 'household_size',
    type: 'single',
    title: 'Kaç kişiye alışveriş yapıyorsun?',
    mascot: 'Başlayalım! 🐦',
    options: [
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3-4', label: '3-4' },
      { value: '5+', label: '5+' },
    ],
  },
  {
    key: 'diet',
    type: 'single',
    title: 'Beslenme tarzın?',
    mascot: 'Harika gidiyorsun!',
    options: [
      { value: 'omnivore', label: 'Hepçil' },
      { value: 'vegetarian', label: 'Vejetaryen' },
      { value: 'vegan', label: 'Vegan' },
      { value: 'pescatarian', label: 'Pesketaryen' },
    ],
  },
  {
    key: 'avoid',
    type: 'multi',
    title: 'Şunlardan kaçınıyor musun?',
    mascot: 'Sana göre süzeceğiz 🐦',
    options: [
      { value: 'pork_gelatin', label: 'Domuz eti & jelatin' },
      { value: 'alcohol', label: 'Alkollü ürünler' },
    ],
  },
  {
    key: 'allergies',
    type: 'multi',
    title: 'Alerjin/intoleransın?',
    mascot: 'Güvenlik önce!',
    allowCustom: true,
    options: [
      { value: 'lactose', label: 'Laktoz' },
      { value: 'gluten', label: 'Gluten' },
      { value: 'peanut', label: 'Fıstık' },
      { value: 'tree_nut', label: 'Kabuklu yemiş' },
      { value: 'none', label: 'Yok' },
    ],
  },
  {
    key: 'weekly_budget',
    type: 'budget',
    title: 'Haftalık bütçen?',
    mascot: 'Son soru! 🐦',
    optional: true,
  },
];
