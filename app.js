function getDateTime() {
    let now = new Date()
    let d = String(now.getDate()).padStart(2, "0")
    let m = String(now.getMonth() + 1).padStart(2, "0")
    let y = now.getFullYear()
    let h = String(now.getHours()).padStart(2, "0")
    let min = String(now.getMinutes()).padStart(2, "0")
    return d + "/" + m + "/" + y + "  " + h + ":" + min
}

// Tính KL m³ từ list tấm — match công thức Excel lý lịch gỗ:
//   Mỗi cột dài: mid = ROUNDDOWN(SUM_widths × length × thickness / 10, 0) → cm³
//   Tổng: SUM(mid) / 10000 → m³ (4 chữ số chính xác)
// boards: [{l: dm, w: cm}], thickCm: cm. Khớp tuyệt đối với KL Excel cũ.
function calcVolumeFromBoards(boards, thickCm) {
    let t = parseFloat(thickCm) || 0
    if (!boards || !boards.length || t <= 0) return 0
    let byLen = {}
    for (let b of boards) {
        let l = parseFloat(b.l) || 0
        let w = parseFloat(b.w) || 0
        if (l <= 0 || w <= 0) continue
        byLen[l] = (byLen[l] || 0) + w
    }
    let midSum = 0
    for (let lStr in byLen) {
        midSum += Math.floor(byLen[lStr] * parseFloat(lStr) * t / 10)
    }
    return midSum / 10000
}

/* TURN */
let activeTurn = 1

function addNewTurn() {
    let lastTurnBoards = boards.filter(b => b.turn === currentTurn)
    if (lastTurnBoards.length < 1) {
        showToast("Lượt hiện tại chưa có tấm", "warning")
        return
    }
    currentTurn++
    activeTurn = currentTurn
    selectedLength = null
    document.querySelectorAll("#lengthGrid button")
        .forEach(x => x.classList.remove("selected"))
    widthGrid.classList.add("disabled")
    updateTurnSelect()
    showToast("Chuyển sang lượt " + currentTurn, "success")
}

function onTurnSelect() {
    activeTurn = parseInt(document.getElementById("turnSelect").value)
    showToast("Nhập vào lượt " + activeTurn, "success")
}

function updateTurnSelect() {
    let sel = document.getElementById("turnSelect")
    if (!sel) return
    sel.innerHTML = ""
    for (let t = currentTurn; t >= 1; t--) {
        let count = boards.filter(b => b.turn === t).length
        let opt = document.createElement("option")
        opt.value = t
        opt.innerText = "L" + t + " (" + count + ")"
        if (t === activeTurn) opt.selected = true
        sel.appendChild(opt)
    }
}

/* TOAST */
function showToast(msg, type = "success") {
    let t = document.getElementById("toast")
    t.innerText = msg
    t.className = "toast " + type
    t.style.display = "block"
    setTimeout(() => { t.style.display = "none" }, 2500)
}

/* CONFIRM MODAL */
function showConfirm(title, desc, onConfirm) {
    document.getElementById("modalTitle").innerText = title
    document.getElementById("modalDesc").innerText = desc
    document.getElementById("modalConfirmBtn").onclick = function () {
        closeConfirm()
        onConfirm()
    }
    document.getElementById("confirmModal").classList.add("open")
}

function closeConfirm() {
    document.getElementById("confirmModal").classList.remove("open")
    let inp = document.getElementById("modalInput")
    let err = document.getElementById("modalInputError")
    if (inp) { inp.style.display = "none"; inp.value = "" }
    if (err) err.style.display = "none"
}

function showConfirmWithInput(title, desc, placeholder, expectedValue, onConfirm) {
    document.getElementById("modalTitle").innerText = title
    document.getElementById("modalDesc").innerText = desc
    let inp = document.getElementById("modalInput")
    let err = document.getElementById("modalInputError")
    inp.style.display = "block"
    inp.value = ""
    inp.placeholder = placeholder
    err.style.display = "none"
    document.getElementById("modalConfirmBtn").onclick = function () {
        if (inp.value.trim().toLowerCase() !== expectedValue.toLowerCase()) {
            err.style.display = "block"
            err.innerText = 'Nhập "' + expectedValue + '" để xác nhận'
            inp.focus()
            if (navigator.vibrate) navigator.vibrate(100)
            return
        }
        closeConfirm()
        onConfirm()
    }
    document.getElementById("confirmModal").classList.add("open")
    setTimeout(() => inp.focus(), 200)
}

/* SUPABASE */
const SUPABASE_URL = "https://tscddgjkelnmlitzcxyg.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzY2RkZ2prZWxubWxpdHpjeHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzY3OTIsImV4cCI6MjA4OTE1Mjc5Mn0.ClRzHXGwMqRAc_ZMCGxBKfRJ5L2HmKdGMpzeFc9Mva0"
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
let currentUser = ""
let currentMeasurementType = "order_split" // 'order_split' | 'whole_bundle'

/* ===== ORIGINAL BAG — đối chiếu tấm soạn lẻ với list gốc ===== */
let originalBag = null          // Map<"l×w", count còn lại = gốc - đã bán>
let originalKeys = null         // Set<"l×w"> — các size TỪNG có ở gốc (kể cả đã bán hết)
let originalTotalCount = 0      // Tổng tấm trong gốc
let originalSoldCount = 0       // Tổng tấm đã bán qua các đơn trước
function bagKey(l, w) { return l + "×" + w }
/* Trả về null (OK/im lặng), "not_in_original", hoặc "sold_out" */
function checkBoardAgainstBag(l, w) {
    if (!originalBag) return null // không có gốc → im lặng
    let key = bagKey(l, w)
    let wasInOriginal = originalKeys && originalKeys.has(key)
    if (!wasInOriginal) return "not_in_original" // size chưa bao giờ có ở gốc
    let used = boards.filter(b => b.l === l && b.w === w).length
    let remaining = originalBag.get(key) || 0
    if (remaining - used <= 0) return "sold_out" // có gốc nhưng đã hết
    return null
}
function getMismatchCount() {
    return boards.filter(b => b.mismatch).length
}

/* ===== DEVICE CODE — mã thiết bị do admin quản lý ===== */
const DEVICE_CODE_KEY = "wood_device_code_hash"
const DEVICE_CACHE_KEY = "wood_device_cache"
const DEVICE_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 ngày
const DEVICE_FN_URL = SUPABASE_URL + "/functions/v1/device-manage"
const DEVICE_SECRET = "gth-device-secret-2026"

async function sha256(text) {
    let data = new TextEncoder().encode(text)
    let buf = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
}

function getDeviceCodeHash() { try { return localStorage.getItem(DEVICE_CODE_KEY) } catch { return null } }
function saveDeviceCodeHash(h) { try { localStorage.setItem(DEVICE_CODE_KEY, h) } catch {} }

