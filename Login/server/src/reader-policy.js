export const READER_PERMISSIONS = ['software:biomedico:access', 'hb:view'];

export function restrictReaderPermissions(permissions = [], roles = []) {
  return roles.includes('lector')
    ? permissions.filter((permission) => READER_PERMISSIONS.includes(permission))
    : permissions;
}

// Only scoped equipment reads and personal session actions are available to readers.
// The endpoint still validates subscription, tenant and area/location access.
export function readerRequestAllowed(method, pathname) {
  if (['GET', 'HEAD'].includes(method)) {
    return [
      /^\/auth\/(me|sessions)\/?$/,
      /^\/(modules|software-suites|clients|subscription)\/me\/?$/,
      /^\/notifications\/?$/,
      /^\/biomed\/[^/]+\/(sites|areas|locations|assets)\/?$/,
      /^\/biomed\/[^/]+\/assets\/[^/]+(?:\/(pdf|full-pdf|history|movements))?\/?$/,
      /^\/biomed\/[^/]+\/(asset-history-files|asset-movements)\/[^/]+\/pdf\/?$/,
      /^\/maintenance\/reports\/[^/]+\/pdf\/?$/,
      /^\/calibration\/items\/[^/]+\/pdf\/?$/
    ].some((route) => route.test(pathname));
  }
  return (method === 'DELETE' && /^\/auth\/sessions\/[^/]+\/?$/.test(pathname))
    || (method === 'POST' && (
      /^\/auth\/sessions\/revoke-others\/?$/.test(pathname)
      || /^\/notifications\/(read-all|[^/]+\/read)\/?$/.test(pathname)
    ));
}
