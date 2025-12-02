// Background Service Worker

import { getTrackerInfo } from './utils.js';

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    networkRequests: [],
    cookies: [],
    geolocationAttempts: [],
    fingerprintingAttempts: [],
    formData: [],
    globalStats: {
      trackers: {},
      websitesVisited: [],
      totalRequests: 0,
      totalCookies: 0
    }
  });
  console.log("Privacy Origin Extension Installed");
});

// Helper to extract root domain
function getRootDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  // Handle common TLDs like co.uk, com.au, etc.
  const knownSecondLevel = ['co', 'com', 'net', 'org', 'gov', 'edu'];
  if (parts.length >= 3 && knownSecondLevel.includes(parts[parts.length - 2])) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

// Helper to update global stats
function updateGlobalStats(trackerDomain, currentSite, isKnownTracker = false) {
  if (!trackerDomain || !currentSite || trackerDomain === currentSite) return;

  chrome.storage.local.get(['globalStats'], (result) => {
    const stats = result.globalStats || { trackers: {}, websitesVisited: [], totalRequests: 0, totalCookies: 0 };

    // Update Tracker Stats
    if (!stats.trackers[trackerDomain]) {
      stats.trackers[trackerDomain] = { 
        count: 0, 
        sites: [],
        isKnown: isKnownTracker,
        firstSeen: Date.now()
      };
    }
    stats.trackers[trackerDomain].count++;
    stats.trackers[trackerDomain].lastSeen = Date.now();
    
    if (!stats.trackers[trackerDomain].sites.includes(currentSite)) {
      stats.trackers[trackerDomain].sites.push(currentSite);
    }

    // Update Websites Visited
    if (!stats.websitesVisited.includes(currentSite)) {
      stats.websitesVisited.push(currentSite);
    }

    chrome.storage.local.set({ globalStats: stats });
  });
}

// Clear data for a tab when it navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    chrome.storage.local.get(['networkRequests', 'cookies', 'geolocationAttempts', 'fingerprintingAttempts', 'formData'], (result) => {
      const clean = (arr) => (arr || []).filter(item => item.tabId !== tabId);

      chrome.storage.local.set({
        networkRequests: clean(result.networkRequests),
        cookies: clean(result.cookies),
        geolocationAttempts: clean(result.geolocationAttempts),
        fingerprintingAttempts: clean(result.fingerprintingAttempts),
        formData: clean(result.formData)
      });
    });
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(['networkRequests', 'cookies', 'geolocationAttempts', 'fingerprintingAttempts', 'formData'], (result) => {
    const clean = (arr) => (arr || []).filter(item => item.tabId !== tabId);

    chrome.storage.local.set({
      networkRequests: clean(result.networkRequests),
      cookies: clean(result.cookies),
      geolocationAttempts: clean(result.geolocationAttempts),
      fingerprintingAttempts: clean(result.fingerprintingAttempts),
      formData: clean(result.formData)
    });
  });
});

// Network Request Monitoring
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId === -1) return; // Ignore background requests

    let trackerHost = null;
    let initiatorHost = null;
    let isThirdParty = false;
    let trackerInfo = null;

    try {
      trackerHost = new URL(details.url).hostname;
      initiatorHost = details.initiator ? new URL(details.initiator).hostname : null;
      
      if (initiatorHost) {
        const trackerRoot = getRootDomain(trackerHost);
        const initiatorRoot = getRootDomain(initiatorHost);
        isThirdParty = trackerRoot !== initiatorRoot;
      }
      
      trackerInfo = getTrackerInfo(trackerHost);
    } catch (e) { }

    const logEntry = {
      url: details.url,
      type: details.type,
      initiator: details.initiator,
      tabId: details.tabId,
      timeStamp: Date.now(),
      isThirdParty,
      trackerInfo: trackerInfo ? {
        name: trackerInfo.name,
        category: trackerInfo.category
      } : null
    };

    // Update global stats for third-party requests
    if (isThirdParty && initiatorHost) {
      updateGlobalStats(trackerHost, initiatorHost, !!trackerInfo);
    }

    // Store in local storage
    chrome.storage.local.get(['networkRequests', 'globalStats'], (result) => {
      const requests = result.networkRequests || [];
      requests.push(logEntry);
      
      // Keep last 500 per-tab requests for performance
      const filtered = requests.slice(-500);
      
      // Update total count
      const stats = result.globalStats || { trackers: {}, websitesVisited: [], totalRequests: 0, totalCookies: 0 };
      stats.totalRequests++;
      
      chrome.storage.local.set({ 
        networkRequests: filtered,
        globalStats: stats
      });
    });
  },
  { urls: ["<all_urls>"] }
);

