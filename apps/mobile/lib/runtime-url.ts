import { getExpoGoProjectConfig, isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', '0.0.0.0', 'localhost']);

function extractHostname(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return value.split(':')[0] || null;
  }
}

function getExpoDevHost() {
  if (!isRunningInExpoGo()) {
    return null;
  }

  const candidates = [Constants.expoConfig?.hostUri, getExpoGoProjectConfig()?.debuggerHost];

  for (const candidate of candidates) {
    const host = extractHostname(candidate);
    if (host) {
      return host;
    }
  }

  return null;
}

export function resolveRuntimeUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    if (!LOOPBACK_HOSTS.has(parsedUrl.hostname)) {
      return parsedUrl.toString().replace(/\/$/, '');
    }

    const devHost = getExpoDevHost();
    if (!devHost) {
      return parsedUrl.toString().replace(/\/$/, '');
    }

    parsedUrl.hostname = devHost;
    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}
