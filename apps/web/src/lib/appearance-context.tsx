import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import {
  FontFamilyKey,
  FontSizeKey,
  FONT_FAMILY_OPTIONS,
  FONT_SIZE_OPTIONS,
  PaletteKey,
} from "./appearance-palettes";

const STORAGE_KEY = "septa:appearance";

interface AppearanceState {
  palette: PaletteKey;
  darkMode: boolean;
  fontSize: FontSizeKey;
  fontFamily: FontFamilyKey;
}

const DEFAULT_STATE: AppearanceState = {
  palette: "default",
  darkMode: false,
  fontSize: "medium",
  fontFamily: "vazirmatn",
};

function readStoredState(): AppearanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      palette: parsed.palette ?? DEFAULT_STATE.palette,
      darkMode: parsed.darkMode ?? DEFAULT_STATE.darkMode,
      fontSize: parsed.fontSize ?? DEFAULT_STATE.fontSize,
      fontFamily: parsed.fontFamily ?? DEFAULT_STATE.fontFamily,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

// فاز ۴۱-الف: هم در index.html (قبل از mount، جلوگیری از فلش) و هم اینجا استفاده می‌شه
// ⚠️ فونت مستقل از پالت انتخاب می‌شه — با style.setProperty روی --font-fa ست می‌شه که از
// هر مقدار پیش‌فرض پالت (در theme.css) با اولویت بالاتر override می‌کنه؛ یعنی هر پالتی با هر فونتی قابل‌تجربه‌ست
export function applyAppearanceToDocument(state: AppearanceState) {
  const root = document.documentElement;
  root.setAttribute("data-palette", state.palette);
  root.classList.toggle("dark", state.darkMode);
  const fontSizeOption = FONT_SIZE_OPTIONS.find((f) => f.key === state.fontSize) ?? FONT_SIZE_OPTIONS[1];
  root.style.fontSize = `${fontSizeOption.px}px`;
  const fontFamilyOption =
    FONT_FAMILY_OPTIONS.find((f) => f.key === state.fontFamily) ?? FONT_FAMILY_OPTIONS[0];
  root.style.setProperty("--font-fa", fontFamilyOption.stack);
}

interface AppearanceContextValue extends AppearanceState {
  setPalette: (palette: PaletteKey) => void;
  setDarkMode: (darkMode: boolean) => void;
  setFontSize: (fontSize: FontSizeKey) => void;
  setFontFamily: (fontFamily: FontFamilyKey) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppearanceState>(() => readStoredState());

  useEffect(() => {
    applyAppearanceToDocument(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...state }));
  }, [state]);

  const setPalette = useCallback((palette: PaletteKey) => setState((s) => ({ ...s, palette })), []);
  const setDarkMode = useCallback((darkMode: boolean) => setState((s) => ({ ...s, darkMode })), []);
  const setFontSize = useCallback((fontSize: FontSizeKey) => setState((s) => ({ ...s, fontSize })), []);
  const setFontFamily = useCallback(
    (fontFamily: FontFamilyKey) => setState((s) => ({ ...s, fontFamily })),
    [],
  );

  return (
    <AppearanceContext.Provider
      value={{ ...state, setPalette, setDarkMode, setFontSize, setFontFamily }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance باید داخل AppearanceProvider استفاده بشه");
  return ctx;
}
