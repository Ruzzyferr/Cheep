export interface ConstraintProfile { diet?: string; avoid?: string[]; allergies?: string[] }
export interface ConstraintVerdict { hidden: boolean; warnings: string[] }

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');
const has = (cat: string, kws: string[]) => kws.some(k => cat.includes(k));

export function evaluateProductConstraints(
  categoryName: string | null,
  profile: ConstraintProfile
): ConstraintVerdict {
  const warnings: string[] = [];
  if (!categoryName) return { hidden: false, warnings };
  const cat = norm(categoryName);

  const isMeat = has(cat, ['et', 'tavuk', 'kırmızı et', 'sarkuteri', 'şarküteri', 'sucuk', 'salam']);
  const isFish = has(cat, ['balık', 'balik', 'deniz']);
  const isAnimal = isMeat || isFish || has(cat, ['süt', 'peynir', 'yumurta', 'tereyağ']);

  const diet = profile.diet;
  let hidden = false;
  if (diet === 'vegan' && (isAnimal)) hidden = true;
  if (diet === 'vegetarian' && (isMeat || isFish)) hidden = true;
  if (diet === 'pescatarian' && isMeat && !isFish) hidden = true;

  if (profile.avoid?.includes('pork_gelatin') && has(cat, ['sarkuteri', 'şarküteri', 'sucuk', 'salam'])) {
    warnings.push('Domuz/jelatin içerebilir — etiketi kontrol et');
  }
  // Conservative v1 heuristic: warn allergic users about likely-allergen baked goods categories
  if (profile.allergies && profile.allergies.length > 0 && isAnimal === false && has(cat, ['fırın', 'pastane', 'bisküvi', 'çikolata'])) {
    warnings.push('Alerjen içerebilir — etiketi kontrol et');
  }
  return { hidden, warnings };
}