function getCachedDevice() { try { return JSON.parse(localStorage.getItem(DEVICE_CACHE_KEY)) } catch { return null } }
function saveCachedDevice(status, id) { try { localStorage.setItem(DEVICE_CACHE_KEY, JSON.stringify({ status, id, checkedAt: Date.now() })) } catch {} }
function isCacheValid(c) { return c && c.checkedAt && (Date.now() - c.checkedAt < DEVICE_CACHE_MAX_AGE) }

async function getGeo() {
    try {
        let r = await fetch("http://ip-api.com/json/?fields=query,city,regionName,country", { signal: AbortSignal.timeout(3000) })
        let j = await r.json()
        return { ip: j.query || "", city: j.city || "", region: j.regionName || "", country: j.country || "" }
    } catch { return { ip: "", city: "", region: "", country: "" } }
}

async function verifyDeviceCode(codeHash) {
    let { data } = await sb.from("device_codes")
        .select("id, status").eq("code_hash", codeHash).eq("app_source", "wood-measure").maybeSingle()
    if (!data) return { status: "invalid" }
    return { status: data.status, id: data.id }
}

async function activateDeviceCode(codeHash) {
    let res = await fetch(DEVICE_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-secret": DEVICE_SECRET },
        body: JSON.stringify({ action: "activate_code", codeHash, appSource: "wood-measure", deviceInfo: { user_agent: navigator.userAgent }, activatedBy: "device" })
    })
    return await res.json()
}

async function logLogin(deviceCodeId, username) {
    let geo = await getGeo()
    sb.from("device_login_history").insert({
        device_code_id: deviceCodeId, username, app_source: "wood-measure",
        ip_address: geo.ip, city: geo.city, region: geo.region, country: geo.country, user_agent: navigator.userAgent
    }).then(() => {}).catch(() => {})
}

async function fetchRestrictionOn() {
    let { data } = await sb.from("device_settings").select("value").eq("key", "restriction_wood_measure").maybeSingle()
    return data?.value === true || data?.value === "true"
}

function showDeviceStatus(type) {
    let el = document.getElementById("deviceStatusMsg")
    let formEls = document.querySelectorAll("#accessInput, #accessBtn, .accessDesc")
    if (!el) return
    if (type === "blocked") {
        formEls.forEach(e => e.style.display = "none")
        el.style.display = "block"
        el.style.background = "#FEE2E2"
        el.style.border = "1px solid #EF4444"
        el.style.color = "#991B1B"
        el.innerHTML = "<b>Thiết bị chưa được kích hoạt</b><br>Liên hệ quản trị viên để nhập mã kích hoạt.<br><button onclick='retryAccess()' style='margin-top:10px;padding:8px 20px;border-radius:8px;border:none;background:#991B1B;color:#fff;font-weight:700;font-size:0.82rem;cursor:pointer'>Thử lại</button>"
    } else {
        el.style.display = "none"
        formEls.forEach(e => e.style.display = "")
    }
}

function retryAccess() {
    showDeviceStatus(null)
    document.getElementById("accessLoading").innerText = "Đang kiểm tra..."
    verifySavedAccess().finally(() => {
        document.getElementById("accessLoading").innerText = ""
    })
}

/** Kiểm tra mã thiết bị — trả về true nếu cho vào app */
async function checkDeviceCode(showBlockUI) {
    let restrictionOn = false
    try { restrictionOn = await Promise.race([fetchRestrictionOn(), new Promise((_, rej) => setTimeout(() => rej(), 3000))]) } catch {}
    if (!restrictionOn) return true

    // Restriction ON
    let savedHash = getDeviceCodeHash()
    if (!savedHash) {
        if (showBlockUI) showDeviceStatus("blocked")
        return false
    }

    try {
        let result = await Promise.race([verifyDeviceCode(savedHash), new Promise((_, rej) => setTimeout(() => rej(), 3000))])
        if (result.status === "active") {
            saveCachedDevice("active", result.id)
            return true
        }
        // Mã không còn hợp lệ
        localStorage.removeItem(DEVICE_CODE_KEY)
        localStorage.removeItem(DEVICE_CACHE_KEY)
        if (showBlockUI) showDeviceStatus("blocked")
        return false
    } catch {
        // Offline — dùng cache
        let cache = getCachedDevice()
        if (isCacheValid(cache) && cache.status === "active") return true
        if (showBlockUI) showDeviceStatus("blocked")
        return false
    }
}

/* ACCESS — v2: dùng Supabase */
const ACCESS_KEY = "woodAccessCode_v2"

async function validateAccessCode(code) {
    try {
        // Đọc device_codes (nguồn chính), khớp mã không phân biệt hoa thường, loại mã đã thu hồi
        let { data } = await sb.from("device_codes")
            .select("user_name, default_type, status")
            .ilike("code", code.trim())
            .eq("app_source", "wood-measure")
            .neq("status", "revoked")
            .limit(1)
        let row = data && data[0]
        if (row) {
            currentUser = row.user_name || ""
            currentMeasurementType = row.default_type || "order_split"
            updateMeasurementTypeUI()
            return true
        }
        return false
    } catch (e) {
        return false
    }
}

async function checkAccessCode() {
    let input = document.getElementById("accessInput")
    let btn = document.getElementById("accessBtn")
    let error = document.getElementById("accessError")
    let loading = document.getElementById("accessLoading")
    let code = input.value.trim()
    if (!code) { error.innerText = "Vui lòng nhập mã truy cập"; return }
    btn.disabled = true
    loading.innerText = "Đang kiểm tra..."
    error.innerText = ""
    showDeviceStatus(null)

    let ok = await validateAccessCode(code)
    if (!ok) {
        btn.disabled = false; loading.innerText = ""
        error.innerText = "Mã không hợp lệ"
        if (navigator.vibrate) navigator.vibrate(200)
        input.focus()
        return
    }

    // Access code hợp lệ → migrate ngầm: hash access code làm device code
    let codeHash = await sha256(code.toLowerCase().trim())
    let savedHash = getDeviceCodeHash()
    if (!savedHash) {
        // Thiết bị chưa có device code → tự gán từ access code (migrate ngầm)
        saveDeviceCodeHash(codeHash)
        // Kích hoạt nếu chưa active
        activateDeviceCode(codeHash).catch(() => {})
    }

    // Device code check
    let deviceOk = await checkDeviceCode(true)
    btn.disabled = false; loading.innerText = ""
    if (deviceOk) {
        localStorage.setItem(ACCESS_KEY, JSON.stringify({ code: code.toLowerCase().trim(), user: currentUser, defaultType: currentMeasurementType }))
        document.getElementById("accessScreen").style.display = "none"
        // Ghi lịch sử
        let hash = getDeviceCodeHash()
        if (hash) verifyDeviceCode(hash).then(r => { if (r.id) logLogin(r.id, currentUser) }).catch(() => {})
    }
}

