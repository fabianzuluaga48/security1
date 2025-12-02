const KNOWN_TRACKERS = {
    // Analystics
    "statcounter.com": { "name": "StatCounter", "category": "analytics" },
    "matomo.org": { "name": "Matomo", "category": "analytics" },
    "snowplowanalytics.com": { "name": "Snowplow", "category": "analytics" },
    "kissmetrics.com": { "name": "Kissmetrics", "category": "analytics" },
    "heap.io": { "name": "Heap Analytics", "category": "analytics" },
    "fullstory.com": { "name": "FullStory", "category": "analytics" },
    "mouseflow.com": { "name": "Mouseflow", "category": "analytics" },
    "smartlook.com": { "name": "Smartlook", "category": "analytics" },
    "google-analytics.com": { "name": "Google Analytics", "category": "analytics" },
    "googletagmanager.com": { "name": "Google Tag Manager", "category": "analytics" },
    "hotjar.com": { "name": "Hotjar", "category": "analytics" },
    "mixpanel.com": { "name": "Mixpanel", "category": "analytics" },
    "segment.io": { "name": "Segment", "category": "analytics" },
    "segment.com": { "name": 'Segment', "category": "analytics" },
    "clarity.ms": { "name": "Microsoft Clarity", "category": "analytics" },
    "omtrdc.net": { "name": "Adobe Analytics", "category": "analytics" },
    "quantserve.com": { "name": "Quantcast", "category": "analytics" },
    "newrelic.com": { "name": "New Relic", "category": "analytics" },
    "sentry.io": { "name": "Sentry", "category": "analytics" },
    "crazyegg.com": { "name": "Crazy Egg", "category": "analytics" },

    // Social

    "facebook.net": { "name": "Facebook Pixel", "category": "social" },
    "facebook.com": { "name": "Facebook", "category": "social" },
    "linkedin.com": { "name": "LinkedIn Insight Tag", "category": "social" },
    "twitter.com": { "name": "Twitter/X Pixel", "category": "social" },
    "tiktok.com": { "name": "TikTok Pixel", "category": "social" },
    "snapchat.com": { "name": "Snapchat Pixel", "category": "social" },
    "pinterest.com": { "name": "Pinterest Tag", "category": "social" },
    "reddit.com": { "name": "Reddit Pixel", "category": "social" },

    // Advertising

    "doubleclick.net": { "name": "Google Ads", "category": "advertising" },
    "googlesyndication.com": { "name": "Google Ads", "category": "advertising" },
    "amazon-adsystem.com": { "name": "Amazon Ads", "category": "advertising" },
    "criteo.com": { "name": "Criteo", "category": "advertising" },
    "adsrvr.org": { "name": "The Trade Desk", "category": "advertising" },
    "taboola.com": { "name": "Taboola", "category": "advertising" },
    "outbrain.com": { "name": "Outbrain", "category": "advertising" },
    "bing.com": { "name": "Bing Ads", "category": "advertising" },
};

// List of white-listed domains that should not be detected as trackers.
const WHITE_LIST = [
    "fonts.gstatic.com",
    "www.gstatic.com",
    "github.githubassets.com",
]

function getTrackerInfo(hostname) {
  for (const [domain, info] of Object.entries(KNOWN_TRACKERS)) {
    if (hostname.includes(domain)) {
      return { domain, ...info };
    }
  }
  return null;
}

function getTrackerCategory(domain) {
    for (const [trackerDomain, info] of Object.entries(KNOWN_TRACKERS)) {
      if (domain.includes(trackerDomain)) {
        return info.category;
      }
    }
    return 'unknown';
  }

export { getTrackerInfo, getTrackerCategory, WHITE_LIST };
