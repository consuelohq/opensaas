import { atom } from 'recoil';

// Set by the home page import flow after creating a new list.
// DialerHomePrep reads this on mount to auto-select the imported list.
export const importedListIdState = atom<string>({
  key: 'importedListIdState',
  default: '',
});
