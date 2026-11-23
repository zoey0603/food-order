export function appUrl(path: string) {
  return new URL(path, new URL('./', window.location.href)).href;
}
