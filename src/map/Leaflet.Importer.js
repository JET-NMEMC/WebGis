/**
 * Leaflet.Importer — file import and coordinate drawing control plugin.
 *
 * Usage:
 *   L.control.importer({ position: 'topleft' }).addTo(map);
 *
 * Supports: KML, GeoJSON file import via drag-and-drop or browse,
 *           plus coordinate text parsing to create point/line/polygon layers.
 *
 * Dependencies: Leaflet 1.x, WGIS namespace, L.KML
 */
(function () {
  'use strict';

  // =========================================================================
  // L.Control.Importer
  // =========================================================================
  L.Control.Importer = L.Control.extend({
    options: {
      position: 'topleft',
      title: '↓ 导入'
    },

    initialize: function (options) {
      L.setOptions(this, options);
      this._panel = null;
      this._panelVisible = false;
      this._map = null;
    },

    onAdd: function (map) {
      this._map = map;

      var btn = L.DomUtil.create('a', 'leaflet-importer-button');
      btn.href = '#';
      btn.title = this.options.title;
      btn.innerHTML = '⤓';
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
      var panel = L.DomUtil.create('div', 'leaflet-importer-panel');

      // Header
      var header = L.DomUtil.create('div', 'li-header', panel);
      header.textContent = '数据导入';
      var closeBtn = L.DomUtil.create('button', 'li-close', header);
      closeBtn.innerHTML = '&times;';
      L.DomEvent.on(closeBtn, 'click', this._hidePanel, this);

      var body = L.DomUtil.create('div', 'li-body', panel);

      // ---- Section 1: File Import ----
      var sec1 = L.DomUtil.create('div', 'li-section', body);
      var sec1Title = L.DomUtil.create('div', 'li-section-title', sec1);
      sec1Title.textContent = '文件导入 (KML / GeoJSON)';

      var dropzone = L.DomUtil.create('div', 'li-dropzone', sec1);
      dropzone.innerHTML = '<span class="li-dropzone-icon">&#128196;</span>拖放文件到此处 或 点击浏览';
      this._dropzone = dropzone;

      var fileInput = L.DomUtil.create('input', '', sec1);
      fileInput.type = 'file';
      fileInput.accept = '.kml,.json,.geojson';
      fileInput.style.display = 'none';
      this._fileInput = fileInput;

      var fileNameEl = L.DomUtil.create('span', 'li-filename', sec1);
      this._fileNameEl = fileNameEl;

      // Drop events
      L.DomEvent.on(dropzone, 'click', function () { fileInput.click(); });
      L.DomEvent.on(dropzone, 'dragover', function (e) {
        L.DomEvent.preventDefault(e);
        dropzone.classList.add('dragover');
      });
      L.DomEvent.on(dropzone, 'dragleave', function () {
        dropzone.classList.remove('dragover');
      });
      L.DomEvent.on(dropzone, 'drop', function (e) {
        L.DomEvent.preventDefault(e);
        dropzone.classList.remove('dragover');
        var files = e.dataTransfer.files;
        if (files && files.length > 0) {
          self._handleFile(files[0]);
        }
      });

      L.DomEvent.on(fileInput, 'change', function () {
        if (fileInput.files && fileInput.files.length > 0) {
          self._handleFile(fileInput.files[0]);
        }
      });

      // ---- Section 2: Coordinate Drawing ----
      var sec2 = L.DomUtil.create('div', 'li-section', body);
      var sec2Title = L.DomUtil.create('div', 'li-section-title', sec2);
      sec2Title.textContent = '坐标绘图';

      // Row 1: name + text color
      var row1 = L.DomUtil.create('div', 'li-row', sec2);
      L.DomUtil.create('label', '', row1).textContent = '名称:';
      var nameInput = L.DomUtil.create('input', '', row1);
      nameInput.type = 'text';
      nameInput.value = 'New';
      this._nameInput = nameInput;

      L.DomUtil.create('label', '', row1).textContent = '字色:';
      var textColorInput = L.DomUtil.create('input', '', row1);
      textColorInput.type = 'color';
      textColorInput.value = '#0019FD';
      this._textColorInput = textColorInput;

      // Row 2: edge color + text height
      var row2 = L.DomUtil.create('div', 'li-row', sec2);
      L.DomUtil.create('label', '', row2).textContent = '边色:';
      var edgeColorInput = L.DomUtil.create('input', '', row2);
      edgeColorInput.type = 'color';
      edgeColorInput.value = '#2D9900';
      this._edgeColorInput = edgeColorInput;

      L.DomUtil.create('label', '', row2).textContent = '字号:';
      var textHeightInput = L.DomUtil.create('input', '', row2);
      textHeightInput.type = 'text';
      textHeightInput.value = '15';
      this._textHeightInput = textHeightInput;

      // Textarea
      var textarea = L.DomUtil.create('textarea', 'li-textarea', sec2);
      textarea.innerHTML = 'name  lng    lat\n大连市 121.561 38.875\n青岛市 120.427 36.093\n威海市 122.112 37.422';
      this._textarea = textarea;

      // Buttons
      var btnGroup = L.DomUtil.create('div', 'li-btn-group', sec2);

      var makeBtn = function (label, fn) {
        var b = L.DomUtil.create('button', 'li-btn', btnGroup);
        b.textContent = label;
        L.DomEvent.on(b, 'click', fn, self);
        return b;
      };

      makeBtn('圆标记', this._onDrawCircleMarker);
      makeBtn('点标记', this._onDrawSite);
      makeBtn('点标注', this._onDrawSiteText);
      makeBtn('多段线', this._onDrawPolyline);
      makeBtn('多边形', this._onDrawPolygon);

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
    // File handling
    // =======================================================================
    _handleFile: function (file) {
      var self = this;
      var filename = file.name;
      var format = this._detectFormat(filename);
      if (!format) {
        WGIS.msg('不支持的文件格式: ' + filename);
        return;
      }
      this._fileNameEl.textContent = filename;

      var url = URL.createObjectURL(file);
      if (format === 'kml') {
        fetch(url).then(function (r) { return r.text(); })
          .then(function (text) { self._importKML(text, filename); });
      } else {
        fetch(url).then(function (r) { return r.json(); })
          .then(function (json) { self._importGeoJSON(json, filename); });
      }
    },

    _detectFormat: function (filename) {
      var ext = filename.split('.').pop().toLowerCase();
      if (ext === 'kml') { return 'kml'; }
      if (ext === 'json' || ext === 'geojson') { return 'geojson'; }
      return null;
    },

    _importKML: function (text, filename) {
      var kml = new DOMParser().parseFromString(text, 'text/xml');
      var track = new L.KML(kml);
      this._map.addLayer(track);
      WGIS.bindPopup(track);
      WGIS.state.layerControl2.addOverlay(track, filename);
      if (track.getBounds) {
        try { this._map.fitBounds(track.getBounds()); } catch (e) { /* empty KML */ }
      }
      WGIS.msg('导入KML: ' + filename);
    },

    _importGeoJSON: function (json, filename) {
      var geojsonLayer = L.geoJson(json).addTo(this._map);
      WGIS.bindPopup(geojsonLayer);
      WGIS.state.layerControl2.addOverlay(geojsonLayer, filename);
      if (geojsonLayer.getBounds) {
        try { this._map.fitBounds(geojsonLayer.getBounds()); } catch (e) { /* empty GeoJSON */ }
      }
      WGIS.msg('导入GeoJSON: ' + filename);
    },

    // =======================================================================
    // Coordinate drawing handlers
    // =======================================================================
    _getCoordOptions: function () {
      return {
        name: this._nameInput.value,
        textColor: this._textColorInput.value,
        edgeColor: this._edgeColorInput.value,
        textHeight: this._textHeightInput.value
      };
    },

    _onDrawCircleMarker: function () {
      var siteData = WGIS.parseCoordString(this._textarea.value);
      if (!siteData || siteData.length < 2) { WGIS.msg('请至少输入一行标题和一行坐标数据'); return; }
      drawCircleMarkerFromData(siteData, this._getCoordOptions());
    },

    _onDrawSite: function () {
      var siteData = WGIS.parseCoordString(this._textarea.value);
      if (!siteData || siteData.length < 2) { WGIS.msg('请至少输入一行标题和一行坐标数据'); return; }
      drawSiteFromData(siteData, this._getCoordOptions());
    },

    _onDrawSiteText: function () {
      var siteData = WGIS.parseCoordString(this._textarea.value);
      if (!siteData || siteData.length < 2) { WGIS.msg('请至少输入一行标题和一行坐标数据'); return; }
      drawSiteTextFromData(siteData, this._getCoordOptions());
    },

    _onDrawPolyline: function () {
      var siteData = WGIS.parseCoordString(this._textarea.value);
      if (!siteData || siteData.length < 2) { WGIS.msg('请至少输入一行标题和一行坐标数据'); return; }
      drawPolylineFromData(siteData, this._getCoordOptions());
    },

    _onDrawPolygon: function () {
      var siteData = WGIS.parseCoordString(this._textarea.value);
      if (!siteData || siteData.length < 2) { WGIS.msg('请至少输入一行标题和一行坐标数据'); return; }
      drawPolygonFromData(siteData, this._getCoordOptions());
    }
  });

  // =========================================================================
  // Coordinate drawing functions (moved from ui.js)
  // =========================================================================
  function getIconHtml(name, textheight, textcolor) {
    var w = textheight * name.length;
    return '<div class="stroke" style="width:' + w + 'px; font-size:' + textheight + 'px;">' + name + '</div>' +
      '<div class="stroke-front" style="width:' + w + 'px; font-size:' + textheight + 'px; color:' + textcolor + ';">' + name + '</div>';
  }

  function drawCircleMarkerFromData(siteData, options) {
    var layername = options.name;
    var textheight = options.textHeight || 15;

    var sites = L.featureGroup();
    for (var i = 1; i < siteData.length; i++) {
      var attribute = {};
      for (var j = 0; j < siteData[i].length; j++) {
        attribute[siteData[0][j]] = siteData[i][j];
      }
      L.circleMarker([siteData[i][2], siteData[i][1]], {
        featureType: 'CircleMarker',
        name: siteData[i][0],
        attribute: attribute,
        radius: textheight,
        color: '#FFFFFF',
        fillColor: '#F44334',
        weight: 1,
        fillOpacity: 1
      }).addTo(sites);
    }
    sites.addTo(WGIS.state.map);
    WGIS.bindPopup(sites);
    sites.options.name = layername + '-点';
    sites.options.type = 'featureGroupOverlay';
    WGIS.state.layerControl2.addOverlay(sites, layername + '-点');
    WGIS.state.map.fitBounds(sites.getBounds());
  }

  function drawSiteFromData(siteData, options) {
    var sitename = options.name;
    var icon = L.icon({
      iconUrl: 'public/icons/pin-m+7e7e7e@2x.png',
      iconSize: [30],
      iconAnchor: [15, 35],
      popupAnchor: [0, -50]
    });

    var sites = L.featureGroup();
    for (var i = 1; i < siteData.length; i++) {
      var attribute = {};
      for (var j = 0; j < siteData[i].length; j++) {
        attribute[siteData[0][j]] = siteData[i][j];
      }
      L.marker([siteData[i][2], siteData[i][1]], {
        icon: icon,
        name: siteData[i][0],
        attribute: attribute
      }).addTo(sites);
    }
    sites.addTo(WGIS.state.map);
    WGIS.bindPopup(sites);
    sites.options.name = sitename + '-点';
    sites.options.type = 'featureGroupOverlay';
    WGIS.state.layerControl2.addOverlay(sites, sitename + '-点');
    WGIS.state.map.fitBounds(sites.getBounds());
  }

  function drawSiteTextFromData(siteData, options) {
    var sitename = options.name;
    var textcolor = options.textColor || '#0019FD';
    var textheight = options.textHeight || 15;
    var sitesLabel = L.featureGroup();

    for (var i = 1; i < siteData.length; i++) {
      var name = siteData[i][0];
      var markerIcon = L.divIcon({
        html: getIconHtml(name, textheight, textcolor),
        name: name,
        textheight: textheight,
        textcolor: textcolor,
        className: 'icondiv',
        iconSize: [textheight * name.length, textheight],
        iconAnchor: [0, 0]
      });

      var markers = L.marker([siteData[i][2], siteData[i][1]], {
        icon: markerIcon,
        type: 'markerdivIcon',
        attribute: { name: siteData[i][0] }
      }).addTo(sitesLabel);

      markers.on('click', function (e) {
        var iconOptions = e.target.options.icon.options;
        var popupHtml = '<h3>名称: <input id="iconname" type="text" value="' + iconOptions.name + '" style="height:30px;" /></h3>' +
          '<h3>颜色: <input id="iconcolor" type="color" value="' + iconOptions.textcolor + '" style="width:170px;" /></h3>' +
          '<h3>字号: <input id="iconheight" type="text" value="' + iconOptions.textheight + '" style="height:20px;" /></h3>';
        WGIS.popup.setContent(popupHtml).setLatLng(e.latlng).addTo(WGIS.state.map);

        var nameInput = document.getElementById('iconname');
        var colorInput = document.getElementById('iconcolor');
        var heightInput = document.getElementById('iconheight');
        var handler = function () {
          iconOptions.name = nameInput.value;
          e.target.options.attribute.name = nameInput.value;
          iconOptions.textcolor = colorInput.value;
          iconOptions.textheight = heightInput.value;
          iconOptions.iconSize = [iconOptions.textheight * iconOptions.name.length, iconOptions.textheight];
          iconOptions.html = getIconHtml(iconOptions.name, iconOptions.textheight, iconOptions.textcolor);
          WGIS.state.map.removeLayer(e.target);
          WGIS.state.map.addLayer(e.target);
        };
        nameInput.onchange = handler;
        colorInput.onchange = handler;
        heightInput.onchange = handler;
      });
    }
    sitesLabel.addTo(WGIS.state.map);
    WGIS.state.layerControl2.addOverlay(sitesLabel, sitename + '-文字标注');
    sitesLabel.options.name = sitename + '-点';
    WGIS.state.map.fitBounds(sitesLabel.getBounds());
  }

  function drawPolylineFromData(siteData, options) {
    var sitename = options.name;

    var latlngs = [];
    for (var i = 1; i < siteData.length; i++) {
      latlngs.push([siteData[i][2], siteData[i][1]]);
    }
    var polyline = L.polyline(latlngs, {
      color: '#FF1493',
      weight: 3,
      name: sitename,
      type: 'polyline'
    }).addTo(WGIS.state.map);
    WGIS.bindPopup(polyline);
    WGIS.state.layerControl2.addOverlay(polyline, sitename + '-线');
    WGIS.state.map.fitBounds(polyline.getBounds());
  }

  function drawPolygonFromData(siteData, options) {
    var sitename = options.name;
    var edgecolor = options.edgeColor || '#2D9900';

    var latlngs = [];
    for (var i = 1; i < siteData.length; i++) {
      latlngs.push([siteData[i][2], siteData[i][1]]);
    }
    var polygon = L.polygon(latlngs, {
      color: edgecolor,
      weight: 1,
      fillOpacity: 0.2,
      name: sitename,
      type: 'polygon'
    }).addTo(WGIS.state.map);
    WGIS.bindPopup(polygon);
    WGIS.state.layerControl2.addOverlay(polygon, sitename + '-面');
    WGIS.state.map.fitBounds(polygon.getBounds());
  }

  // =========================================================================
  // Factory function
  // =========================================================================
  L.control.importer = function (options) {
    return new L.Control.Importer(options);
  };
})();
