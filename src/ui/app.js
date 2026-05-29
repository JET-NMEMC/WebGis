/**
 * App — main entry point.
 * Initializes all modules and Leaflet control plugins (Contour, Importer, Exporter).
 */
(function () {
  'use strict';

  var state = WGIS.state;

  // =========================================================================
  // Initialize once map is ready
  // =========================================================================
  function init() {
    WGIS.uiInit();

    L.control.contour({ position: 'topleft' }).addTo(state.map);
    L.control.importer({ position: 'topleft' }).addTo(state.map);
    L.control.exporter({ position: 'topleft' }).addTo(state.map);
  }

  // =========================================================================
  // Bootstrap
  // =========================================================================
  function bootstrap() {
    console.log('[WGIS] bootstrap, map=' + !!WGIS.state.map);
    if (WGIS.state.map) {
      try { init(); console.log('[WGIS] init OK'); }
      catch (e) { console.error('[WGIS] init error:', e.message, e.stack); }
    } else {
      var retries = 0;
      var checkReady = setInterval(function () {
        if (WGIS.state.map) {
          clearInterval(checkReady);
          try { init(); console.log('[WGIS] init OK (delayed)'); }
          catch (e) { console.error('[WGIS] init error (delayed):', e.message, e.stack); }
        }
        if (++retries > 50) { clearInterval(checkReady); console.error('[WGIS] Map timeout'); }
      }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
