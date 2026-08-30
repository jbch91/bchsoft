export interface SoftwareSuiteAccess {
  key: string;
  enabled: boolean;
}

export function automaticSoftwareSuiteKey(
  suites: readonly SoftwareSuiteAccess[]
): string | null {
  const enabledSuites = suites.filter((suite) => suite.enabled);
  return enabledSuites.length === 1 ? enabledSuites[0].key : null;
}