async function verifySavedAccess() {
    let raw = localStorage.getItem(ACCESS_KEY)
    if (!raw) {
        document.getElementById("accessScreen").style.display = "flex"
        setTimeout(() => accessInput.focus(), 200)
        return
    }
    try {
        let saved = JSON.parse(raw)
        // Validate access code (online) or fallback (offline)
        let ok = false
        try { ok = await Promise.race([validateAccessCode(saved.code), new Promise((_, rej) => setTimeout(() => rej(), 3000))]) } catch {
            currentUser = saved.user || ""
            currentMeasurementType = saved.defaultType || "order_split"
            ok = true
        }
        if (!ok) {
            localStorage.removeItem(ACCESS_KEY)
            document.getElementById("accessScreen").style.display = "flex"
            setTimeout(() => accessInput.focus(), 200)
            return
        }

        // Migrate ngầm: nếu chưa có device code hash → tạo từ access code
        if (!getDeviceCodeHash()) {
            let codeHash = await sha256(saved.code)
            saveDeviceCodeHash(codeHash)
            activateDeviceCode(codeHash).catch(() => {})
        }

        // Device code check
        let deviceOk = await checkDeviceCode(true)
        if (deviceOk) {
            document.getElementById("accessScreen").style.display = "none"
            // Ghi lịch sử
            let hash = getDeviceCodeHash()
            if (hash) verifyDeviceCode(hash).then(r => { if (r.id) logLogin(r.id, currentUser) }).catch(() => {})
        } else {
            document.getElementById("accessScreen").style.display = "flex"
        }
    } catch (e) {
        localStorage.removeItem(ACCESS_KEY)
        document.getElementById("accessScreen").style.display = "flex"
        setTimeout(() => accessInput.focus(), 200)
    }
}

/* WOOD TYPE PICKER — load danh sách gỗ từ DB */
async function loadWoodTypes() {
    try {
        let { data } = await sb.from("wood_types").select("id, name").order("name")
        woodTypeList = (data || []).map(w => ({ id: w.id, name: w.name }))
        renderWoodTypeDropdown()
    } catch (e) { /* silent */ }
}

function renderWoodTypeDropdown() {
    // stub — suggest list updates on input/focus
}

function selectWoodType(id, name) {
    selectedWoodId = id
    woodType.value = name.toUpperCase()
    hideWoodSuggest()
    saveState()
}

function showWoodSuggest() {
    updateWoodSuggest(woodType.value)
}

function onWoodTypeInput(val) {
    selectedWoodId = "" // clear selection khi user gõ tay
    updateWoodSuggest(val)
}

function updateWoodSuggest(query) {
    let container = document.getElementById("woodSuggestList")
    if (!container) return
    container.innerHTML = ""
    let q = (query || "").toLowerCase().trim()
    let filtered = q ? woodTypeList.filter(w => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q)) : woodTypeList
    if (!filtered.length) {
        container.classList.remove("open")
        return
    }
    filtered.forEach(w => {
        let item = document.createElement("div")
        item.className = "woodSuggestItem" + (selectedWoodId === w.id ? " active" : "")
        item.innerText = w.name
        item.onmousedown = function (e) { e.preventDefault() } // prevent blur
        item.onclick = function () { selectWoodType(w.id, w.name) }
        container.appendChild(item)
    })
    container.classList.add("open")
}

function hideWoodSuggest() {
    let container = document.getElementById("woodSuggestList")
    if (container) container.classList.remove("open")
}

// Ẩn suggest khi blur (trừ khi click vào item)
document.addEventListener("click", function (e) {
    if (!e.target.closest("#woodType") && !e.target.closest("#woodSuggestList")) {
        hideWoodSuggest()
    }
})

/* SYNC lên hệ thống */
function calcVolume() {
    // Excel-compat (khớp Lý lịch gỗ cũ) — group by length, ROUNDDOWN per length, sum, /10000
    return calcVolumeFromBoards(boards, thickness.value)
}

async function syncToSystem() {
    if (!currentUser) return { ok: false, reason: "Chưa đăng nhập (thiếu tên người đo)" }
    if (!currentSessionId || boards.length === 0) return { ok: false, reason: "Chưa có dữ liệu để đồng bộ" }
    try {
        // session_id unique per kiện (tạo 1 lần khi startMeasure, reset khi "Kiện mới")
        // Cùng session chia sẻ lại → upsert update (cập nhật số tấm/khối lượng)
        // Khác session cùng mã kiện → tạo record mới (soạn lẻ cho khách khác)
        let { error } = await sb.from("bundle_measurements").upsert({
            session_id: currentSessionId,
            bundle_code: bundle.value.trim(),
            wood_type: woodType.value.trim(),
            wood_id: selectedWoodId || null,
            thickness: parseFloat(thickness.value) || 0,
            quality: quality.value.trim(),
            boards: boards,
            board_count: boards.length,
            volume: calcVolume(),
            measured_by: currentUser,
            measurement_type: currentMeasurementType,
            bundle_check: document.getElementById("bundleStatus").value || "-",
            mismatch_count: getMismatchCount(),
            status: "chờ gán",
            deleted: false,
            updated_at: new Date().toISOString()
        }, { onConflict: "session_id" })
        if (error) return { ok: false, reason: error.message }
        return { ok: true }
    } catch (e) {
        return { ok: false, reason: e.message || "Lỗi kết nối" }
    }
}

/* Measurement type toggle */
function updateMeasurementTypeUI() {
    let chk = document.getElementById("measureTypeCheck")
    let labelNK = document.querySelector("#measureTypeCheck")?.parentElement?.previousElementSibling
    let labelSL = document.querySelector("#measureTypeCheck")?.parentElement?.nextElementSibling
    if (!chk) return
    let isWhole = currentMeasurementType === "whole_bundle"
    chk.checked = !isWhole
    if (labelNK) labelNK.style.color = isWhole ? "#3D2010" : "#9A8878"
    if (labelNK) labelNK.style.fontWeight = isWhole ? "700" : "500"
    if (labelSL) labelSL.style.color = !isWhole ? "#3D2010" : "#9A8878"
    if (labelSL) labelSL.style.fontWeight = !isWhole ? "700" : "500"
    // Ẩn/hiện dropdown tình trạng kiện: chỉ hiện khi soạn lẻ
    let bs = document.getElementById("bundleStatus")
    if (bs) {
        bs.style.display = isWhole ? "none" : ""
        if (isWhole) bs.value = "-"
    }
}
function onMeasureTypeToggle() {
    let chk = document.getElementById("measureTypeCheck")
    let newType = chk.checked ? "order_split" : "whole_bundle"
    let isWhole = newType === "whole_bundle"
    let label = isWhole ? "Kiện nguyên (nhập kho)" : "Soạn lẻ (đơn hàng)"
    let keyword = isWhole ? "nguyên" : "lẻ"
    // revert toggle ngay, chỉ apply khi confirm thành công
    chk.checked = !chk.checked
    showConfirmWithInput(
        "Đổi loại kiện",
        'Chuyển sang: ' + label + '\nNhập "' + keyword + '" để xác nhận.',
        keyword,
        keyword,
        function () {
            currentMeasurementType = newType
            updateMeasurementTypeUI()
            saveState()
        }
    )
}

