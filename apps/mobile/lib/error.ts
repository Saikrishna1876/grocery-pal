function normalizeMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    return '';
  }

  const convexMatch = trimmed.match(/Uncaught\s+ConvexError:\s*([^\n]+)/i);
  if (convexMatch?.[1]) {
    return convexMatch[1].trim();
  }

  const genericUncaughtMatch = trimmed.match(/Uncaught\s+[A-Za-z]+Error:\s*([^\n]+)/i);
  if (genericUncaughtMatch?.[1]) {
    return genericUncaughtMatch[1].trim();
  }

  if (!trimmed.includes('[CONVEX')) {
    return trimmed;
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter(
      (line) =>
        !line.startsWith('[CONVEX') &&
        !line.startsWith('[Request ID:') &&
        line !== 'Server Error' &&
        line !== 'Called by client' &&
        !line.startsWith('at ')
    );

  return lines[0] ?? '';
}

export function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    const normalized = normalizeMessage(error.message);
    return normalized || fallbackMessage;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    const normalized = normalizeMessage(error);
    return normalized || fallbackMessage;
  }

  return fallbackMessage;
}

export function getErrorStack(error: unknown) {
  if (error instanceof Error) {
    return error.stack;
  }

  if (typeof error === 'object' && error !== null && 'stack' in error) {
    const stack = (error as { stack?: unknown }).stack;
    return typeof stack === 'string' ? stack : undefined;
  }

  return undefined;
}
