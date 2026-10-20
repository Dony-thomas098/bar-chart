export interface FitOptions {
  viewportWidth: number;
  viewportHeight: number;
  cardWidth: number;
  cardHeight: number;
  showUI?: boolean;
  topPadding?: number;
}

export interface FitResult {
  scale: number;
  posX: number;
  posY: number;
  effectiveMinScale: number;
}

/**
 * Universal score and sheet page fitting algorithm.
 * Dynamically calculates optimal scale and horizontal/vertical centering (posX, posY)
 * across phone portrait, phone rotate / landscape, tablet, and desktop / laptop viewports.
 */
export function calculateScoreFit({
  viewportWidth,
  viewportHeight,
  cardWidth,
  cardHeight,
  showUI = true,
  topPadding,
}: FitOptions): FitResult {
  if (viewportWidth <= 0 || cardWidth <= 0) {
    return { scale: 1, posX: 0, posY: 24, effectiveMinScale: 1 };
  }

  const isLandscape = viewportWidth > viewportHeight;
  const isPhone =
    Math.min(viewportWidth, viewportHeight) <= 600 ||
    (typeof navigator !== 'undefined' && /iPhone|Android|Mobile/i.test(navigator.userAgent));
  const isPhoneRotate = isLandscape && isPhone;
  const isLaptopOrDesktop =
    !isPhone &&
    (viewportWidth >= 768 || (typeof window !== 'undefined' && window.innerWidth >= 768));

  let scale = 1;
  let posX = 0;
  let posY = 24;

  if (isLaptopOrDesktop) {
    // ON LAPTOPS AND DESKTOP:
    // Scale up to comfortably fill available screen real estate without overflowing
    const availableWidth = Math.max(300, viewportWidth - (showUI ? 48 : 28));
    const availableHeight = Math.max(200, viewportHeight - (showUI ? 36 : 24));

    const scaleX = (availableWidth / cardWidth) * 0.98;
    const scaleY = cardHeight > 0 ? (availableHeight / cardHeight) * 0.98 : 1;

    if (cardHeight > 0 && cardHeight * scaleX <= availableHeight) {
      // Entire score/page fits vertically within screen when scaled to width
      scale = Math.min(1.85, Math.max(1.0, scaleX));
    } else if (scaleY >= 1.0) {
      // Fits vertically at 1.0+
      scale = Math.min(1.85, Math.min(scaleX, scaleY));
    } else {
      // Tall chart/sheet with many lines: scale up for bold readability while enabling smooth vertical pan/scroll
      scale = Math.min(1.45, Math.max(1.0, scaleX * 0.92));
    }

    const scaledWidth = cardWidth * scale;
    // Exactly center horizontally
    posX = Math.max(0, (viewportWidth - scaledWidth) / 2);
    posY = topPadding !== undefined ? topPadding : (showUI ? 12 : 8);
  } else if (isPhoneRotate) {
    // IN PHONE ROTATE / LANDSCAPE MODE:
    const availableWidth = Math.max(260, viewportWidth - 24);
    const availableHeight = Math.max(160, viewportHeight - 16);
    const scaleX = (availableWidth / cardWidth) * 0.98;
    const scaleY = cardHeight > 0 ? (availableHeight / cardHeight) * 0.98 : 1;
    scale = Math.min(1, scaleX, scaleY);

    const scaledWidth = cardWidth * scale;
    const scaledHeight = cardHeight * scale;
    posX = Math.max(0, (viewportWidth - scaledWidth) / 2);
    posY = scaledHeight < viewportHeight ? Math.max(0, (viewportHeight - scaledHeight) / 2) : 16;
  } else {
    // IN PORTRAIT PHONE / SMALL TABLET:
    const availableWidth = Math.max(260, viewportWidth - 24);
    if (availableWidth < cardWidth) {
      scale = Math.max(0.15, (availableWidth / cardWidth) * 0.98);
    } else {
      scale = 1;
    }

    const scaledWidth = cardWidth * scale;
    const scaledHeight = cardHeight * scale;
    posX = Math.max(0, (viewportWidth - scaledWidth) / 2);
    posY = scaledHeight < viewportHeight ? Math.max(0, (viewportHeight - scaledHeight) / 2) : 24;
  }

  // Allow zooming out comfortably
  const effectiveMinScale = isLaptopOrDesktop ? Math.min(0.5, scale * 0.7) : (isPhoneRotate ? 0.1 : scale);

  return { scale, posX, posY, effectiveMinScale };
}
