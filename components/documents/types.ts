export type DocumentTarget = { projectId: string } | { tenderId: string } | { workerId: string };

export type DocumentRow = {
  source: "stored" | "linked";
  id: string;
  name: string;
  category: string;
  mime: string | null;
  size: number | null;
  version: number | null;
  hasPreview: boolean;
  tags: string[];
  driveUrl: string | null;
  byName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentConfig = {
  projectCategoryList: string[];
  tenderCategoryList: string[];
  linkedKindList: string[];
  generatedStatusList: string[];
};

export function targetQueryParam(target: DocumentTarget): string {
  if ("projectId" in target) return `projectId=${target.projectId}`;
  if ("tenderId" in target) return `tenderId=${target.tenderId}`;
  return `workerId=${target.workerId}`;
}

export function targetCategoryList(target: DocumentTarget, config: DocumentConfig): string[] {
  if ("projectId" in target) return config.projectCategoryList;
  if ("tenderId" in target) return config.tenderCategoryList;
  return [...config.projectCategoryList, ...config.tenderCategoryList].filter((v, i, arr) => arr.indexOf(v) === i);
}

export function formatBytes(size: number | null): string {
  if (size === null) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
