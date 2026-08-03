// Access token فقط در حافظه نگه داشته می‌شه (نه localStorage) تا ریسک XSS کمتر بشه.
// Refresh token اصلاً به جاوااسکریپت فرانت دسترسی نداره — در httpOnly cookie است.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