/* Load list gốc (từ wood_bundles.raw_measurements.boards) + tấm đã bán → bag còn lại */
async function loadOriginalBag(bundleCode) {
    originalBag = null
    originalKeys = null
    originalTotalCount = 0
    originalSoldCount = 0
    let bagEl = document.getElementById("bundleBagStatus")
    if (bagEl) bagEl.innerHTML = ""
    if (!bundleCode) return
    try {
        /* Lấy list gốc từ wood_bundles (raw_measurements.boards) */
        let { data: bundle } = await sb.from("wood_bundles")
            .select("id, raw_measurements")
            .eq("bundle_code", bundleCode)
            .limit(1)
            .maybeSingle()
        let gốcBoards = bundle?.raw_measurements?.boards
        if (!Array.isArray(gốcBoards) || gốcBoards.length === 0) return
        /* Lấy tất cả bundle_measurements đã gán cho bundle này (cả order_split + whole_bundle khi đem bán) */
        let { data: đã } = await sb.from("bundle_measurements")
            .select("boards")
            .eq("bundle_id", bundle.id)
            .eq("status", "đã gán")
            .eq("deleted", false)
            .not("order_id", "is", null)
        let bag = new Map()
        let keys = new Set()
        gốcBoards.forEach(b => {
            let k = bagKey(b.l, b.w)
            bag.set(k, (bag.get(k) || 0) + 1)
            keys.add(k)
        })
        originalTotalCount = gốcBoards.length
        ;(đã || []).forEach(row => {
            ;(row.boards || []).forEach(b => {
                let k = bagKey(b.l, b.w)
                bag.set(k, (bag.get(k) || 0) - 1)
                originalSoldCount++
            })
        })
        originalBag = bag
        originalKeys = keys
        renderBagStatus()
    } catch (e) {
        /* im lặng — không có gốc thì thôi */
    }
}

function renderBagStatus() {
    let bagEl = document.getElementById("bundleBagStatus")
    if (!bagEl) return
    if (!originalBag) { bagEl.innerHTML = ""; return }
    let remaining = originalTotalCount - originalSoldCount
    if (remaining <= 0) {
        bagEl.innerHTML = "<span style='color:#92400E;font-weight:600'>⚠ Kiện gốc đã bán hết " + originalSoldCount + "/" + originalTotalCount + " tấm — tấm đo thêm sẽ báo không khớp</span>"
    } else {
        let soldMsg = originalSoldCount > 0 ? " (đã bán " + originalSoldCount + " tấm)" : ""
        bagEl.innerHTML = "<span style='color:#1E5C38;font-weight:600'>📦 Kiện gốc " + originalTotalCount + " tấm · còn " + remaining + " tấm" + soldMsg + "</span>"
    }
}

/* LOOKUP mã kiện NCC → auto-fill loại gỗ, dày, chất lượng */
let lastLookupCode = ""
async function lookupBundle() {
    let code = bundle.value.trim()
    if (!code || code === lastLookupCode) return
    if (currentMeasurementType === "whole_bundle") return // kiện nguyên không cần lookup
    lastLookupCode = code
    let statusEl = document.getElementById("bundleLookupStatus")
    statusEl.innerHTML = "<span style='color:#9A8878'>Đang tìm...</span>"
    try {
        /* Tìm theo bundle_code */
        let { data, error: e1 } = await sb.from("wood_bundles")
            .select("bundle_code, wood_id, attributes")
            .eq("bundle_code", code)
            .limit(1)
            .maybeSingle()
        if (e1) console.log("lookup err:", e1.message)
        if (data) {
            /* Lấy tên gỗ tiếng Việt từ wood_types */
            let wName = data.wood_id || ""
            try {
                let { data: wt } = await sb.from("wood_types").select("name").eq("id", data.wood_id).single()
                if (wt) wName = wt.name
            } catch (e2) {}
            let attrs = data.attributes || {}
            let thick = attrs.thickness || ""
            let qual = attrs.quality || ""
            if (wName) {
                woodType.value = wName.toUpperCase()
                selectedWoodId = data.wood_id || ""
                renderWoodTypeDropdown()
            }
            if (thick) {
                /* Thickness lưu dạng "2F" — lấy số trước ký tự F */
                let match = thick.match(/^([\d.]+)/)
                if (match) thickness.value = match[1]
                else thickness.value = thick
            }
            if (qual) quality.value = qual.toUpperCase()
            statusEl.innerHTML = "<span style='color:#1E5C38'>✓ " + wName + " · " + thick + " · " + qual + "</span>"
            saveState()
        } else {
            statusEl.innerHTML = "<span style='color:#92400E'>Không tìm thấy — nhập thủ công</span>"
        }
    } catch (e) {
        statusEl.innerHTML = "<span style='color:#92400E'>Không tìm thấy — nhập thủ công</span>"
    }
    /* Load list gốc của kiện để đối chiếu khi đo lẻ */
    if (currentMeasurementType === "order_split") {
        loadOriginalBag(code)
    }
}

/* STATE */
let boards = []
let selectedLength = null
let grid = 6
let currentTurn = 1
let lenMin = 20
let lenMax = 35
let widMin = 15
let widMax = 35
let woodUS = false
let currentSessionId = null
const MAX_SAVED_LISTS = 30
let woodTypeList = [] // [{id, name}] từ DB
let selectedWoodId = "" // wood_id đã chọn

