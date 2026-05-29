/**
 * UI module — popup handling and drawing tools (point/line/polygon).
 * All state accessed through WGIS.state.
 */
(function () {
  'use strict';

  var popup = L.popup({ autoClose: true, offset: [0, -25], maxWidth: 600, minWidth: 190 });

  // =========================================================================
  // Geometry calculation helpers
  // =========================================================================
  function calc(latlngs) {
    var path = latlngs.map(function (ll) { return [ll.lat, ll.lng]; });
    var line = { type: 'Feature', geometry: { type: 'LineString', coordinates: path } };
    var poly = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [path] } };
    var meters = turf.length(line, { units: 'kilometers' }) * 1000;
    var sqMeters = turf.area(poly);
    return { length: meters, area: sqMeters };
  }

  // =========================================================================
  // Feature type detection (does not rely on Geoman)
  // =========================================================================
  function detectFeatureType(layer) {
    if (layer instanceof L.Rectangle)    { return 'Rectangle'; }
    if (layer instanceof L.Polygon)      { return 'Polygon'; }
    if (layer instanceof L.Polyline)     { return 'Polyline'; }
    if (layer instanceof L.CircleMarker) { return 'CircleMarker'; }
    if (layer instanceof L.Marker)       { return 'Marker'; }
    if (layer.pm && layer.pm._shape)     { return layer.pm._shape; }
    return 'unknown';
  }

  // =========================================================================
  // Flatten nested Multi* geometry coordinates to a flat LatLng array
  // =========================================================================
  function flattenLatLngs(latlngs) {
    if (!latlngs || latlngs.length === 0) { return []; }
    if (latlngs[0] && typeof latlngs[0].lat === 'number') { return latlngs; }
    if (Array.isArray(latlngs[0])) { return flattenLatLngs(latlngs[0]); }
    return latlngs;
  }

  // =========================================================================
  // Popup content builder
  // =========================================================================
  function buildPopup(layer, featureType) {
    featureType = featureType || detectFeatureType(layer);

    var nametext;
    if (layer.options.name !== undefined) {
      nametext = '<h3>名称： ' + layer.options.name + '</h3>';
    } else if (layer.options.icon !== undefined) {
      nametext = '<h3>名称： ' + layer.options.icon.options.name + '</h3>';
    } else {
      nametext = '<h3>名称： Undefined</h3>';
    }

    var typetext = '<h4 id="typetext" style="padding:10px 0 0 0; border-top:0.5px solid #000;">类型： ' +
      featureType + '</h4>';

    var descriptext = '';
    if (layer.options.description) {
      descriptext = '<div id="descriptext">' +
        '<h4 style="padding:10px 0 0 0; border-top:0.5px solid #000;">描述:</h4><div>' +
        layer.options.description + '</div></div>';
    }

    var coord, Lengthtext, Areatext, rangetext, coordtext, coordoutput;

    switch (featureType) {
      case 'Polygon':
      case 'Rectangle':
      case 'Polyline':
      case 'Line':
        var bounds = layer.getBounds();
        var SW = bounds.getSouthWest().lng.toFixed(9) + '&emsp;' + bounds.getSouthWest().lat.toFixed(9);
        var NE = bounds.getNorthEast().lng.toFixed(9) + '&emsp;' + bounds.getNorthEast().lat.toFixed(9);
        rangetext = '<div id="rangetext"><h4 style="padding:10px 0 0 0; border-top:0.5px solid #000;">范围：</h4>' +
          '经度&emsp;&emsp;&emsp;&emsp;&emsp;&nbsp;&nbsp;纬度<br>' + SW + '<br>' + NE + '</div>';

        if (featureType === 'Polyline' || featureType === 'Line') {
          coord = flattenLatLngs(layer.getLatLngs());
          Lengthtext = '<h4 id="lengthtext" style="padding:10px 0 0 0; border-top:0.5px solid #000;">长度： ' +
            (calc(coord).length / 1000).toFixed(3) + ' km</h4>';
          Areatext = '';
        } else {
          coord = flattenLatLngs(layer.getLatLngs());
          Lengthtext = '';
          Areatext = '<h4 id="areatext" style="padding:10px 0 0 0; border-top:0.5px solid #000;">面积： ' +
            (calc(coord).area / 10000).toFixed(4) + ' 公顷</h4>';
        }

        var coordtext0 = '<div id="coordtext"><h4 style="padding:10px 0 0 0; border-top:0.5px solid #000;">坐标:</h4>';
        var coordtext1 = '<p>经度&emsp;&emsp;&emsp;&emsp;&emsp;&nbsp;&nbsp;纬度<br>';
        var coordtext2 = [];
        var coordRows = [];
        for (var i = 0; i < coord.length; i++) {
          coordtext2.push(coord[i].lng.toFixed(9) + '&emsp;' + coord[i].lat.toFixed(9));
          coordRows.push(coord[i].lng.toFixed(9) + '\t' + coord[i].lat.toFixed(9));
        }
        coordoutput = coordRows.join('\n');
        if (coord.length <= 30) {
          coordtext = coordtext0 + coordtext1 + coordtext2.join('<br>') + '</div>';
        } else {
          coordtext = coordtext0 + '数据量超过30个，不显示</div><br>' +
            '<div style="text-align: center;"><button id="pop_printcoord">复制坐标串</button></div><br>';
        }
        break;

      case 'Marker':
      case 'CircleMarker':
      case 'Text':
      case 'Circle':
        coord = layer.getLatLng();
        Lengthtext = '';
        Areatext = '';
        rangetext = '';
        coordtext = '<div id="coordtext"><h4 style="padding:10px 0 0 0; border-top:0.5px solid #000;">位置:</h4>' +
          '<p>经度&emsp;&emsp;&emsp;&emsp;&emsp;&nbsp;&nbsp;纬度<br>' +
          coord.lng.toFixed(9) + '&emsp;' + coord.lat.toFixed(9) + '</p></div>';
        break;

      default:
        coord = (layer.getLatLng) ? layer.getLatLng() : null;
        Lengthtext = '';
        Areatext = '';
        rangetext = '';
        coordoutput = [];
        if (coord) {
          coordtext = '<div id="coordtext"><h4 style="padding:10px 0 0 0; border-top:0.5px solid #000;">位置:</h4>' +
            '<p>经度&emsp;&emsp;&emsp;&emsp;&emsp;&nbsp;&nbsp;纬度<br>' +
            coord.lng.toFixed(9) + '&emsp;' + coord.lat.toFixed(9) + '</p></div>';
        } else {
          coordtext = '';
        }
    }

    var endtext = '<div><div>' +
      '<label id="popup-shuxing" class="popup-open"><input type="radio" name="方法" id="属性" style="display:none" checked="checked">属性</label>' +
      '<label id="popup-xiangqing" class="popup-close"><input type="radio" name="方法" id="详情" style="display:none">详情</label>' +
      '</div></div>';

    var pop_mid1 = typetext + Lengthtext + Areatext + descriptext;
    var pop_mid2 = rangetext + coordtext;

    return {
      pop_mid1: pop_mid1,
      pop_mid2: pop_mid2,
      popHtml: nametext + '<div id="pop_mid">' + pop_mid1 + '</div>' + endtext,
      coordoutput: coordoutput
    };
  }

  // =========================================================================
  // Main popup handler (called on feature click)
  // =========================================================================
  function popupA(e) {
    var layer = e.target;
    var popContent = buildPopup(layer);

    popup.setContent(popContent.popHtml).setLatLng(e.latlng).addTo(WGIS.state.map);
    document.getElementById('pop_mid').innerHTML = popContent.pop_mid1;
    document.getElementById('popup-shuxing').className = 'popup-open';
    document.getElementById('popup-xiangqing').className = 'popup-close';

    var popupEl = document.querySelector('.leaflet-popup-content');
    if (!popupEl) { return; }
    var radios = popupEl.querySelectorAll('input[type=radio][name=方法]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].onchange = function () {
        var popMid = document.getElementById('pop_mid');
        if (this.id === '属性') {
          popMid.innerHTML = popContent.pop_mid1;
          document.getElementById('popup-shuxing').className = 'popup-open';
          document.getElementById('popup-xiangqing').className = 'popup-close';
        } else {
          popMid.innerHTML = popContent.pop_mid2;
          document.getElementById('popup-shuxing').className = 'popup-close';
          document.getElementById('popup-xiangqing').className = 'popup-open';
          var printBtn = document.getElementById('pop_printcoord');
          if (printBtn) {
            printBtn.onclick = function () {
              var text = popContent.coordoutput;
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                  WGIS.msg('坐标串已复制 (' + text.split('\n').length + ' 个点)');
                });
              } else {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                WGIS.msg('坐标串已复制 (' + text.split('\n').length + ' 个点)');
              }
            };
          }
        }
      };
    }
  }

  // =========================================================================
  // Init — wire Geoman create hook after map is ready
  // =========================================================================
  function init() {
    var map = WGIS.state.map;
    var templayer = WGIS.state.templayer;

    map.on('pm:create', function (e) {
      e.layer.addTo(templayer);
      bindPopup(e.layer);
    });
  }

  function bindPopup(layer) {
    if (WGIS.isExportable(layer)) {
      layer.on('click', function (ev) { popupA(ev); });
    } else if (layer.eachLayer) {
      layer.eachLayer(function (child) { bindPopup(child); });
    }
  }

  // =========================================================================
  // Export to WGIS namespace
  // =========================================================================
  WGIS.popupA = popupA;
  WGIS.popup = popup;
  WGIS.calc = calc;
  WGIS.bindPopup = bindPopup;
  WGIS.uiInit = init;
})();