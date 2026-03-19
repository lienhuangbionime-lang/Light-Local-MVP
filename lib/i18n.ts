import { useAppStore } from "./store";
import zhTW from "../public/locales/zh-TW.json";
import vi from "../public/locales/vi.json";

const translations = {
  "zh-TW": zhTW,
  "vi": vi,
};

export type Language = "zh-TW" | "vi";

export function useTranslation() {
  const language = useAppStore((state: any) => state.language) || "zh-TW";
  
  const t = (path: string, options?: any) => {
    const keys = path.split(".");
    let result: any = (translations as any)[language];
    
    for (const key of keys) {
      if (result && result[key] !== undefined) {
        result = result[key];
      } else {
        return path;
      }
    }

    if (options?.returnObjects) {
      return result;
    }
    
    if (typeof result === 'string' && options) {
      let str = result;
      Object.keys(options).forEach(key => {
        str = str.replace(`{${key}}`, String(options[key]));
      });
      return str;
    }
    
    return typeof result === 'string' ? result : path;
  };

  return { t, language };
}
