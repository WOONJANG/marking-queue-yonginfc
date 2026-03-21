(function() {
    /* =========================
       01. DOM 참조 / 상태값
       ========================= */
    var tokenField = document.getElementById('tokenField');
    var phone = document.getElementById('phone');
    var agreeCheckbox = document.getElementById('agreeCheckbox');
    var agreeField = document.getElementById('agreeField');
    var bindForm = document.getElementById('bindForm');
    var bindSubmitBtn = document.getElementById('bindSubmitBtn');
    var bindMsg = document.getElementById('bindMsg');
    var infoWorkNo = document.getElementById('infoWorkNo');
    var infoStatus = document.getElementById('infoStatus');
    var infoClaim = document.getElementById('infoClaim');

    var bindPollingTimer = null;
    var bindPollingStartedAt = 0;
    var bindCompleted = false;

    /* =========================
       02. 공통 유틸
       ========================= */

    // 숫자만 남기기
    function normalizeDigits(value) {
        return String(value == null ? '' : value).replace(/\D/g, '');
    }

    // 토큰 문자열 정리
    function normalizeToken(value) {
        return String(value == null ? '' : value).trim().replace(/[^A-Za-z0-9_-]/g, '');
    }

    /* =========================
       03. 토큰 처리
       ========================= */

    // URL 또는 sessionStorage에서 바인드 토큰 가져오기
    function getToken() {
        var params = new URLSearchParams(location.search);
        var fromUrl = normalizeToken(params.get('k') || params.get('token') || '');
        var saved = normalizeToken(sessionStorage.getItem('bindToken') || '');
        var token = fromUrl || saved || '';

        if (fromUrl) {
            sessionStorage.setItem('bindToken', fromUrl);
            history.replaceState({}, '', location.pathname);
        }

        return token;
    }

    /* =========================
       04. UI 출력
       ========================= */

    // 안내 메시지 표시
    function showMessage(text, ok) {
        bindMsg.textContent = text || '';
        bindMsg.className = 'msg' + (text ? ' ' + (ok ? 'ok' : 'err') : '');
    }

    // 작업 정보 표시
    function applyTaskInfo(task) {
        infoWorkNo.textContent = '#' + (task.workNo || '-');
        infoStatus.textContent = task.status || '-';
        infoClaim.textContent = task.claimStatus || '-';
    }

    // 이미 연결된 작업인지 확인
    function isBoundTask(task) {
        if (!task) return false;
        return (
            task.claimStatus === '연결됨' ||
            task.claimStatus === 'BOUND' ||
            task.claimStatus === 'bound'
        );
    }

    /* =========================
       05. 폴링 제어
       ========================= */

    // 폴링 중지
    function stopBindPolling() {
        if (bindPollingTimer) {
            clearInterval(bindPollingTimer);
            bindPollingTimer = null;
        }
    }

    /* =========================
       06. 완료 / 실패 처리
       ========================= */

    // 연결 완료 후 공개 페이지로 이동
    function goToPublicPage(workNo) {
        var q = encodeURIComponent(String(workNo || ''));
        setTimeout(function() {
            location.href = './?q=' + q;
        }, 800);
    }

    // 연결 완료 UI 처리
    function completeBindUI(task, message) {
        bindCompleted = true;
        stopBindPolling();
        applyTaskInfo(task || {});
        showMessage(message || '연결이 완료되었습니다.', true);
        bindSubmitBtn.disabled = false;
        if (task && task.workNo) {
            goToPublicPage(task.workNo);
        }
    }

    // 연결 실패 UI 처리
    function failBindUI(message) {
        stopBindPolling();
        showMessage(message || '연결에 실패했습니다.', false);
        bindSubmitBtn.disabled = false;
    }

    /* =========================
       07. 작업 정보 조회
       ========================= */

    // 현재 토큰 기준 작업 정보 조회
    function fetchTaskInfo() {
        var token = getToken();
        if (!token) {
            return Promise.reject(new Error('유효하지 않은 QR 링크입니다.'));
        }
        return AppApi.jsonp({
            mode: 'taskInfo',
            k: token
        });
    }

    /* =========================
       08. 바인드 상태 폴링
       ========================= */

    // 연결 완료 여부를 주기적으로 확인
    function startBindPolling() {
        stopBindPolling();
        bindPollingStartedAt = Date.now();

        bindPollingTimer = setInterval(function() {
            if (bindCompleted) return;

            fetchTaskInfo()
                .then(function(res) {
                    if (!res || !res.success || !res.task) return;

                    applyTaskInfo(res.task);

                    if (isBoundTask(res.task)) {
                        completeBindUI(res.task, '등록이 완료되었습니다.');
                        return;
                    }

                    if (Date.now() - bindPollingStartedAt > 12000) {
                        failBindUI('처리는 되었을 수 있지만 응답 확인이 지연되고 있습니다. 새로고침 후 다시 확인해주세요.');
                    }
                })
                .catch(function() {
                    if (Date.now() - bindPollingStartedAt > 12000) {
                        failBindUI('처리는 되었을 수 있지만 응답 확인에 실패했습니다. 새로고침 후 다시 확인해주세요.');
                    }
                });
        }, 800);
    }

    /* =========================
       09. 초기 작업 정보 로드
       ========================= */

    // 페이지 진입 시 작업 상태 먼저 확인
    function loadTaskInfo() {
        var token = getToken();
        if (!token) {
            showMessage('유효하지 않은 QR 링크입니다.', false);
            bindSubmitBtn.disabled = true;
            return;
        }

        tokenField.value = token;
        AppApi.setBindFormAction(bindForm);

        fetchTaskInfo()
            .then(function(res) {
                if (!res || !res.success || !res.task) {
                    throw new Error((res && res.message) || '작업 정보를 찾을 수 없습니다.');
                }

                applyTaskInfo(res.task);

                if (!res.task.canBind) {
                    bindSubmitBtn.disabled = true;
                    showMessage('현재 이 작업번호는 이미 사용 중이거나 완료 상태입니다. 관리자에게 문의하세요.', false);
                }
            })
            .catch(function(err) {
                bindSubmitBtn.disabled = true;
                showMessage(err.message || '작업 정보를 불러오지 못했습니다.', false);
            });
    }

    /* =========================
       10. 제출 처리
       ========================= */

    // 폼 제출 전 값 정리 및 검증
    function handleSubmit(e) {
        e.preventDefault();

        var token = getToken();
        var normalizedPhone = normalizeDigits(phone.value);

        tokenField.value = token;
        phone.value = normalizedPhone;
        agreeField.value = agreeCheckbox.checked ? 'Y' : 'N';

        if (!token) {
            showMessage('QR 토큰이 올바르지 않습니다.', false);
            return;
        }

        if (!normalizedPhone) {
            showMessage('휴대전화 번호를 입력하세요.', false);
            phone.focus();
            return;
        }

        if (!agreeCheckbox.checked) {
            showMessage('개인정보 이용 동의가 필요합니다.', false);
            return;
        }

        bindCompleted = false;
        showMessage('연결 처리 중입니다...', true);
        bindSubmitBtn.disabled = true;

        bindForm.submit();
        startBindPolling();
    }

    /* =========================
       11. 외부 응답 수신
       ========================= */

    // iframe/postMessage 결과 수신
    window.addEventListener('message', function(event) {
        var data = event && event.data;
        if (!data || typeof data !== 'object') return;

        if (data.success) {
            completeBindUI(data.task || {}, data.message || '연결이 완료되었습니다.');
        } else {
            failBindUI(data.message || '연결에 실패했습니다.');
        }
    });

    /* =========================
       12. 초기 실행
       ========================= */

    // 페이지 로드 후 이벤트 연결 및 초기 조회
    document.addEventListener('DOMContentLoaded', function() {
        bindForm.addEventListener('submit', handleSubmit);
        loadTaskInfo();
    });
})();
