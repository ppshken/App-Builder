"use client";
import { useAppSettings } from "./AppSettingsProvider";
import type { AppSettings } from "@/lib/app-settings";
export default function AppLoading({ settings: sample, compact = false }: {settings?:AppSettings;compact?:boolean}) {
  const {settings:saved}=useAppSettings(), settings=sample || saved;
  return <div className={`app-loading ${compact?"compact":""}`} role="status" aria-live="polite" aria-busy="true" aria-label={settings.loading_text} data-loading-style={settings.loading_style}>
    {settings.loading_style!=="text" && <span className="app-loading-spinner" aria-hidden="true"/>}
    {settings.loading_style!=="spinner" && <span>{settings.loading_text}</span>}
  </div>;
}
