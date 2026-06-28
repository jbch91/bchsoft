// Angular's Sass worker pool uses Piscina with synchronous Atomics by default.
// On some local macOS/Node combinations this can leave build workers waiting
// indefinitely after compilation. This flag makes Angular choose Piscina's
// non-Atomics mode, matching its own webcontainer fallback.
process.versions.webcontainer = process.versions.webcontainer || '1';
