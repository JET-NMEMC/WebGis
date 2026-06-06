/* Service Worker — proxy mghydro.com tile requests to bypass CORS */
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (u.hostname !== 'mghydro.com') return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      var h = new Headers(r.headers);
      h.set('Access-Control-Allow-Origin', '*');
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
    })
  );
});
