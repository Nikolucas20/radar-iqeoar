// Reemplaza el almacenamiento de Claude: lee ofertas.json y guarda los estados en este dispositivo.
(function () {
  var KEY = "radar-estados";
  var data = null, listeners = [], metaListeners = [];
  function local() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function snap() {
    var est = local();
    return { docs: (data ? data.ofertas : []).map(function (x) {
      var d = Object.assign({}, x.d);
      if (est[x.id]) { d.estado = est[x.id].estado; d.estado_fecha = est[x.id].fecha; }
      return { id: x.id, exists: true, data: function () { return d; } };
    }) };
  }
  function emit() { listeners.forEach(function (cb) { cb(snap()); }); }
  var ready = fetch("ofertas.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
    data = j; emit();
    metaListeners.forEach(function (cb) { cb({ exists: !!j.meta, data: function () { return j.meta; } }); });
  });
  var db = {
    collection: function () { return { onSnapshot: function (cb) { listeners.push(cb); if (data) cb(snap()); return function () {}; } }; },
    doc: function (path) {
      return {
        onSnapshot: function (cb) { metaListeners.push(cb); if (data) cb({ exists: !!data.meta, data: function () { return data.meta; } }); return function () {}; },
        update: function (v) {
          var id = String(path).split("/")[1], est = local();
          est[id] = { estado: v.estado, fecha: v.estado_fecha };
          try { localStorage.setItem(KEY, JSON.stringify(est)); } catch (e) {}
          emit();
          return Promise.resolve();
        }
      };
    }
  };
  window.claude = { use: function (n) {
    if (n === "db") return ready.then(function () { return db; }, function () { return db; });
    if (n === "user") return Promise.resolve({ can: function () { return Promise.resolve(true); } });
    return Promise.resolve(null);
  } };
})();
