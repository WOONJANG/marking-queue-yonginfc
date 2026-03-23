(function() {
    /* =========================
       01. DOM 참조 / 전역 상태
       ========================= */
    var searchInput = document.getElementById('searchInput');
    var searchBtn = document.getElementById('searchBtn');
    var refreshBtn = document.getElementById('refreshBtn');
    var queueBody = document.getElementById('queueBody');
    var mobileList = document.getElementById('mobileList');
    var updatedAt = document.getElementById('updatedAt');
    var syncNote = document.getElementById('syncNote');
    var adminTrigger = document.getElementById('adminTrigger');
    var adminClickCount = 0;
    var adminClickTimer = null;

    var filterAllBtn = document.getElementById('filterAllBtn');
    var filterWaitingBtn = document.getElementById('filterWaitingBtn');
    var filterCompleteBtn = document.getElementById('filterCompleteBtn');

    var statTotal = document.getElementById('statTotal');
    var statWaiting = document.getElementById('statWaiting');
    var statDone = document.getElementById('statDone');
    var statBound = document.getElementById('statBound');

    var allItemsCache = [];
    var lastUpdatedAt = '-';
    var refreshTimer = null;
    var serverSearchTimer = null;
    var currentMode = 'workNo';
    var currentStatusFilter = 'all';
    var serverSearchRequestSeq = 0;

    var requiredElementsReady =
        searchInput &&
        searchBtn &&
        refreshBtn &&
        queueBody &&
        mobileList &&
        updatedAt &&
        syncNote &&
        filterAllBtn &&
        filterWaitingBtn &&
        filterCompleteBtn &&
        statTotal &&
        statWaiting &&
        statDone &&
        statBound;

    if (!requiredElementsReady) {
        console.error('[index.js] 필수 요소를 찾을 수 없습니다.');
        return;
    }

    /* =========================
       02. URL / 관리자 이동
       ========================= */

    function getQueryValue(name) {
        var params = new URLSearchParams(location.search);
        return params.get(name) || '';
    }

    function getAdminUrl() {
        var base = '';

        if (window.APP_CONFIG && window.APP_CONFIG.API_BASE) {
            base = String(window.APP_CONFIG.API_BASE || '').trim();
        }

        if (!base) return '';

        return base + (base.indexOf('?') === -1 ? '?page=admin' : '&page=admin');
    }

    function handleAdminTriggerClick() {
        adminClickCount += 1;

        if (adminClickTimer) {
            clearTimeout(adminClickTimer);
        }

        adminClickTimer = setTimeout(function() {
            adminClickCount = 0;
            adminClickTimer = null;
        }, 2000);

        if (adminClickCount >= 5) {
            adminClickCount = 0;

            var adminUrl = getAdminUrl();
            if (!adminUrl) {
                alert('관리자 페이지 주소를 찾을 수 없습니다. config.js의 API_BASE를 확인하세요.');
                return;
            }

            location.href = adminUrl;
        }
    }

    function setQueryState(value) {
        var url = new URL(location.href);

        if (value) url.searchParams.set('q', value);
        else url.searchParams.delete('q');

        if (currentStatusFilter && currentStatusFilter !== 'all') {
            url.searchParams.set('status', currentStatusFilter);
        } else {
            url.searchParams.delete('status');
        }

        history.replaceState({}, '', url.toString());
    }

    /* =========================
       03. 공통 유틸
       ========================= */

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeDigits(value) {
        return String(value == null ? '' : value).replace(/\D/g, '');
    }

    function normalizeWorkNo(value) {
        var digits = normalizeDigits(value);
        if (!digits) return '';
        return digits.slice(0, 4);
    }

    function normalizePhoneQuery(value) {
        return normalizeDigits(value).slice(0, 11);
    }

    function workNoSortValue(value) {
        var digits = normalizeDigits(value);
        return digits ? parseInt(digits, 10) : Number.MAX_SAFE_INTEGER;
    }

    function sortByWorkNoAsc(items) {
        return (items || []).slice().sort(function(a, b) {
            var av = workNoSortValue(a.workNo);
            var bv = workNoSortValue(b.workNo);
            if (av !== bv) return av - bv;
            return String(a.workNo || '').localeCompare(String(b.workNo || ''));
        });
    }

    function getCurrentQuery() {
        return String(searchInput.value || '').trim();
    }

    function renderError(message) {
        var text = escapeHtml(message || '불러오기 실패');
        queueBody.innerHTML = '<tr><td colspan="5" class="muted td-empty">' + text + '</td></tr>';
        mobileList.innerHTML = '<div class="mobile-item muted">' + text + '</div>';
    }

    function isLatestRequest(requestId) {
        return requestId === serverSearchRequestSeq;
    }

    // 검색 모드
    // - workNo: 작업번호
    // - hybrid: 작업번호 + 전화번호 동시 검색(4자리 숫자)
    // - name: 이름
    // - phone: 전화번호
    function inferSearchMode(query) {
        var raw = String(query || '').trim();
        var digits = normalizeDigits(raw);

        if (!raw) return 'workNo';
        if (/[가-힣a-zA-Z]/.test(raw)) return 'name';
        if (raw.indexOf('-') !== -1) return 'phone';

        if (/^\d{1,3}$/.test(digits)) return 'workNo';
        if (/^\d{4}$/.test(digits)) return 'hybrid';
        if (/^\d{5,}$/.test(digits)) return 'phone';

        return 'workNo';
    }

    /* =========================
       04. 통계
       ========================= */

    function buildStatsFromItems(items) {
        var list = items || [];
        var stats = {
            total: list.length,
            waiting: 0,
            completed: 0,
            bound: 0
        };

        list.forEach(function(item) {
            if (String(item.status || '') === '대기중') stats.waiting += 1;
            if (String(item.status || '') === '완료') stats.completed += 1;
            if (String(item.claimStatus || '') === '연결됨') stats.bound += 1;
        });

        return stats;
    }

    function renderStats(stats) {
        stats = stats || {};
        if (statTotal) statTotal.textContent = String(stats.total || 0);
        if (statWaiting) statWaiting.textContent = String(stats.waiting || 0);
        if (statDone) statDone.textContent = String(stats.completed || 0);
        if (statBound) statBound.textContent = String(stats.bound || 0);
    }

    /* =========================
       05. 상태 필터
       ========================= */

    function renderFilterButtons() {
        filterAllBtn.classList.toggle('active', currentStatusFilter === 'all');
        filterWaitingBtn.classList.toggle('active', currentStatusFilter === 'waiting');
        filterCompleteBtn.classList.toggle('active', currentStatusFilter === 'complete');
    }

    function setStatusFilter(filter) {
        currentStatusFilter = filter;
        renderFilterButtons();
        setQueryState(getCurrentQuery());
        loadByCurrentQuery();
    }

    /* =========================
       06. 목록 렌더링
       ========================= */

    function render(items) {
        var sorted = sortByWorkNoAsc(items);

        if (!sorted || !sorted.length) {
            queueBody.innerHTML = '<tr><td colspan="5" class="muted td-empty">검색 결과가 없습니다.</td></tr>';
            mobileList.innerHTML = '<div class="mobile-item muted">검색 결과가 없습니다.</div>';
            return;
        }

        queueBody.innerHTML = sorted.map(function(item) {
            return [
                '<tr>',
                '<td><strong style="font-size: 30px;">#', escapeHtml(item.workNo), '</strong></td>',
                '<td>', escapeHtml(item.customerName || '-'), '</td>',
                '<td>', escapeHtml(item.phoneMasked || '-'), '</td>',
                '<td><span class="claim-chip ', item.claimStatus === '연결됨' ? 'claim-bound' : 'claim-none', '">', escapeHtml(item.claimStatus), '</span></td>',
                '<td><span class="state-chip ', item.status === '완료' ? 'state-complete' : 'state-waiting', '">', escapeHtml(item.status), '</span></td>',
                '</tr>'
            ].join('');
        }).join('');

        mobileList.innerHTML = sorted.map(function(item) {
            return [
                '<article class="mobile-item">',
                '<h3>#', escapeHtml(item.workNo), '</h3>',
                '<div class="mobile-meta">',
                '<div><strong>고객명</strong> ', escapeHtml(item.customerName || '-'), '</div>',
                '<div><strong>전화번호</strong> ', escapeHtml(item.phoneMasked || '-'), '</div>',
                '<div><strong>연결상태</strong> <span class="claim-chip ', item.claimStatus === '연결됨' ? 'claim-bound' : 'claim-none', '">', escapeHtml(item.claimStatus), '</span></div>',
                '<div><strong>진행상태</strong> <span class="state-chip ', item.status === '완료' ? 'state-complete' : 'state-waiting', '">', escapeHtml(item.status), '</span></div>',
                '</div>',
                '</article>'
            ].join('');
        }).join('');
    }

    /* =========================
       07. 로컬 검색 / 병합
       ========================= */

    function getLocalWorkNoItems(query) {
        var q = normalizeWorkNo(query);

        return allItemsCache.filter(function(item) {
            if (currentStatusFilter === 'waiting' && item.status !== '대기중') return false;
            if (currentStatusFilter === 'complete' && item.status !== '완료') return false;
            if (!q) return true;
            return String(item.workNo || '').indexOf(q) !== -1;
        });
    }

    function applyLocalWorkNoSearch() {
        var q = normalizeWorkNo(getCurrentQuery());

        if (searchInput.value !== q && currentMode === 'workNo') {
            searchInput.value = q;
        }

        var items = getLocalWorkNoItems(q);

        render(items);
        renderStats(buildStatsFromItems(items));
        updatedAt.textContent = '업데이트: ' + lastUpdatedAt;
        syncNote.textContent = '작업번호 로컬 검색 · 데이터 자동 갱신 10초';
    }

    function mergeItemsByWorkNo(localItems, serverItems) {
        var map = {};
        var merged = [];

        (localItems || []).forEach(function(item) {
            var key = String(item.workNo || '').trim() || JSON.stringify(item);
            if (!map[key]) {
                map[key] = true;
                merged.push(item);
            }
        });

        (serverItems || []).forEach(function(item) {
            var key = String(item.workNo || '').trim() || JSON.stringify(item);
            if (!map[key]) {
                map[key] = true;
                merged.push(item);
            }
        });

        return merged;
    }

    /* =========================
       08. 기본 데이터 로드
       ========================= */

    function loadBaseData() {
        return AppApi.jsonp({
                mode: 'public',
                statusFilter: 'all'
            })
            .then(function(res) {
                if (!res || !res.success) {
                    throw new Error((res && res.message) || '데이터를 불러오지 못했습니다.');
                }

                allItemsCache = sortByWorkNoAsc(res.items || []);
                lastUpdatedAt = res.updatedAt || '-';
                renderStats(res.stats || buildStatsFromItems(allItemsCache));

                if (currentMode === 'workNo') {
                    applyLocalWorkNoSearch();
                }
            });
    }

    /* =========================
       09. 서버 검색
       ========================= */

    function runServerSearch(mode) {
        var q = getCurrentQuery();
        var requestId = ++serverSearchRequestSeq;

        if (mode === 'phone') {
            q = normalizePhoneQuery(q);
            searchInput.value = q;
        }

        updatedAt.textContent = '불러오는 중...';
        syncNote.textContent = (mode === 'name' ? '이름' : '전화번호') + ' 서버 검색 중';

        return AppApi.jsonp({
                mode: 'public',
                searchType: mode,
                q: q,
                statusFilter: currentStatusFilter
            })
            .then(function(res) {
                if (!isLatestRequest(requestId)) return;
                if (!res || !res.success) {
                    throw new Error((res && res.message) || '검색 결과를 불러오지 못했습니다.');
                }

                renderStats(res.stats || buildStatsFromItems(res.items || []));
                render(res.items || []);
                updatedAt.textContent = '업데이트: ' + (res.updatedAt || '-');
                syncNote.textContent = (mode === 'name' ? '이름' : '전화번호') + ' 서버 검색 · 데이터 자동 갱신 10초';
            })
            .catch(function(err) {
                if (!isLatestRequest(requestId)) return;
                renderError(err.message || '불러오기 실패');
                updatedAt.textContent = '-';
                syncNote.textContent = '서버 검색 실패';
            });
    }

    function runHybridSearch() {
        var q = normalizeDigits(getCurrentQuery()).slice(0, 4);
        var requestId = ++serverSearchRequestSeq;
        var localItems = getLocalWorkNoItems(q);

        searchInput.value = q;
        updatedAt.textContent = '불러오는 중...';
        syncNote.textContent = '작업번호 + 전화번호 동시 검색 중';

        return AppApi.jsonp({
                mode: 'public',
                searchType: 'phone',
                q: q,
                statusFilter: currentStatusFilter
            })
            .then(function(res) {
                if (!isLatestRequest(requestId)) return;
                if (!res || !res.success) {
                    throw new Error((res && res.message) || '검색 결과를 불러오지 못했습니다.');
                }

                var mergedItems = mergeItemsByWorkNo(localItems, res.items || []);
                renderStats(buildStatsFromItems(mergedItems));
                render(mergedItems);
                updatedAt.textContent = '업데이트: ' + (res.updatedAt || lastUpdatedAt || '-');
                syncNote.textContent = '4자리 작업번호 + 전화번호 동시 검색 · 데이터 자동 갱신 10초';
            })
            .catch(function(err) {
                if (!isLatestRequest(requestId)) return;
                renderError(err.message || '불러오기 실패');
                updatedAt.textContent = '-';
                syncNote.textContent = '동시 검색 실패';
            });
    }

    /* =========================
       10. 검색 실행
       ========================= */

    function loadByCurrentQuery() {
        var q = getCurrentQuery();
        currentMode = inferSearchMode(q);
        setQueryState(q);

        if (currentMode === 'workNo') {
            serverSearchRequestSeq += 1;
            applyLocalWorkNoSearch();
            return Promise.resolve();
        }

        if (currentMode === 'hybrid') {
            return runHybridSearch();
        }

        return runServerSearch(currentMode);
    }

    function handleManualSearch() {
        if (serverSearchTimer) clearTimeout(serverSearchTimer);
        serverSearchTimer = setTimeout(loadByCurrentQuery, 120);
    }

    /* =========================
       11. 자동 갱신
       ========================= */

    function startAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);

        refreshTimer = setInterval(function() {
            loadBaseData()
                .then(function() {
                    if (currentMode === 'name' || currentMode === 'phone') {
                        return runServerSearch(currentMode);
                    }

                    if (currentMode === 'hybrid') {
                        return runHybridSearch();
                    }
                })
                .catch(function(err) {
                    syncNote.textContent = (err && err.message) ? err.message : '자동 갱신 중 오류가 발생했습니다.';
                });
        }, 10000);
    }

    /* =========================
       12. 초기 실행 / 이벤트 바인딩
       ========================= */
    document.addEventListener('DOMContentLoaded', function() {
        searchInput.value = getQueryValue('q') || '';
        currentStatusFilter = getQueryValue('status') || 'all';

        if (!/^(all|waiting|complete)$/.test(currentStatusFilter)) {
            currentStatusFilter = 'all';
        }

        renderFilterButtons();

        filterAllBtn.addEventListener('click', function() {
            setStatusFilter('all');
        });
        filterWaitingBtn.addEventListener('click', function() {
            setStatusFilter('waiting');
        });
        filterCompleteBtn.addEventListener('click', function() {
            setStatusFilter('complete');
        });

        searchBtn.addEventListener('click', loadByCurrentQuery);

        refreshBtn.addEventListener('click', function() {
            loadBaseData()
                .then(loadByCurrentQuery)
                .catch(function(err) {
                    renderError((err && err.message) || '데이터를 불러오지 못했습니다.');
                });
        });

        searchInput.addEventListener('input', function() {
            var mode = inferSearchMode(searchInput.value);

            if (mode === 'workNo') {
                searchInput.value = normalizeWorkNo(searchInput.value);
                currentMode = 'workNo';
                serverSearchRequestSeq += 1;
                applyLocalWorkNoSearch();
                setQueryState(searchInput.value);
                return;
            }

            if (mode === 'hybrid') {
                searchInput.value = normalizeDigits(searchInput.value).slice(0, 4);
                currentMode = 'hybrid';
                setQueryState(searchInput.value);
                return;
            }

            if (mode === 'phone') {
                searchInput.value = normalizePhoneQuery(searchInput.value);
            }

            currentMode = mode;
            setQueryState(searchInput.value);
        });

        searchInput.addEventListener('keydown', function(e) {
            if ((e.key || e.keyCode) === 'Enter' || (e.key || e.keyCode) === 13) {
                e.preventDefault();
                handleManualSearch();
            }
        });

        if (adminTrigger) {
            adminTrigger.addEventListener('click', handleAdminTriggerClick);
            adminTrigger.addEventListener('keydown', function(e) {
                var key = e && (e.key || e.keyCode);
                if (key === 'Enter' || key === ' ' || key === 13 || key === 32) {
                    e.preventDefault();
                    handleAdminTriggerClick();
                }
            });
        }

        loadBaseData()
            .then(loadByCurrentQuery)
            .catch(function(err) {
                renderError((err && err.message) || '데이터를 불러오지 못했습니다.');
            });

        startAutoRefresh();
    });
})();