/* LOCAL STORAGE */
function saveState() {
    let state = {
        boards: boards,
        currentTurn: currentTurn,
        grid: grid,
        lenMin: lenMin,
        lenMax: lenMax,
        widMin: widMin,
        widMax: widMax,
        woodUS: woodUS,
        bundle: bundle.value,
        woodType: woodType.value,
        thickness: thickness.value,
        quality: quality.value,
        sessionId: currentSessionId,
        measurementType: currentMeasurementType,
        woodId: selectedWoodId,
        bundleStatus: document.getElementById("bundleStatus")?.value || "-"
    }
    localStorage.setItem("woodMeasureState", JSON.stringify(state))
    /* Realtime sync vào saved lists */
    if (currentSessionId && boards.length > 0) {
        updateSavedSession()
    }
}
function loadState() {
    let raw = localStorage.getItem("woodMeasureState")
    if (!raw) return
    try {
        let state = JSON.parse(raw)
        boards = state.boards || []
        boards.forEach(b => {
            if (!b.turn) b.turn = 1
        })

        currentTurn = state.currentTurn || 1

        if (boards.length > 0) {
            currentTurn = Math.max(...boards.map(b => b.turn))
        }
        activeTurn = currentTurn
        grid = state.grid || 6
        lenMin = state.lenMin || 20
        lenMax = state.lenMax || 35
        widMin = state.widMin || 15
        widMax = state.widMax || 35
        woodUS = state.woodUS || false
        currentSessionId = state.sessionId || null
        bundle.value = state.bundle || ""
        woodType.value = state.woodType || ""
        thickness.value = state.thickness || ""
        quality.value = state.quality || ""
        document.getElementById("woodUS").checked = woodUS
        gridCount.innerText = grid
        if (state.measurementType) {
            currentMeasurementType = state.measurementType
            updateMeasurementTypeUI()
        }
        if (state.woodId) {
            selectedWoodId = state.woodId
            renderWoodTypeDropdown()
        }
        if (state.bundleStatus) {
            let sel = document.getElementById("bundleStatus")
            if (sel) sel.value = state.bundleStatus
        }
    } catch (e) { }
}

/* SAVED LISTS */
function getSavedLists() {
    try {
        return JSON.parse(localStorage.getItem("woodSavedLists")) || []
    } catch (e) { return [] }
}
function saveLists(lists) {
    localStorage.setItem("woodSavedLists", JSON.stringify(lists))
}

function buildSessionData() {
    return {
        id: currentSessionId || Date.now(),
        bundle: bundle.value,
        woodType: woodType.value,
        thickness: thickness.value,
        quality: quality.value,
        woodUS: woodUS,
        boards: boards,
        currentTurn: currentTurn,
        grid: grid,
        lenMin: lenMin,
        lenMax: lenMax,
        widMin: widMin,
        widMax: widMax,
        updatedAt: Date.now()
    }
}

function saveCurrentSession() {
    if (boards.length === 0) return
    if (!currentSessionId) currentSessionId = Date.now()
    let lists = getSavedLists()
    let idx = lists.findIndex(s => s.id === currentSessionId)
    let session = buildSessionData()
    if (idx >= 0) {
        lists[idx] = session
    } else {
        if (lists.length >= MAX_SAVED_LISTS) {
            lists.shift()
            showToast("Đã xóa list cũ nhất (tối đa " + MAX_SAVED_LISTS + ")", "warning")
        }
        lists.push(session)
    }
    saveLists(lists)
}

function updateSavedSession() {
    if (!currentSessionId) return
    let lists = getSavedLists()
    let idx = lists.findIndex(s => s.id === currentSessionId)
    if (idx >= 0) {
        lists[idx] = buildSessionData()
        saveLists(lists)
    }
}

function loadSession(id) {
    let lists = getSavedLists()
    let session = lists.find(s => s.id === id)
    if (!session) return
    boards = session.boards || []
    boards.forEach(b => { if (!b.turn) b.turn = 1 })
    currentTurn = session.currentTurn || 1
    if (boards.length > 0) {
        currentTurn = Math.max(...boards.map(b => b.turn))
    }
    activeTurn = currentTurn
    grid = session.grid || 6
    lenMin = session.lenMin || 20
    lenMax = session.lenMax || 35
    widMin = session.widMin || 15
    widMax = session.widMax || 35
    woodUS = session.woodUS || false
    currentSessionId = session.id
    bundle.value = session.bundle || ""
    woodType.value = session.woodType || ""
    thickness.value = session.thickness || ""
    quality.value = session.quality || ""
    document.getElementById("woodUS").checked = woodUS
    gridCount.innerText = grid
    updateHeader()
    rebuild()
    go("measure")
    updateSummary()
    renderList()
    saveState()
    closeSavedLists()
    showToast("Đã mở: " + (session.bundle || ""), "success")
}

function deleteSavedSession(id) {
    let lists = getSavedLists()
    lists = lists.filter(s => s.id !== id)
    saveLists(lists)
    if (currentSessionId === id) currentSessionId = null
    renderSavedLists()
}

function formatDate(ts) {
    let d = new Date(ts)
    return String(d.getDate()).padStart(2, "0") + "/" +
        String(d.getMonth() + 1).padStart(2, "0") + "/" +
        d.getFullYear() + " " +
        String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0")
}

function showSavedLists() {
    renderSavedLists()
    document.getElementById("savedListsPanel").style.display = "block"
}

function closeSavedLists() {
    document.getElementById("savedListsPanel").style.display = "none"
}

function renderSavedLists() {
    let el = document.getElementById("savedListsContent")
    let lists = getSavedLists()
    if (lists.length === 0) {
        el.innerHTML = "<div style='color:#9A8878;font-size:13px;padding:8px 0'>Chưa có lịch sử</div>"
        return
    }
    let html = ""
    lists.slice().reverse().forEach(s => {
        let info = [s.bundle, s.woodType, s.thickness ? s.thickness + "F" : "", s.quality]
            .filter(v => v).join(" · ")
        let active = s.id === currentSessionId ? " savedListActive" : ""
        html += "<div class='savedListRow" + active + "'>"
        html += "<div class='savedListInfo' onclick='loadSession(" + s.id + ")'>"
        html += "<div class='savedListTitle'>" + (info || "Không tên") + "</div>"
        html += "<div class='savedListMeta'>" + s.boards.length + " tấm · " + formatDate(s.updatedAt) + "</div>"
        html += "</div>"
        html += "<button class='deleteBoardBtn' onclick='confirmDeleteSession(" + s.id + ")'>×</button>"
        html += "</div>"
    })
    el.innerHTML = html
}

function confirmDeleteSession(id) {
    showConfirm("Xóa lịch sử", "List này sẽ bị xóa vĩnh viễn.", function () {
        deleteSavedSession(id)
    })
}

/* NAV */
function go(screen) {
    document.querySelectorAll(".screen").forEach(s => {
        s.classList.remove("active")
    })
    document.getElementById(screen).classList.add("active")
}

/* SPEAK */
function speakNumber(n) {
    if (!window.speechSynthesis) return
    speechSynthesis.cancel()
    const digits = [
        "không", "một", "hai", "ba", "bốn",
        "năm", "sáu", "bảy", "tám", "chín"
    ]
    function readInt(num) {
        if (num < 10) return digits[num]
        if (num == 10) return "mười"
        if (num < 20) {
            return "mười " + digits[num % 10]
        }
        let tens = Math.floor(num / 10)
        let unit = num % 10
        if (unit == 0) return digits[tens] + " mươi"
        if (unit == 1) return digits[tens] + " mốt"
        return digits[tens] + " " + digits[unit]
    }
    let text = ""
    let s = n.toString()
    if (s.includes(".")) {
        let parts = s.split(".")
        text = readInt(parseInt(parts[0])) + " phẩy " +
            parts[1].split("").map(d => digits[d]).join(" ")
    } else {
        text = readInt(parseInt(s))
    }
    let utter = new SpeechSynthesisUtterance(text)
    utter.lang = "vi-VN"
    utter.rate = 1.3
    speechSynthesis.speak(utter)
}

