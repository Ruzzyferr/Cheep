import { defineConfig } from 'vitest/config';

// Saf TS yardımcıları (geo / consent / storage) için hafif birim testi koşucusu.
// RN bileşenleri render EDİLMEZ; expo-* ve react-native modülleri testlerde
// vi.mock ile taklit edilir, bu yüzden native bir ortam gerekmez.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
