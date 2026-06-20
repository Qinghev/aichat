/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UPDATE_MANIFEST_URL?: string;
  readonly VITE_UPDATE_CHECK_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
