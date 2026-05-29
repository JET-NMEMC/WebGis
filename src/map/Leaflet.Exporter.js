/**
 * Leaflet.Exporter — export map layers to Shapefile, KML, or GeoJSON.
 *
 * Usage:
 *   L.control.exporter({ position: 'topleft' }).addTo(map);
 *
 * Lists all user-added overlay layers with checkboxes, lets the user pick
 * an export format (SHP/KML/GeoJSON), and downloads the selected layers.
 *
 * Dependencies: Leaflet 1.x, WGIS namespace, GeoShape.js, Tokml.js
 */
(function () {
  'use strict';

  // =========================================================================
  // L.Control.Exporter
  // =========================================================================
  L.Control.Exporter = L.Control.extend({
    options: {
      position: 'topleft',
      title: '↑ 导出'
    },

    // =======================================================================
    // Export utilities (merged from core/exporter.js)
    // =======================================================================
    _layerToFeature: function (layer) {
      var geojson = layer.toGeoJSON();
      if (layer.options && layer.options.attribute) {
        geojson.properties = layer.options.attribute;
      }
      return geojson;
    },

    _doExport: function (collection, fileType) {
      switch (fileType) {
        case 'shp':
          GeoShape.transformAndDownload(collection);
          break;
        case 'kml':
          WGIS.createAndDownloadFile('kmlnew.kml', tokml(collection, {
            name: 'name',
            description: 'description'
          }));
          break;
        case 'json':
          WGIS.createAndDownloadFile('kmlnew.json', JSON.stringify(collection));
          break;
        default:
          WGIS.msg('不支持的导出格式');
      }
    },

    _exportSelectedFeatures: function (mapInstance, layers, fileType) {
      var collection = {
        type: 'FeatureCollection',
        features: []
      };

      for (var i = 0; i < layers.length; i++) {
        if (!mapInstance.hasLayer(layers[i])) { continue; }
        if (WGIS.isExportable(layers[i])) {
          collection.features.push(this._layerToFeature(layers[i]));
        }
      }

      if (collection.features.length === 0) {
        WGIS.msg('没有可导出的要素');
        return;
      }

      this._doExport(collection, fileType);
    },

    initialize: function (options) {
      L.setOptions(this, options);
      this._panel = null;
      this._panelVisible = false;
      this._map = null;
    },

    onAdd: function (map) {
      this._map = map;

      var btn = L.DomUtil.create('a', 'leaflet-exporter-button');
      btn.href = '#';
      btn.title = this.options.title;
      btn.innerHTML = '⤒';
      L.DomEvent.on(btn, 'click', this._togglePanel, this);
      L.DomEvent.disableClickPropagation(btn);
      this._btn = btn;

      this._panel = this._buildPanel();
      L.DomEvent.disableClickPropagation(this._panel);

      return btn;
    },

    onRemove: function (map) {
      if (this._panel && this._panel.parentNode) {
        this._panel.parentNode.removeChild(this._panel);
      }
      this._map = null;
    },

    // =======================================================================
    // Panel construction
    // =======================================================================
    _buildPanel: function () {
      var self = this;
      var panel = L.DomUtil.create('div', 'leaflet-exporter-panel');

      // Header
      var header = L.DomUtil.create('div', 'le-header', panel);
      header.textContent = '数据导出';
      var closeBtn = L.DomUtil.create('button', 'le-close', header);
      closeBtn.innerHTML = '&times;';
      L.DomEvent.on(closeBtn, 'click', this._hidePanel, this);

      var body = L.DomUtil.create('div', 'le-body', panel);

      // Format selector
      var sec1 = L.DomUtil.create('div', 'le-section', body);
      L.DomUtil.create('div', 'le-section-title', sec1).textContent = '导出格式';
      var formatSelect = L.DomUtil.create('select', 'le-select', sec1);
      L.DomUtil.create('option', '', formatSelect).textContent = 'Shapefile (SHP)';
      L.DomUtil.create('option', '', formatSelect).textContent = 'KML';
      L.DomUtil.create('option', '', formatSelect).textContent = 'GeoJSON (JSON)';
      formatSelect.options[0].value = 'shp';
      formatSelect.options[1].value = 'kml';
      formatSelect.options[2].value = 'json';
      this._formatSelect = formatSelect;

      // Layer list
      var sec2 = L.DomUtil.create('div', 'le-section', body);
      L.DomUtil.create('div', 'le-section-title', sec2).textContent = '选择图层';
      var layerList = L.DomUtil.create('div', 'le-layer-list', sec2);
      this._layerList = layerList;

      // Status
      var statusEl = L.DomUtil.create('div', 'le-status', body);
      this._statusEl = statusEl;

      // Export button
      var exportBtn = L.DomUtil.create('button', 'le-btn le-btn-primary', body);
      exportBtn.textContent = '导出选中图层';
      L.DomEvent.on(exportBtn, 'click', this._onExport, this);

      return panel;
    },

    // =======================================================================
    // Panel visibility
    // =======================================================================
    _togglePanel: function (e) {
      L.DomEvent.preventDefault(e);
      if (this._panelVisible) {
        this._hidePanel();
      } else {
        this._showPanel();
      }
    },

    _showPanel: function () {
      if (!this._panel || !this._btn) { return; }
      if (!this._panel.parentNode) {
        this._btn.parentNode.insertBefore(this._panel, this._btn.nextSibling);
      }
      this._refreshLayerList();
      var btnRect = this._btn.getBoundingClientRect();
      this._panel.style.left = (btnRect.right + 4) + 'px';
      this._panel.style.top = btnRect.top + 'px';
      this._panel.style.display = 'block';
      this._panelVisible = true;
    },

    _hidePanel: function () {
      if (!this._panel) { return; }
      this._panel.style.display = 'none';
      this._panelVisible = false;
    },

    // =======================================================================
    // Layer listing
    // =======================================================================
    _collectExportableLayers: function () {
      var result = [];
      var map = this._map;

      // Collect layers from layerControl2
      var lc2 = WGIS.state.layerControl2;
      if (lc2 && lc2._layers) {
        for (var key in lc2._layers) {
          if (!lc2._layers.hasOwnProperty(key)) { continue; }
          var entry = lc2._layers[key];
          var layer = entry.layer;
          var name = entry.name;

          if (!layer) { continue; }
          if (layer instanceof L.TileLayer) { continue; }

          if (layer instanceof L.FeatureGroup || layer instanceof L.LayerGroup) {
            if (WGIS.hasExportableChildren(layer)) {
              result.push({ layer: layer, name: name || '未命名图层组', isGroup: true });
            }
          } else if (WGIS.isExportable(layer)) {
            result.push({ layer: layer, name: name || '未命名图层', isGroup: false });
          }
        }
      }

      return result;
    },

    _refreshLayerList: function () {
      if (!this._layerList) { return; }
      this._layerList.innerHTML = '';

      var layers = this._collectExportableLayers();
      this._exportableLayers = layers;

      if (layers.length === 0) {
        var empty = L.DomUtil.create('div', '', this._layerList);
        empty.style.cssText = 'color:#999;font-style:italic;padding:4px;';
        empty.textContent = '暂无可导出图层';
        this._statusEl.textContent = '';
        return;
      }

      for (var i = 0; i < layers.length; i++) {
        var label = L.DomUtil.create('label', '', this._layerList);
        var cb = L.DomUtil.create('input', '', label);
        cb.type = 'checkbox';
        cb.checked = true;
        var text = document.createTextNode(' ' + layers[i].name);
        label.appendChild(text);
      }

      this._statusEl.textContent = '共 ' + layers.length + ' 个图层（默认全选）';
    },

    // =======================================================================
    // Export handler
    // =======================================================================
    _onExport: function () {
      var layers = this._exportableLayers;
      if (!layers || layers.length === 0) {
        WGIS.msg('暂无可导出图层');
        return;
      }

      var formatMap = { shp: 'shp', kml: 'kml', json: 'json' };
      var format = this._formatSelect.value;

      var checkboxes = this._layerList.querySelectorAll('input[type=checkbox]');
      var selectedLayers = [];

      for (var i = 0; i < checkboxes.length; i++) {
        if (!checkboxes[i].checked) { continue; }
        if (!layers[i]) { continue; }

        var entry = layers[i];
        if (entry.isGroup) {
          var self = this;
          entry.layer.eachLayer(function (child) {
            if (WGIS.isExportable(child)) {
              selectedLayers.push(child);
            }
          });
        } else {
          selectedLayers.push(entry.layer);
        }
      }

      if (selectedLayers.length === 0) {
        WGIS.msg('请至少选择一个图层');
      return;
    }

    this._exportSelectedFeatures(this._map, selectedLayers, format);
    WGIS.msg('已导出 ' + selectedLayers.length + ' 个要素');
  }
  });

  // =========================================================================
  // Factory function
  // =========================================================================
  L.control.exporter = function (options) {
    return new L.Control.Exporter(options);
  };
})();
