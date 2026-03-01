/**
 * 🔘 FAB State Utility
 * Global flag to communicate FAB press to ListsScreen
 * This is a workaround for nested navigator navigation limitations
 */

let _shouldOpenCreateModalFromFAB = false;

export function getShouldOpenCreateModalFromFAB(): boolean {
  return _shouldOpenCreateModalFromFAB;
}

export function setShouldOpenCreateModalFromFAB(value: boolean): void {
  _shouldOpenCreateModalFromFAB = value;
}

