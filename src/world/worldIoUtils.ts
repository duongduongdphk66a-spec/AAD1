/**
 * Shared browser download helper that safely revokes the Object URL after starting the download.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof URL === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10_000);
  }
}
