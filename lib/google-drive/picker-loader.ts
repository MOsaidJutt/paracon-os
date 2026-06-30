// Thin client-side loader for Google's Picker widget (apis.google.com/js/api.js).
// Loaded lazily, once, only when a user actually opens "Browse Drive" — never
// blocks the documents panel's initial render for orgs that haven't
// connected Drive (or never click the button). No official @types package is
// installed for the Picker API, so callers work against the minimal surface
// declared in lib/google-drive/picker-types.ts instead of `any`.
declare global {
  interface Window {
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

let loadPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/** Resolves once `window.google.picker` is ready to use. Safe to call repeatedly — subsequent calls reuse the same in-flight/resolved promise. */
export function loadGooglePicker(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = loadScript("https://apis.google.com/js/api.js").then(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!window.gapi) {
          reject(new Error("Google API loader failed to attach to window"));
          return;
        }
        window.gapi.load("picker", () => resolve());
      })
  );
  return loadPromise;
}
