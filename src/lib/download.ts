const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function triggerBlobDownload(filename: string, blob: Blob) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Some WebKit versions abort the download when the URL is revoked in the
  // same task as the click, so revoke asynchronously instead.
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 0);
}

export function downloadBufferAsDocx(name: string, buffer: ArrayBuffer) {
  triggerBlobDownload(name, new Blob([buffer], { type: DOCX_MIME_TYPE }));
}
