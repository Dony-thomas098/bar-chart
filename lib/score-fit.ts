export interface FitOptions {
  viewportWidth: number;
  viewportHeight: number;
  cardWidth: number;
  cardHeight: number;
  showUI?: boolean;
  topPadding?: number;
  bottomPadding?: number;
  isLocked?: boolean;
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
  bottomPadding,
  isLocked = false,
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
  const topOffset = topPadding !== undefined ? topPadding : (showUI ? 12 : 8);
  const bottomOffset = bottomPadding !== undefined ? bottomPadding : (showUI ? 24 : 16);
  let posY = topOffset;

  if (isLaptopOrDesktop) {
    // ON LAPTOPS AND DESKTOP:
    // Scale up to comfortably fill available screen real estate without overflowing
    const availableWidth = Math.max(300, viewportWidth - (showUI ? 48 : 28));
    const availableHeight = Math.max(160, viewportHeight - topOffset - bottomOffset);

    const scaleX = (availableWidth / cardWidth) * 0.98;
    const scaleY = cardHeight > 0 ? (availableHeight / cardHeight) * 0.98 : 1;

    const minScaleYDesktop = bottomPadding !== undefined ? 0.2 : 0.4;
    if (cardHeight > 0 && cardHeight * scaleX <= availableHeight) {
      // Entire score/page fits vertically when scaled to available width.
      scale = Math.min(1.85, Math.max(0.15, scaleX));
    } else if (scaleY >= minScaleYDesktop) {
      // Fits vertically and horizontally across tablet and desktop viewports
      scale = Math.min(1.85, Math.min(scaleX, scaleY));
    } else {
      // Tall chart: scale to available width for readability; allow below 1.0 for wide charts.
      scale = Math.min(1.45, Math.max(0.15, scaleX * 0.92));
    }

    const scaledWidth = cardWidth * scale;
    const scaledHeight = cardHeight * scale;
    // Exactly center horizontally
    posX = Math.max(0, (viewportWidth - scaledWidth) / 2);
    // Center vertically in available space
    if (bottomPadding !== undefined) {
      const remainingY = viewportHeight - topOffset - bottomOffset - scaledHeight;
      posY = remainingY > 0 ? topOffset + remainingY / 2 : topOffset;
    } else {
      posY = scaledHeight < viewportHeight
        ? Math.max(topOffset, (viewportHeight - scaledHeight) / 2)
        : topOffset;
    }
  } else if (isPhoneRotate) {
    // IN PHONE ROTATE / LANDSCAPE MODE:
    const availableWidth = Math.max(260, viewportWidth - 24);
    const availableHeight = Math.max(140, viewportHeight - topOffset - bottomOffset);
    const scaleX = (availableWidth / cardWidth) * 0.98;
    const scaleY = cardHeight > 0 ? (availableHeight / cardHeight) * 0.98 : 1;
    scale = Math.min(1, scaleX, scaleY);

    const scaledWidth = cardWidth * scale;
    const scaledHeight = cardHeight * scale;
    posX = Math.max(0, (viewportWidth - scaledWidth) / 2);
    if (bottomPadding !== undefined) {
      const remainingY = viewportHeight - topOffset - bottomOffset - scaledHeight;
      posY = remainingY > 0 ? topOffset + remainingY / 2 : topOffset;
    } else {
      posY = scaledHeight < viewportHeight
        ? Math.max(topOffset, (viewportHeight - scaledHeight) / 2)
        : topOffset;
    }
  } else {
    // IN PORTRAIT PHONE / SMALL TABLET:
    const availableWidth = Math.max(260, viewportWidth - 24);
    const availableHeight = Math.max(160, viewportHeight - topOffset - bottomOffset);
    const scaleX = (availableWidth / cardWidth) * 0.98;
    const scaleY = cardHeight > 0 ? (availableHeight / cardHeight) * 0.98 : 1;

    const minScaleYThreshold = bottomPadding !== undefined ? 0.2 : 0.45;
    if (cardHeight > 0 && cardHeight * scaleX <= availableHeight) {
      scale = Math.min(1.2, Math.max(0.15, scaleX));
    } else if (scaleY >= minScaleYThreshold) {
      scale = Math.min(1.2, Math.min(scaleX, scaleY));
    } else {
      scale = Math.min(1.0, Math.max(0.15, scaleX));
    }

    const scaledWidth = cardWidth * scale;
    const scaledHeight = cardHeight * scale;
    posX = Math.max(0, (viewportWidth - scaledWidth) / 2);
    // Center vertically in available space
    if (bottomPadding !== undefined) {
      const remainingY = viewportHeight - topOffset - bottomOffset - scaledHeight;
      posY = remainingY > 0 ? topOffset + remainingY / 2 : topOffset;
    } else {
      posY = scaledHeight < viewportHeight
        ? Math.max(topOffset, (viewportHeight - scaledHeight) / 2)
        : topOffset;
    }
  }

  // Allow zooming out comfortably
  const effectiveMinScale = isLaptopOrDesktop ? Math.min(0.5, scale * 0.7) : (isPhoneRotate ? 0.1 : scale);

  return { scale, posX, posY, effectiveMinScale };
}