/* GRID */
function gridMinus() { if (grid > 4) grid--; gridCount.innerText = grid; saveState() }
function gridPlus() { if (grid < 8) grid++; gridCount.innerText = grid; saveState() }

/* WOOD US */
function toggleWoodUS() {
    woodUS = document.getElementById("woodUS").checked
    if (woodUS) {
        lenMin = 22
        lenMax = 25
        widMin = 15
        widMax = 25
    } else {
        lenMin = 20
        lenMax = 35
        widMin = 15
        widMax = 35
    }
    saveState()
}

/* START */
function startMeasure() {
    if (bundle.value.trim() == "") {
        alert("Vui lòng nhập mã kiện")
        bundle.focus()
        return
    }
    if (thickness.value.trim() == "") {
        alert("Vui lòng nhập độ dày")
        thickness.focus()
        return
    }
    if (isNaN(thickness.value)) {
        alert("Độ dày phải là số")
        thickness.focus()
        return
    }
    if (!currentSessionId) currentSessionId = Date.now()
    updateHeader()
    rebuild()
    go("measure")
    updateSummary()
    renderList()
    saveState()
}

/* HEADER */
function updateHeader() {
    let info = [bundle.value, woodType.value, thickness.value + "F", quality.value]
        .filter(v => v != "")
        .join(" • ")
    headerInfo.innerText = info
}

/* EDIT RANGE — tap vào số min/max để nhập trực tiếp */
function getRangeVar(name) {
    if (name === "lenMin") return lenMin
    if (name === "lenMax") return lenMax
    if (name === "widMin") return widMin
    if (name === "widMax") return widMax
}
function setRangeVar(name, val) {
    if (name === "lenMin") lenMin = val
    else if (name === "lenMax") lenMax = val
    else if (name === "widMin") widMin = val
    else if (name === "widMax") widMax = val
}
function editRange(varName) {
    let labelEl = document.getElementById(varName + "Label")
    let currentVal = getRangeVar(varName)
    let input = document.createElement("input")
    input.type = "number"
    input.value = currentVal
    input.className = "rangeInput"
    input.id = varName + "Label"
    labelEl.replaceWith(input)
    input.focus()
    input.select()
    let applied = false
    function apply() {
        if (applied) return
        applied = true
        let val = parseInt(input.value)
        if (!isNaN(val) && val >= 0) {
            setRangeVar(varName, val)
        }
        rebuild()
        saveState()
    }
    input.onblur = apply
    input.onkeydown = function (e) {
        if (e.key === "Enter") { input.blur() }
    }
}

/* TAB STATE */
let lenActiveTab = "all"
let widActiveTab = "all"
const TAB_THRESHOLD = 24

/* BUILD GRID */
function rebuild() {
    setRangeLabel("lenMin", lenMin)
    setRangeLabel("lenMax", lenMax)
    setRangeLabel("widMin", widMin)
    setRangeLabel("widMax", widMax)
    createButtons()
    saveState()
}

function setRangeLabel(varName, value) {
    let el = document.getElementById(varName + "Label")
    if (!el || el.tagName === "INPUT") {
        let span = document.createElement("span")
        span.id = varName + "Label"
        span.className = "rangeVal"
        span.onclick = function () { editRange(varName) }
        span.innerText = value
        if (el) el.replaceWith(span)
    } else {
        el.innerText = value
    }
}

function buildValues(min, max, isUS) {
    let values = []
    for (let i = min; i <= max; i++) {
        values.push(i)
        if (isUS) {
            values.push(Number((i + 0.3).toFixed(1)))
            values.push(Number((i + 0.5).toFixed(1)))
            values.push(Number((i + 0.7).toFixed(1)))
        }
    }
    return values
}

function buildWidthValues(min, max, isUS) {
    let values = []
    for (let i = min; i <= max; i++) {
        values.push(i)
        if (isUS) {
            values.push(Number((i + 0.5).toFixed(1)))
        }
    }
    return values
}

function getDecadeTabs(values) {
    let decades = [...new Set(values.map(v => Math.floor(v / 10) * 10))]
    decades.sort((a, b) => a - b)
    return decades
}

function renderTabs(tabBarId, values, activeTab, onSelect) {
    let tabBar = document.getElementById(tabBarId)
    tabBar.innerHTML = ""
    if (values.length <= TAB_THRESHOLD) return
    let decades = getDecadeTabs(values)
    decades.forEach(d => {
        let btn = document.createElement("button")
        btn.className = "tabBtn" + (activeTab === d ? " activeTab" : "")
        btn.innerText = d + "s"
        btn.onclick = () => onSelect(d)
        tabBar.appendChild(btn)
    })
}

function createButtons() {
    lengthGrid.innerHTML = ""
    widthGrid.innerHTML = ""
    lengthGrid.style.gridTemplateColumns = "repeat(" + grid + ",1fr)"
    widthGrid.style.gridTemplateColumns = "repeat(" + grid + ",1fr)"

    /* Dài */
    let allLengths = buildValues(lenMin, lenMax, woodUS)
    renderTabs("lenTabs", allLengths, lenActiveTab, function (d) {
        lenActiveTab = d; createButtons()
    })
    let lengths = allLengths
    if (allLengths.length > TAB_THRESHOLD) {
        if (lenActiveTab === "all") lenActiveTab = getDecadeTabs(allLengths)[0]
        lengths = allLengths.filter(v => Math.floor(v / 10) * 10 === lenActiveTab)
    }

    lengths.forEach(v => {
        let b = document.createElement("button")
        b.innerText = v
        if (woodUS && Number.isInteger(v)) {
            b.classList.add("usWhole")
        }
        if (v === selectedLength) b.classList.add("selected")
        b.onclick = () => {
            speakNumber(v)
            selectedLength = v
            document.querySelectorAll("#lengthGrid button")
                .forEach(x => x.classList.remove("selected"))
            b.classList.add("selected")
            widthGrid.classList.remove("disabled")
        }
        lengthGrid.appendChild(b)
    })

    /* Rộng */
    let allWidths = buildWidthValues(widMin, widMax, woodUS)
    renderTabs("widTabs", allWidths, widActiveTab, function (d) {
        widActiveTab = d; createButtons()
    })
    let widths = allWidths
    if (allWidths.length > TAB_THRESHOLD) {
        if (widActiveTab === "all") widActiveTab = getDecadeTabs(allWidths)[0]
        widths = allWidths.filter(v => Math.floor(v / 10) * 10 === widActiveTab)
    }

    widths.forEach(v => {
        let b = document.createElement("button")
        b.innerText = v
        if (woodUS && Number.isInteger(v)) {
            b.classList.add("usWhole")
        }
        b.onclick = () => {
            if (selectedLength == null) return
            speakNumber(v)
            let mismatch = checkBoardAgainstBag(selectedLength, v)
            let newBoard = { l: selectedLength, w: v, turn: activeTurn }
            if (mismatch) newBoard.mismatch = mismatch
            boards.push(newBoard)
            if (mismatch) {
                let reason = mismatch === "not_in_original"
                    ? "không có trong kiện gốc"
                    : "đã bán hết"
                showToast("⚠ " + selectedLength + " × " + v + " " + reason, "warning")
                if (navigator.vibrate) navigator.vibrate(80)
            }
            selectedLength = null
            document.querySelectorAll("#lengthGrid button")
                .forEach(x => x.classList.remove("selected"))
            widthGrid.classList.add("disabled")
            updateSummary()
            renderList(true)
            saveState()
        }
        widthGrid.appendChild(b)
    })
}

