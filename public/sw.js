// Service worker: receives push notifications from the portal and opens the
// right page when one is tapped. Kept deliberately tiny — no offline caching.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Creator Portal";
  event.waitUntil(
    Promise.all([
      updateBadge(data.badge),
      self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag || undefined,
        data: { url: data.url || "/" },
      }),
    ])
  );
});

// The red number on the home-screen icon: how many things are waiting.
function updateBadge(count) {
  try {
    if (typeof count !== "number" || count < 0 || !self.navigator.setAppBadge) return Promise.resolve();
    return (count === 0 ? self.navigator.clearAppBadge() : self.navigator.setAppBadge(count)).catch(() => {});
  } catch (e) {
    return Promise.resolve();
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
