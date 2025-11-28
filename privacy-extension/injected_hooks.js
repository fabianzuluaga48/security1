// Injected Hooks (Runs in MAIN world - page context)
// This script hooks into browser APIs to detect privacy-sensitive operations

(function() {
    'use strict';
    
    // Guard against re-injection
    if (window.__privacy_origin_hooked) return;
    window.__privacy_origin_hooked = true;
  
    // Helper to safely post messages
    function notifyExtension(type, data = {}) {
      try {
        window.postMessage({ 
          type: type, 
          source: 'privacy-origin-extension',
          ...data 
        }, '*');
      } catch (e) {
        // Silently fail if messaging doesn't work
      }
    }
  
    // ============================================
    // GEOLOCATION HOOKS
    // ============================================
    
    if (navigator.geolocation) {
      const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
      const originalWatchPosition = navigator.geolocation.watchPosition;
  
      navigator.geolocation.getCurrentPosition = function(success, error, options) {
        notifyExtension('PRIVACY_EXT_GEO', { method: 'getCurrentPosition' });
        return originalGetCurrentPosition.apply(this, arguments);
      };
  
      navigator.geolocation.watchPosition = function(success, error, options) {
        notifyExtension('PRIVACY_EXT_GEO', { method: 'watchPosition' });
        return originalWatchPosition.apply(this, arguments);
      };
    }
  
    // ============================================
    // CANVAS FINGERPRINTING HOOKS
    // ============================================
    
    // Track canvas operations to detect fingerprinting patterns
    const canvasReadCount = new WeakMap();
    
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      // Only notify if the canvas has content (size > 0)
      if (this.width > 0 && this.height > 0) {
        const count = (canvasReadCount.get(this) || 0) + 1;
        canvasReadCount.set(this, count);
        
        // Only report first few reads per canvas to reduce noise
        if (count <= 3) {
          notifyExtension('PRIVACY_EXT_FINGERPRINT', { 
            method: 'canvas.toDataURL',
            canvasSize: `${this.width}x${this.height}`
          });
        }
      }
      return originalToDataURL.apply(this, arguments);
    };
  
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function() {
      const canvas = this.canvas;
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const count = (canvasReadCount.get(canvas) || 0) + 1;
        canvasReadCount.set(canvas, count);
        
        if (count <= 3) {
          notifyExtension('PRIVACY_EXT_FINGERPRINT', { 
            method: 'canvas.getImageData',
            canvasSize: `${canvas.width}x${canvas.height}`
          });
        }
      }
      return originalGetImageData.apply(this, arguments);
    };
  
    // ============================================
    // WEBGL FINGERPRINTING HOOKS
    // ============================================
    
    // WebGL can be used to fingerprint GPU/driver info
    const webglMethods = ['getParameter', 'getSupportedExtensions', 'getExtension'];
    const webglContexts = [WebGLRenderingContext];
    
    if (typeof WebGL2RenderingContext !== 'undefined') {
      webglContexts.push(WebGL2RenderingContext);
    }
  
    let webglNotified = false;
    
    webglContexts.forEach(ContextClass => {
      const originalGetParameter = ContextClass.prototype.getParameter;
      ContextClass.prototype.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL = 37445, UNMASKED_RENDERER_WEBGL = 37446
        if (param === 37445 || param === 37446) {
          if (!webglNotified) {
            webglNotified = true;
            notifyExtension('PRIVACY_EXT_FINGERPRINT', { 
              method: 'webgl.getParameter',
              detail: 'GPU info requested'
            });
          }
        }
        return originalGetParameter.apply(this, arguments);
      };
    });
  
    // ============================================
    // AUDIO FINGERPRINTING HOOKS
    // ============================================
    
    let audioNotified = false;
    
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      
      if (AudioContextClass) {
        const originalCreateOscillator = AudioContextClass.prototype.createOscillator;
        const originalCreateDynamicsCompressor = AudioContextClass.prototype.createDynamicsCompressor;
        
        // Audio fingerprinting typically uses oscillator + compressor
        let oscillatorCreated = false;
        let compressorCreated = false;
        
        AudioContextClass.prototype.createOscillator = function() {
          oscillatorCreated = true;
          checkAudioFingerprint();
          return originalCreateOscillator.apply(this, arguments);
        };
        
        AudioContextClass.prototype.createDynamicsCompressor = function() {
          compressorCreated = true;
          checkAudioFingerprint();
          return originalCreateDynamicsCompressor.apply(this, arguments);
        };
        
        function checkAudioFingerprint() {
          if (oscillatorCreated && compressorCreated && !audioNotified) {
            audioNotified = true;
            notifyExtension('PRIVACY_EXT_FINGERPRINT', { 
              method: 'audioContext',
              detail: 'Audio fingerprinting pattern detected'
            });
          }
        }
      }
    }
  
    // ============================================
    // FONT FINGERPRINTING DETECTION
    // ============================================
    
    // Detect excessive font checking (common fingerprinting technique)
    let fontCheckCount = 0;
    let fontNotified = false;
    const FONT_CHECK_THRESHOLD = 50; // Suspicious if checking many fonts
    
    if (document.fonts && document.fonts.check) {
      const originalCheck = document.fonts.check.bind(document.fonts);
      document.fonts.check = function(font, text) {
        fontCheckCount++;
        if (fontCheckCount > FONT_CHECK_THRESHOLD && !fontNotified) {
          fontNotified = true;
          notifyExtension('PRIVACY_EXT_FINGERPRINT', { 
            method: 'fontEnumeration',
            detail: `Checked ${fontCheckCount}+ fonts`
          });
        }
        return originalCheck(font, text);
      };
    }
  
    // ============================================
    // BATTERY API (if available - mostly deprecated)
    // ============================================
    
    if (navigator.getBattery) {
      const originalGetBattery = navigator.getBattery;
      navigator.getBattery = function() {
        notifyExtension('PRIVACY_EXT_FINGERPRINT', { 
          method: 'battery',
          detail: 'Battery status requested'
        });
        return originalGetBattery.apply(this, arguments);
      };
    }
  
    // ============================================
    // SCREEN/WINDOW FINGERPRINTING
    // ============================================
    
    // Note: We don't hook screen properties as they're used too commonly
    // But we could track if multiple properties are accessed in quick succession
  
    console.log('[Privacy Origin] Monitoring hooks active');
  })();
  