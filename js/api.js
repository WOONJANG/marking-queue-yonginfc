(function (window) {
  function ensureApiBase() {
    var base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
    return String(base).trim().replace(/\/$/, '');
  }

  function buildUrl(params) {
    var base = ensureApiBase();
    if (!base) throw new Error('APP_CONFIG.API_BASE 값이 비어 있습니다.');
    var query = [];
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    });
    return base + (query.length ? ('?' + query.join('&')) : '');
  }

  function jsonp(params) {
    return new Promise(function (resolve, reject) {
      var callbackName = '__jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      var script = document.createElement('script');
      var timer = null;

      params = params || {};
      params.callback = callbackName;

      window[callbackName] = function (data) {
        cleanup();
        resolve(data || {});
      };

      function cleanup() {
        if (timer) clearTimeout(timer);
        try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      script.onerror = function () {
        cleanup();
        reject(new Error('네트워크 오류가 발생했습니다.'));
      };

      timer = setTimeout(function () {
        cleanup();
        reject(new Error('응답 시간이 초과되었습니다.'));
      }, 8000);

      script.src = buildUrl(params);
      (document.body || document.documentElement).appendChild(script);
    });
  }

  function setBindFormAction(form) {
    form.action = ensureApiBase();
  }

  window.AppApi = {
    jsonp: jsonp,
    setBindFormAction: setBindFormAction,
    buildUrl: buildUrl
  };
})(window);