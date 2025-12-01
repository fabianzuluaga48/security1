// Report Page Logic

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
    "clarity.ms": { "name": "Microsoft Clarity", "category": "analytics" },
    "omtrdc.net": { "name": "Adobe Analytics", "category": "analytics" },

    // Social

    "facebook.net": { "name": "Facebook Pixel", "category": "social" },
    "facebook.com": { "name": "Facebook", "category": "social" },
    "px.ads.linkedin.com": { "name": "LinkedIn Insight Tag", "category": "social" },
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
    "outbrain.com": { "name": "Outbrain", "category": "advertising" }
  };
  
  function getTrackerCategory(domain) {
    for (const [trackerDomain, info] of Object.entries(KNOWN_TRACKERS)) {
      if (domain.includes(trackerDomain)) {
        return info.category;
      }
    }
    return 'unknown';
  }
  
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
  
  function renderTrackerRows(trackerArray, containerId, limit = null) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
  
    if (trackerArray.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔒</div>
          <h3>No Trackers Detected Yet</h3>
          <p>Browse some websites and check back to see tracking activity.</p>
        </div>
      `;
      return;
    }
  
    const displayTrackers = limit ? trackerArray.slice(0, limit) : trackerArray;
  
    displayTrackers.forEach(tracker => {
      const category = getTrackerCategory(tracker.domain);
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `
        <span class="tracker-name">${tracker.domain}</span>
        <span class="tracker-category ${category}">${category}</span>
        <span class="tracker-count">${tracker.sites}</span>
      `;
      container.appendChild(row);
    });
  }
  
  function loadData() {
    chrome.storage.local.get(['globalStats'], (result) => {
      const stats = result.globalStats || { 
        trackers: {}, 
        websitesVisited: [], 
        totalRequests: 0, 
        totalCookies: 0 
      };
      
      const trackers = stats.trackers;
  
      // Convert to array and sort by sites reached
      const trackerArray = Object.keys(trackers).map(domain => ({
        domain: domain,
        count: trackers[domain].count,
        sites: trackers[domain].sites.length,
        isKnown: trackers[domain].isKnown || false
      })).sort((a, b) => b.sites - a.sites);
  
      // Total unique trackers
      const totalTrackers = trackerArray.length;
      document.getElementById('total-trackers').textContent = formatNumber(totalTrackers);
  
      // Websites with trackers percentage
      const totalSites = stats.websitesVisited.length;
      const sitesWithTrackers = new Set();
      Object.values(trackers).forEach(t => {
        t.sites.forEach(site => sitesWithTrackers.add(site));
      });
      const percentage = totalSites > 0 
        ? Math.round((sitesWithTrackers.size / totalSites) * 100) 
        : 0;
      document.getElementById('websites-tracked').textContent = `${percentage}%`;
  
      // Total requests
      document.getElementById('total-requests').textContent = formatNumber(stats.totalRequests || 0);
  
      // Top tracker
      if (trackerArray.length > 0) {
        const top = trackerArray[0];
        document.getElementById('top-tracker').textContent = top.domain;
        document.getElementById('top-tracker-desc').textContent = 
          `seen across ${top.sites} website${top.sites === 1 ? '' : 's'}`;
      } else {
        document.getElementById('top-tracker').textContent = 'None yet';
        document.getElementById('top-tracker-desc').textContent = 'seen across 0 websites';
      }
  
      // Render tracker lists
      renderTrackerRows(trackerArray, 'tracker-rows', 10);
      renderTrackerRows(trackerArray, 'all-tracker-rows');
    });
  }
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active to clicked tab
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Clear all data
  document.getElementById('clear-all-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all tracking data? This cannot be undone.')) {
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
      }, () => {
        loadData();
      });
    }
  });
  
  // Initial load
  document.addEventListener('DOMContentLoaded', loadData);
  
  // Auto-refresh every 5 seconds
  setInterval(loadData, 5000);
  