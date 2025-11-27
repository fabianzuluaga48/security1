// Popup Logic

function updateUI() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const currentTabId = currentTab.id;

    chrome.storage.local.get(['networkRequests', 'cookies', 'geolocationAttempts', 'fingerprintingAttempts', 'formData'], (result) => {
      const filterByTab = (arr) => (arr || []).filter(item => item.tabId === currentTabId);

      const requests = filterByTab(result.networkRequests);
      const cookies = filterByTab(result.cookies);
      const geoAttempts = filterByTab(result.geolocationAttempts);
      const fingerprinting = filterByTab(result.fingerprintingAttempts);
      const formData = filterByTab(result.formData);

      document.getElementById('network-count').textContent = requests.length;
      document.getElementById('cookie-count').textContent = cookies.length;

      const geoCount = geoAttempts.length;
      const geoEl = document.getElementById('geo-count');
      geoEl.textContent = geoCount;
      if (geoCount > 0) geoEl.classList.add('alert');
      else geoEl.classList.remove('alert');

      document.getElementById('form-count').textContent = formData.length;

      updateTips({
        networkRequests: requests,
        cookies: cookies,
        geolocationAttempts: geoAttempts,
        fingerprintingAttempts: fingerprinting,
        formData: formData,
        currentUrl: currentTab.url
      });
    });
  });
}

function updateTips(data) {
  const tipsContainer = document.getElementById('tips-container');
  const tipsList = document.getElementById('tips-list');
  tipsList.innerHTML = '';
  let tips = [];

  // 1. Fingerprinting
  if ((data.fingerprintingAttempts || []).length > 0) {
    tips.push("⚠️ Canvas Fingerprinting detected! This site may be trying to identify your device hardware to track you without cookies.");
  }

  // 2. Insecure HTTP
  if (data.currentUrl && data.currentUrl.startsWith('http:')) {
    tips.push("⚠️ You are browsing on an insecure connection (HTTP). Your data is not encrypted and can be intercepted.");
  }

  // 3. Specific Trackers
  const knownTrackers = {
    'google-analytics.com': 'Google Analytics',
    'facebook.net': 'Facebook Pixel',
    'doubleclick.net': 'Google Ads',
    'amazon-adsystem.com': 'Amazon Ads',
    'criteo.com': 'Criteo Tracking',
    'hotjar.com': 'Hotjar Recording'
  };

  const foundTrackers = new Set();
  (data.networkRequests || []).forEach(req => {
    try {
      const hostname = new URL(req.url).hostname;
      for (const [domain, name] of Object.entries(knownTrackers)) {
        if (hostname.includes(domain)) {
          foundTrackers.add(name);
        }
      }
    } catch (e) { }
  });

  if (foundTrackers.size > 0) {
    const trackerNames = Array.from(foundTrackers).join(', ');
    tips.push('Major trackers detected: ' + trackerNames + '. These companies build profiles of your browsing habits.');
  }

  // 4. Existing Checks
  const cookies = data.cookies || [];
  const thirdPartyCookies = cookies.filter(c => c.isThirdParty).length;

  if (thirdPartyCookies > 0) {
    tips.push(`Found ${thirdPartyCookies} third - party cookies.These allow advertisers to follow you from site to site.`);
  }

  if ((data.geolocationAttempts || []).length > 0) {
    tips.push("Location Accessed: This site knows your precise physical location.");
  }

  if ((data.formData || []).length > 0) {
    tips.push("Form Monitoring: The site is watching what you type in forms.");
  }

  if ((data.networkRequests || []).length > 50) {
    tips.push("High background activity detected. This can indicate analytics or tracking scripts running in the background.");
  }

  if (tips.length > 0) {
    tipsContainer.style.display = 'block';
    tips.forEach(tip => {
      const li = document.createElement('li');
      li.textContent = tip;
      tipsList.appendChild(li);
    });
  } else {
    tipsContainer.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateUI();

  // Auto-refresh every second
  setInterval(updateUI, 1000);

  document.getElementById('clear-btn').addEventListener('click', () => {
    chrome.storage.local.clear(() => {
      updateUI();
    });
  });

  document.getElementById('report-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'report.html' });
  });
});