/* SUMMARY */
function updateSummary() {
    let vol = calcVolumeFromBoards(boards, thickness.value) // Excel-compat
    summary.innerText = boards.length + " tấm • " + vol.toFixed(4) + " m³"
}

/* LIST */
function renderList(highlightNew) {
    boardList.innerHTML = ""
    document.getElementById("turnSummary").innerHTML = ""
    if (boards.length === 0) return
    let lastIndex = highlightNew ? boards.length - 1 : -1
    let groups = {}
    boards.forEach(b => {
        if (!groups[b.turn]) groups[b.turn] = []
        groups[b.turn].push(b)
    })
    let turns = Object.keys(groups).sort((a, b) => b - a)
    turns.forEach(turn => {
        let arr = groups[turn]
        let header = document.createElement("div")
        header.className = "turnHeader"
        header.innerText = "Lượt " + turn + "  ·  " + arr.length + " tấm"
        boardList.appendChild(header)
        arr.slice().reverse().forEach((b) => {
            let index = boards.indexOf(b)
            let row = document.createElement("div")
            let mismatchCls = b.mismatch ? " boardMismatch" : ""
            row.className = "boardRow" + (index === lastIndex ? " newBoard" : "") + mismatchCls
            let warn = b.mismatch ? "<span class='boardWarn'>⚠</span> " : ""
            row.innerHTML =
                "<span>" + warn + b.l + " × " + b.w + "</span>" +
                "<button class='deleteBoardBtn' onclick='deleteBoard(" + index + ")'>×</button>"
            boardList.appendChild(row)
        })
    })
    renderTurnSummary(groups)
    updateTurnSelect()
}
function renderTurnSummary(groups) {
    let el = document.getElementById("turnSummary")
    el.innerHTML = ""
    let turns = Object.keys(groups).sort((a, b) => b - a)
    turns.forEach(turn => {
        let row = document.createElement("div")
        row.className = "turnSummaryRow"
        row.innerHTML = "<span class='turnSummaryLabel'>L" + turn + "</span>" +
            "<span class='turnSummaryVal'>" + groups[turn].length + " tấm</span>"
        el.appendChild(row)
    })
}
function deleteBoard(i) {
    let removed = boards[i]
    boards.splice(i, 1)
    updateSummary()
    renderList()
    saveState()
    showUndoToast("Đã xóa tấm " + removed.l + " × " + removed.w, () => {
        boards.splice(i, 0, removed)
        updateSummary()
        renderList()
        saveState()
    })
}

let _undoToastTimer = null
function showUndoToast(msg, onUndo) {
    let t = document.getElementById("undoToast")
    if (!t) {
        t = document.createElement("div")
        t.id = "undoToast"
        t.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1C1209;color:#fff;padding:10px 14px 10px 18px;border-radius:12px;display:none;z-index:99999;font-size:14px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,0.25);align-items:center;gap:14px;max-width:90vw"
        document.body.appendChild(t)
    }
    if (_undoToastTimer) clearTimeout(_undoToastTimer)
    t.innerHTML = ""
    let span = document.createElement("span")
    span.innerText = msg
    let btn = document.createElement("button")
    btn.innerText = "Hoàn tác"
    btn.style.cssText = "background:transparent;color:#F26522;border:none;font-size:14px;font-weight:700;padding:4px 8px;cursor:pointer;border-radius:6px;flex-shrink:0"
    btn.onclick = () => {
        onUndo()
        t.style.display = "none"
        if (_undoToastTimer) clearTimeout(_undoToastTimer)
    }
    t.appendChild(span)
    t.appendChild(btn)
    t.style.display = "flex"
    _undoToastTimer = setTimeout(() => { t.style.display = "none" }, 5000)
}
function confirmResetBoards() {
    showConfirm("Lưu & Reset", "Session hiện tại sẽ được lưu vào lịch sử và bắt đầu kiện mới.", resetBoards)
}
function resetBoards() {
    /* Lưu session hiện tại trước khi reset */
    saveCurrentSession()
    boards = []
    currentTurn = 1
    activeTurn = 1
    currentSessionId = null
    selectedLength = null
    document.querySelectorAll("#lengthGrid button")
        .forEach(x => x.classList.remove("selected"))
    widthGrid.classList.add("disabled")
    bundle.value = ""
    woodType.value = ""
    selectedWoodId = ""
    thickness.value = ""
    quality.value = ""
    let bsSel = document.getElementById("bundleStatus")
    if (bsSel) bsSel.value = "-"
    renderWoodTypeDropdown()
    updateSummary()
    renderList()
    saveState()
    go("setup")
    showToast("Đã lưu & reset", "success")
}
function undo() { boards.pop(); updateSummary(); renderList(); saveState() }

/* MATRIX */
function showMatrix() {
    updateMatrixHeader()
    document.getElementById("matrixDate").innerText = getDateTime()
    renderMatrix()
    go("matrix")
}
function updateMatrixHeader() {
    let vol = calcVolumeFromBoards(boards, thickness.value) // Excel-compat
    let info = [bundle.value, woodType.value, thickness.value + "F", quality.value]
        .filter(v => v != "")
        .join(" • ")
    matrixHeader.innerText = info
    matrixPieces.innerText = boards.length + " tấm"
    matrixVolume.innerText = vol.toFixed(4) + " m³"
    /* Badge cảnh báo tấm không khớp gốc */
    let mismatchEl = document.getElementById("matrixMismatch")
    if (mismatchEl) {
        let n = getMismatchCount()
        if (n > 0) {
            mismatchEl.style.display = "block"
            mismatchEl.innerText = "⚠ " + n + " tấm không khớp kiện gốc — kiểm tra trước khi share"
        } else {
            mismatchEl.style.display = "none"
            mismatchEl.innerText = ""
        }
    }
}
function autoScaleMatrix() {
    let container = document.getElementById("matrixContainer")
    let table = container.querySelector("table")
    if (!table) return
    let maxHeight = window.innerHeight * 0.75
    let scale = Math.min(
        container.clientWidth / table.scrollWidth,
        maxHeight / table.scrollHeight
    )
    if (scale < 1) {
        table.style.transform = "scale(" + scale + ")"
        table.style.transformOrigin = "top left"
    }
}
function renderMatrix() {
    renderExcelMatrix()
    setTimeout(autoScaleMatrix, 50)
}