// Cookie Monitoring
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId === -1) return;

    if (details.responseHeaders) {
      details.responseHeaders.forEach((header) => {
        if (header.name.toLowerCase() === 'set-cookie') {
          let initiatorHost = null;
          let urlHost = null;
          let isThirdParty = false;

          try {
            urlHost = new URL(details.url).hostname;
            initiatorHost = details.initiator ? new URL(details.initiator).hostname : null;
            
            if (initiatorHost) {
              const urlRoot = getRootDomain(urlHost);
              const initiatorRoot = getRootDomain(initiatorHost);
              isThirdParty = urlRoot !== initiatorRoot;
            }
          } catch (e) { }

          // Parse cookie attributes
          const cookieParts = header.value.split(';').map(p => p.trim());
          const cookieNameValue = cookieParts[0];
          const attributes = {};
          
          cookieParts.slice(1).forEach(part => {
            const [key, value] = part.split('=');
            if (key) {
              attributes[key.toLowerCase()] = value || true;
            }
          });

          const logEntry = {
            url: details.url,
            domain: urlHost,
            cookie: cookieNameValue.split('=')[0], // Just the name, not value for privacy
            isThirdParty,
            isSecure: !!attributes.secure,
            isHttpOnly: !!attributes.httponly,
            sameSite: attributes.samesite || 'none specified',
            tabId: details.tabId,
            timeStamp: Date.now()
          };

          if (isThirdParty && initiatorHost) {
            updateGlobalStats(urlHost, initiatorHost, !!getTrackerInfo(urlHost));
          }

          chrome.storage.local.get(['cookies', 'globalStats'], (result) => {
            const cookies = result.cookies || [];
            
            // Avoid duplicates
            const exists = cookies.some(c => 
              c.domain === logEntry.domain && 
              c.cookie === logEntry.cookie && 
              c.tabId === logEntry.tabId
            );
            
            if (!exists) {
              cookies.push(logEntry);
              if (cookies.length > 500) cookies.shift();
              
              const stats = result.globalStats || { trackers: {}, websitesVisited: [], totalRequests: 0, totalCookies: 0 };
              stats.totalCookies++;
              
              chrome.storage.local.set({ 
                cookies: cookies,
                globalStats: stats
              });
            }
          });
        }
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab) return;

  const tabId = sender.tab.id;
  const tabUrl = sender.tab.url;

  if (message.type === 'GEOLOCATION_ATTEMPT') {
    chrome.storage.local.get(['geolocationAttempts'], (result) => {
      const attempts = result.geolocationAttempts || [];
      
      // Debounce: don't log if we logged this tab recently
      const recentAttempt = attempts.find(a => 
        a.tabId === tabId && 
        (Date.now() - a.timeStamp < 5000)
      );
      
      if (!recentAttempt) {
        attempts.push({
          url: tabUrl,
          method: message.method || 'unknown',
          tabId: tabId,
          timeStamp: Date.now()
        });
        chrome.storage.local.set({ geolocationAttempts: attempts });
      }
    });
  } else if (message.type === 'FINGERPRINTING_ATTEMPT') {
    chrome.storage.local.get(['fingerprintingAttempts'], (result) => {
      const attempts = result.fingerprintingAttempts || [];
      
      // Debounce fingerprinting attempts per tab (2 second window)
      const recentAttempt = attempts.find(a => 
        a.tabId === tabId && 
        a.method === message.method &&
        (Date.now() - a.timeStamp < 2000)
      );
      
      if (!recentAttempt) {
        attempts.push({
          url: tabUrl,
          method: message.method,
          tabId: tabId,
          timeStamp: Date.now()
        });
        chrome.storage.local.set({ fingerprintingAttempts: attempts });
      }
    });
  } else if (message.type === 'FORM_SUBMISSION') {
    chrome.storage.local.get(['formData'], (result) => {
      const data = result.formData || [];
      
      // For 'input' actions, debounce more aggressively (5 seconds)
      if (message.action === 'input') {
        const recentInput = data.find(d => 
          d.tabId === tabId && 
          d.action === 'input' &&
          (Date.now() - d.timeStamp < 5000)
        );
        if (recentInput) return;
      }
      
      data.push({
        url: tabUrl,
        action: message.action,
        fieldType: message.fieldType || 'unknown',
        tabId: tabId,
        timeStamp: Date.now()
      });
      
      if (data.length > 200) data.shift();
      chrome.storage.local.set({ formData: data });
    });
  }
});

// Export tracker info for other scripts
self.KNOWN_TRACKERS = KNOWN_TRACKERS;
