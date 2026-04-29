const gaMeasurementId = import.meta.env?.VITE_GA_MEASUREMENT_ID || "";

function isValidGaMeasurementId(value) {
  return /^G-[A-Z0-9]+$/i.test(value);
}

export function initGoogleAnalytics() {
  if (typeof window === "undefined" || !isValidGaMeasurementId(gaMeasurementId)) {
    return;
  }

  if (window.__sipGoogleAnalyticsReady) {
    return;
  }

  window.__sipGoogleAnalyticsReady = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", gaMeasurementId, {
    page_title: document.title,
    page_location: window.location.href,
    send_page_view: true,
  });
}

export function trackAnalyticsEvent(eventName, params = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, params);
}
