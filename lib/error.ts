export function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
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
