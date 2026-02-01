/**
 * OAuth Service
 * Manages OAuth popup windows and callback handling
 */

/**
 * Open an OAuth authorization popup window
 * @param {string} authUrl - The OAuth authorization URL
 * @param {string} platform - Platform name (for window title)
 * @returns {Window} - The popup window object
 */
export function openOAuthPopup(authUrl, platform) {
  // Popup dimensions
  const width = 600;
  const height = 700;

  // Center the popup on the screen
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;

  // Popup window features
  const features = `width=${width},height=${height},left=${left},top=${top},` +
    `toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,` +
    `popup=yes`;

  // Open popup window
  const popup = window.open(authUrl, `${platform}_oauth`, features);

  // Check if popup was blocked
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    throw new Error(
      'Popup blocked. Please allow popups for this site and try again.'
    );
  }

  // Focus the popup
  popup.focus();

  return popup;
}

/**
 * Wait for OAuth callback to complete (popup to close)
 * @param {Window} popup - The popup window object
 * @param {number} checkInterval - Interval to check if popup closed (ms)
 * @returns {Promise<void>} - Resolves when popup closes
 */
export function waitForCallback(popup, checkInterval = 500) {
  return new Promise((resolve, reject) => {
    // Check if popup is closed every checkInterval ms
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        resolve();
      }
    }, checkInterval);

    // Timeout after 5 minutes (user might have abandoned flow)
    setTimeout(() => {
      clearInterval(timer);
      if (popup && !popup.closed) {
        popup.close();
      }
      reject(new Error('OAuth flow timed out'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Complete OAuth flow: open popup, wait for callback
 * @param {string} authUrl - The OAuth authorization URL
 * @param {string} platform - Platform name
 * @returns {Promise<void>} - Resolves when OAuth flow completes
 */
export async function startOAuthFlow(authUrl, platform) {
  const popup = openOAuthPopup(authUrl, platform);
  await waitForCallback(popup);
}
