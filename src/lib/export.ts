// Capture a copy before async encoding, so movement cannot change the saved frame.
export async function saveAvatarPng(source: HTMLCanvasElement, filename: string) {
  const snapshot = document.createElement("canvas");
  snapshot.width = source.width; snapshot.height = source.height;
  const ctx = snapshot.getContext("2d")!;
  ctx.fillStyle = "#faf8f3"; ctx.fillRect(0, 0, snapshot.width, snapshot.height);
  ctx.drawImage(source, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    snapshot.toBlob(value => value ? resolve(value) : reject(new Error("The image could not be saved. Try again.")), "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