function renderExcelMatrix() {
    let groups = {}
    boards.forEach(b => {
        if (!groups[b.l]) groups[b.l] = []
        groups[b.l].push(b.w)
    })
    let lengths = Object.keys(groups).sort((a, b) => a - b)
    lengths.forEach(l => groups[l].sort((a, b) => a - b))
    let columns = []
    lengths.forEach(l => {
        let arr = groups[l]
        for (let i = 0; i < arr.length; i += 10) {
            columns.push({ length: l, values: arr.slice(i, i + 10) })
        }
    })
    let maxRows = Math.max(...columns.map(c => c.values.length))
    let html = "<table><tr>"
    /* CỘT MÔ TẢ */
    html += "<th>Dài</th>"
    columns.forEach(c => {
        html += "<th>" + c.length + "</th>"
    })
    html += "</tr>"
    /* HÀNG RỘNG — tự động theo cột dài nhất */
    for (let r = 0; r < maxRows; r++) {
        html += "<tr>"
        if (r == 0) {
            html += "<th rowspan='" + maxRows + "' class='axisLabel'>Rộng</th>"
        }
        columns.forEach(c => {
            html += "<td>" + (c.values[r] || "") + "</td>"
        })
        html += "</tr>"
    }
    /* HÀNG TỔNG */
    html += "<tr class='totalRow'>"
    html += "<th style='font-family:Arial;font-weight:bold'>Tổng</th>"
    columns.forEach(c => {
        let sumWidth = 0
        c.values.forEach(w => {
            if (w) sumWidth += Number(w)
        })
        let total = c.length * sumWidth * thickness.value
        html += "<th style='font-size:50%;font-weight:bold'>" + (sumWidth ? total.toFixed(0) : "") + "</th>"
    })
    html += "</tr>"
    html += "</table>"
    matrixContainer.innerHTML = html
}

/* SHARE */
async function shareMatrixZalo() {
    // Kiện lẻ: bắt buộc chọn tình trạng thực tế trước khi chia sẻ
    if (currentMeasurementType === "order_split") {
        let bs = document.getElementById("bundleStatus")
        if (bs && bs.value === "-") {
            let t = document.getElementById("toast")
            t.innerText = "Phải chọn tình trạng kiện trước (Kiện lẻ/Lẻ hết)"
            t.className = "toast warning"
            t.style.display = "block"
            setTimeout(() => { t.style.display = "none" }, 4000)
            bs.focus()
            if (navigator.vibrate) navigator.vibrate(200)
            return
        }
    }

    // Đồng bộ lên hệ thống TRƯỚC khi chia sẻ (không phụ thuộc share thành công)
    // Cả 2 mode đều sync: order_split → PgSales "DS kiện lẻ vừa soạn",
    // whole_bundle → PgKiln "mẻ xếp" (filter measurement_type)
    let syncResult = await syncToSystem()
    if (syncResult.ok) showToast("Đã đồng bộ ✓", "success")
    else showToast("⚠ Chưa đồng bộ: " + syncResult.reason, "error")

    try {
        let el = document.getElementById("matrixCaptureArea")
        let table = el.querySelector("table")
        let oldTransform = table ? table.style.transform : ""
        if (table) {
            table.style.transform = "scale(1)"
            if (table.scrollWidth > el.offsetWidth) {
                el.style.width = table.scrollWidth + "px"
            }
        }
        /* html2canvas không render <select> — tạm thay bằng <span> */
        let sel = document.getElementById("bundleStatus")
        // Xóa span cũ nếu còn sót từ lần trước (phòng trùng lặp)
        let oldSpans = sel.parentNode.querySelectorAll(".bundleStatus-text")
        oldSpans.forEach(s => s.remove())
        let tempSpan = document.createElement("span")
        tempSpan.innerText = sel.value
        tempSpan.className = "bundleStatus-text"
        sel.style.display = "none"
        sel.parentNode.insertBefore(tempSpan, sel.nextSibling)

        /* Nếu sync fail → chèn dòng cảnh báo nhỏ vào ảnh để quản trị viên biết */
        let syncWarn = null
        if (!syncResult.ok) {
            syncWarn = document.createElement("div")
            syncWarn.innerText = "⚠ CHƯA ĐỒNG BỘ HỆ THỐNG — báo quản trị viên kiểm tra"
            syncWarn.style.cssText = "font-size:11px;font-weight:700;color:#B91C1C;background:#FEE2E2;padding:4px 8px;border-radius:4px;margin-top:6px;text-align:center"
            el.appendChild(syncWarn)
        }

        let canvas
        try {
            canvas = await html2canvas(el, {
                scale: 3,
                scrollX: 0,
                scrollY: 0,
                windowWidth: el.scrollWidth,
                windowHeight: el.scrollHeight
            })
        } finally {
            /* Luôn khôi phục — dù html2canvas thành công hay lỗi */
            tempSpan.remove()
            sel.style.display = ""
            el.style.removeProperty("width")
            if (table) table.style.transform = oldTransform
            if (syncWarn) syncWarn.remove()
        }

        canvas.toBlob(async function (blob) {
            let file = new File([blob], "matrix.png", { type: "image/png" })
            if (navigator.share) {
                try {
                    await navigator.share({ files: [file], title: "" })
                    showToast("Chia sẻ thành công", "success")
                } catch (shareErr) {
                    /* User cancel share dialog — không báo lỗi */
                }
            } else {
                showToast("Thiết bị không hỗ trợ chia sẻ", "warning")
            }
        })
    } catch (e) {
        showToast("Lỗi: " + e.message, "error")
    }
}

/* LOAD */
window.addEventListener("load", async function () {
    // Hiển thị phiên bản app ở góc phải header (3 màn)
    if (typeof APP_VERSION !== "undefined") {
        document.querySelectorAll(".appVersionPill").forEach(el => el.innerText = APP_VERSION)
    }
    await verifySavedAccess()
    loadWoodTypes()
    accessInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            checkAccessCode()
        }
    })
    loadState()
    rebuild()
    updateSummary()
    renderList()
    /* Nếu đang có session → lưu & vào Measure */
    if (boards.length > 0 && bundle.value.trim() !== "") {
        saveCurrentSession()
        updateHeader()
        go("measure")
    }
})

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .then(() => console.log("PWA ready"));
}
