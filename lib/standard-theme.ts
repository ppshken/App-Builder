import {DEFAULT_SETTINGS, type AppSettings} from "./app-settings";
import {pwaApplication} from "./pwa";

/** Shared login and launcher appearance, independent of application settings. */
export const STANDARD_SETTINGS: AppSettings = {...DEFAULT_SETTINGS, mode:"light", color:"blue"};
export function usesStandardTheme(path:string){
  const page=path.split("?")[0].replace(/\/$/, "")||"/";
  return page==="/"||page==="/apps"||page==="/login"||!!pwaApplication(page)&&page.endsWith("/login");
}
