(function(window) {
    /* =========================
       01. API 기본 주소 처리
       ========================= */

    // APP_CONFIG에서 API_BASE를 읽고 마지막 슬래시 제거
    function ensureApiBase() {
        var base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '';
        return String(base).trim().replace(/\/$/, '');
    }

    /* =========================
       02. 요청 URL 생성
       ========================= */

    // 전달받은 파라미터를 API_BASE 뒤에 쿼리스트링으로 조합
    function buildUrl(params) {
        var base = ensureApiBase();
        if (!base) throw new Error('APP_CONFIG.API_BASE 값이 비어 있습니다.');
        var query = [];
        Object.keys(params || {}).forEach(function(key) {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
            }
        });
        return base + (query.length ? ('?' + query.join('&')) : '');
    }

    /* =========================
       03. JSONP 요청
       ========================= */

    // script 태그를 이용해 JSONP 방식으로 응답 받기
    function jsonp(params) {
        return new Promise(function(resolve, reject) {
            var callbackName = '__jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            var script = document.createElement('script');
            var timer = null;

            params = params || {};
            params.callback = callbackName;

            // 서버 응답 콜백
            window[callbackName] = function(data) {
                cleanup();
                resolve(data || {});
            };

            // 타이머/콜백/script 정리
            function cleanup() {
                if (timer) clearTimeout(timer);
                try {
                    delete window[callbackName];
                } catch (e) {
                    window[callbackName] = undefined;
                }
                if (script && script.parentNode) script.parentNode.removeChild(script);
            }

            // script 로드 실패
            script.onerror = function() {
                cleanup();
                reject(new Error('네트워크 오류가 발생했습니다.'));
            };

            // 응답 시간 초과
            timer = setTimeout(function() {
                cleanup();
                reject(new Error('응답 시간이 초과되었습니다.'));
            }, 8000);

            // 요청 시작
            script.src = buildUrl(params);
            (document.body || document.documentElement).appendChild(script);
        });
    }

    /* =========================
       04. 바인드 폼 액션 설정
       ========================= */

    // 바인드 폼의 action을 API_BASE로 설정
    function setBindFormAction(form) {
        form.action = ensureApiBase();
    }

    /* =========================
       05. 전역 API 객체 노출
       ========================= */

    // 다른 스크립트에서 사용할 공용 API 함수 묶음
    window.AppApi = {
        jsonp: jsonp,
        setBindFormAction: setBindFormAction,
        buildUrl: buildUrl
    };
})(window);
