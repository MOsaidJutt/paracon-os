// Minimal hand-written surface of the Google Picker API actually used here —
// no official @types package is installed for it. See
// https://developers.google.com/drive/picker/reference for the full API.

export type PickerDocument = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  url: string;
  iconUrl?: string;
  parentId?: string;
};

export type PickerResponse = {
  action: "picked" | "cancel";
  docs?: PickerDocument[];
};

export type PickerNamespace = {
  ViewId: { DOCS: string; FOLDERS: string };
  DocsView: new (viewId?: string) => {
    setIncludeFolders: (include: boolean) => PickerDocsView;
    setSelectFolderEnabled: (enabled: boolean) => PickerDocsView;
  };
  PickerBuilder: new () => PickerBuilder;
  Action: { PICKED: "picked"; CANCEL: "cancel" };
};

type PickerDocsView = {
  setIncludeFolders: (include: boolean) => PickerDocsView;
  setSelectFolderEnabled: (enabled: boolean) => PickerDocsView;
};

type PickerBuilder = {
  addView: (view: PickerDocsView) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setCallback: (callback: (response: PickerResponse) => void) => PickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};

declare global {
  interface Window {
    google?: {
      picker: PickerNamespace;
    };
  }
}
