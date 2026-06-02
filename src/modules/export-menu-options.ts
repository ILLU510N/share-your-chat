export interface ExportMenuActions {
  copyToClipboard: () => Promise<void>;
  exportToTencentDocs: () => Promise<void>;
  saveToFile: () => Promise<void>;
}

export interface ExportMenuOption {
  text: string;
  action: () => Promise<void>;
}

export function createExportMenuOptions(actions: ExportMenuActions): ExportMenuOption[] {
  return [
    { text: 'Copy to Clipboard', action: actions.copyToClipboard },
    { text: 'Save to File', action: actions.saveToFile },
    { text: 'Export to Tencent Docs', action: actions.exportToTencentDocs },
  ];
}
