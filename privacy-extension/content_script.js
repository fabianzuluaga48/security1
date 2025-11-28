// Content Script (Runs in ISOLATED world)
// Bridges between page context and extension background

(function() {
  'use strict';

  // ============================================
  // MESSAGE LISTENER FROM INJECTED HOOKS
  // ============================================
  
  window.addEventListener('message', (event) => {
    // Only accept messages from our own window
    if (event.source !== window) return;
    
    // Verify it's from our extension
    if (event.data.source !== 'privacy-origin-extension') return;
    
    // Forward to background script
    if (event.data.type === 'PRIVACY_EXT_GEO') {
      safelySendMessage({ 
        type: 'GEOLOCATION_ATTEMPT',
        method: event.data.method 
      });
    } else if (event.data.type === 'PRIVACY_EXT_FINGERPRINT') {
      safelySendMessage({ 
        type: 'FINGERPRINTING_ATTEMPT', 
        method: event.data.method,
        detail: event.data.detail
      });
    }
  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  function safelySendMessage(message) {
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage(message);
      }
    } catch (e) {
      // Extension context may be invalidated (e.g., during reload)
    }
  }

  // Debounce utility
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ============================================
  // FORM MONITORING
  // ============================================
  
  // Sensitive field types to track more carefully
  const SENSITIVE_FIELDS = [
    'password', 'email', 'tel', 'ssn', 'credit-card', 
    'cc-number', 'cc-exp', 'cc-csc', 'address', 'postal-code'
  ];

  function getFieldType(input) {
    const type = input.type?.toLowerCase() || 'text';
    const name = input.name?.toLowerCase() || '';
    const autocomplete = input.autocomplete?.toLowerCase() || '';
    
    // Check for sensitive autocomplete values
    for (const sensitive of SENSITIVE_FIELDS) {
      if (autocomplete.includes(sensitive) || name.includes(sensitive.replace('-', ''))) {
        return sensitive;
      }
    }
    
    return type;
  }

  // Track form submissions
  document.addEventListener('submit', (e) => {
    const form = e.target;
    const inputCount = form.querySelectorAll('input, textarea, select').length;
    
    safelySendMessage({ 
      type: 'FORM_SUBMISSION', 
      action: 'submit',
      fieldCount: inputCount
    });
  }, true);

  // Track input interactions (debounced per form)
  const formInputTrackers = new WeakMap();
  
  document.addEventListener('input', (e) => {
    const target = e.target;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    
    // Find parent form or use document as key
    const form = target.closest('form') || document;
    
    // Get or create debounced tracker for this form
    if (!formInputTrackers.has(form)) {
      formInputTrackers.set(form, debounce(() => {
        const fieldType = getFieldType(target);
        safelySendMessage({ 
          type: 'FORM_SUBMISSION', 
          action: 'input',
          fieldType: fieldType
        });
      }, 2000));
    }
    
    formInputTrackers.get(form)();
  }, true);

  // ============================================
  // DETECT HIDDEN FORMS/INPUTS (potential tracking)
  // ============================================
  
  // Check for hidden iframes that might be tracking pixels
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check for 1x1 tracking iframes
          if (node.tagName === 'IFRAME') {
            const rect = node.getBoundingClientRect();
            if (rect.width <= 1 && rect.height <= 1) {
              // This is likely a tracking pixel
              // We already capture this via network requests, so just noting here
            }
          }
        }
      });
    });
  });

  // Start observing after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
  }

})();
