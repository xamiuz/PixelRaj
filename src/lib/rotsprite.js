// Implementasi Algoritma RotSprite (Scale3x -> Rotate -> Nearest Neighbor Downscale)
// Dioptimalkan untuk Pixel Art

export function scale3x(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = new Uint32Array(imageData.data.buffer);
  
  const destData = new ImageData(w * 3, h * 3);
  const dst = new Uint32Array(destData.data.buffer);

  const getPx = (x, y) => {
    if (x < 0) x = 0;
    if (x >= w) x = w - 1;
    if (y < 0) y = 0;
    if (y >= h) y = h - 1;
    return src[y * w + x];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const A = getPx(x - 1, y - 1);
      const B = getPx(x, y - 1);
      const C = getPx(x + 1, y - 1);
      const D = getPx(x - 1, y);
      const E = getPx(x, y);
      const F = getPx(x + 1, y);
      const G = getPx(x - 1, y + 1);
      const H = getPx(x, y + 1);
      const I = getPx(x + 1, y + 1);

      let E0 = E, E1 = E, E2 = E, E3 = E, E4 = E, E5 = E, E6 = E, E7 = E, E8 = E;

      if (D === B && D !== G && B !== F) E0 = D;
      if ((D === B && D !== G && B !== F && E !== C) || (B === F && B !== A && F !== I && E !== D)) E1 = B;
      if (B === F && B !== A && F !== I) E2 = F;
      if ((D === B && D !== G && B !== F && E !== A) || (D === H && D !== A && H !== I && E !== B)) E3 = D;
      if ((B === F && B !== A && F !== I && E !== C) || (H === F && H !== G && F !== C && E !== I)) E5 = F;
      if (D === H && D !== A && H !== I) E6 = D;
      if ((D === H && D !== A && H !== I && E !== G) || (H === F && H !== G && F !== C && E !== I)) E7 = H;
      if (H === F && H !== G && F !== C) E8 = F;

      const dstX = x * 3;
      const dstY = y * 3;
      const dstW = w * 3;
      
      dst[dstY * dstW + dstX] = E0;
      dst[dstY * dstW + dstX + 1] = E1;
      dst[dstY * dstW + dstX + 2] = E2;
      dst[(dstY + 1) * dstW + dstX] = E3;
      dst[(dstY + 1) * dstW + dstX + 1] = E4;
      dst[(dstY + 1) * dstW + dstX + 2] = E5;
      dst[(dstY + 2) * dstW + dstX] = E6;
      dst[(dstY + 2) * dstW + dstX + 1] = E7;
      dst[(dstY + 2) * dstW + dstX + 2] = E8;
    }
  }
  
  return destData;
}

export function rotateNearestNeighbor(srcData, angleDeg, dstW, dstH) {
  const srcW = srcData.width;
  const srcH = srcData.height;
  const src = new Uint32Array(srcData.data.buffer);
  
  const dstData = new ImageData(dstW, dstH);
  const dst = new Uint32Array(dstData.data.buffer);
  
  const rad = -angleDeg * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  const srcCX = srcW / 2;
  const srcCY = srcH / 2;
  const dstCX = dstW / 2;
  const dstCY = dstH / 2;
  
  for (let y = 0; y < dstH; y++) {
    const dy = y - dstCY + 0.5;
    for (let x = 0; x < dstW; x++) {
      const dx = x - dstCX + 0.5;
      
      const sx = Math.floor(dx * cos - dy * sin + srcCX);
      const sy = Math.floor(dx * sin + dy * cos + srcCY);
      
      if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        dst[y * dstW + x] = src[sy * srcW + sx];
      } else {
        dst[y * dstW + x] = 0;
      }
    }
  }
  
  return dstData;
}

export function rotatePixelArt(sourceCanvas, angleDeg, newW, newH) {
  if (angleDeg === 0) {
    const dstCanvas = document.createElement("canvas");
    dstCanvas.width = newW;
    dstCanvas.height = newH;
    const ctx = dstCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sourceCanvas, 0, 0);
    return dstCanvas;
  }

  // 1. Scale3x the original canvas
  const srcCtx = sourceCanvas.getContext("2d");
  const imgData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const scaledData = scale3x(imgData);

  // 2. Rotate the scaled canvas using pure Nearest Neighbor in JS (removes any anti-aliasing!)
  const rotatedScaledW = newW * 3;
  const rotatedScaledH = newH * 3;
  const rotatedScaledData = rotateNearestNeighbor(scaledData, angleDeg, rotatedScaledW, rotatedScaledH);

  // 3. Downscale back to 1x by sampling the center pixel of every 3x3 block
  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = newW;
  dstCanvas.height = newH;
  const dstCtx = dstCanvas.getContext("2d");
  
  const rotSrc = new Uint32Array(rotatedScaledData.data.buffer);
  const finalImgData = dstCtx.createImageData(newW, newH);
  const finalDst = new Uint32Array(finalImgData.data.buffer);
  
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < newW; x++) {
      // sample center of 3x3 block
      const sampleX = x * 3 + 1;
      const sampleY = y * 3 + 1;
      finalDst[y * newW + x] = rotSrc[sampleY * rotatedScaledW + sampleX];
    }
  }
  
  dstCtx.putImageData(finalImgData, 0, 0);
  return dstCanvas;
}

