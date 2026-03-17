function getDateTime() {
    let now = new Date()
    let d = String(now.getDate()).padStart(2, "0")
    let m = String(now.getMonth() + 1).padStart(2, "0")
    let y = now.getFullYear()
    let h = String(now.getHours()).padStart(2, "0")
    let min = String(now.getMinutes()).padStart(2, "0")
    return d + "/" + m + "/" + y + "  " + h + ":" + min
}

/* TURN */
function newTurn() {
    let lastTurnBoards = boards.filter(b => b.turn === currentTurn)
    if (lastTurnBoards.length < 1) {
        showToast("Lượt hiện tại chưa có tấm")
        return
    }
    currentTurn++
    showToast("Chuyển sang lượt " + currentTurn)
}

/* TOAST */
function showToast(msg) {
    let t = document.getElementById("toast")
    t.innerText = msg
    t.style.display = "block"
    setTimeout(() => {
        t.style.display = "none"
    }, 2000)
}

/* ACCESS */
async function fetchAccessList() {
    try {
        let res = await fetch("device.json?ts=" + Date.now())
        let data = await res.json()
        if (!data || !data.codes) return []
        return data.codes
    } catch (e) {
        return []
    }
}
async function validateAccessCode(code) {
    let codes = await fetchAccessList()
    return codes.includes(code)
}
async function checkAccessCode() {
    let input = document.getElementById("accessInput")
    let btn = document.getElementById("accessBtn")
    let error = document.getElementById("accessError")
    let loading = document.getElementById("accessLoading")
    let code = input.value.trim()
    if (!code) {
        error.innerText = "Vui lòng nhập mã truy cập"
        return
    }
    btn.disabled = true
    loading.innerText = "Đang kiểm tra..."
    error.innerText = ""
    let ok = await validateAccessCode(code)
    btn.disabled = false
    loading.innerText = ""
    if (ok) {
        localStorage.setItem("woodAccessCode", code)
        document.getElementById("accessScreen").style.display = "none"
    } else {
        error.innerText = "Mã không hợp lệ"
        if (navigator.vibrate) {
            navigator.vibrate(200)
        }
        input.focus()
    }
}
async function verifySavedAccess() {
    let savedCode = localStorage.getItem("woodAccessCode")
    if (!savedCode) {
        document.getElementById("accessScreen").style.display = "flex"
        setTimeout(() => accessInput.focus(), 200)
        return
    }
    let ok = await validateAccessCode(savedCode)
    if (!ok) {
        localStorage.removeItem("woodAccessCode")
        document.getElementById("accessScreen").style.display = "flex"
        setTimeout(() => accessInput.focus(), 200)
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
        quality: quality.value
    }
    localStorage.setItem("woodMeasureState", JSON.stringify(state))
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
        grid = state.grid || 6
        lenMin = state.lenMin || 20
        lenMax = state.lenMax || 35
        widMin = state.widMin || 15
        widMax = state.widMax || 35
        woodUS = state.woodUS || false
        bundle.value = state.bundle || ""
        woodType.value = state.woodType || ""
        thickness.value = state.thickness || ""
        quality.value = state.quality || ""
        document.getElementById("woodUS").checked = woodUS
        gridCount.innerText = grid
    } catch (e) { }
}

/* RESET */
function confirmResetSetting() {
    if (confirm("Bạn có chắc muốn reset cấu hình kiện?")) {
        resetSetting()
    }
}
function resetSetting() {
    bundle.value = ""
    woodType.value = ""
    quality.value = ""
    thickness.value = ""
    boards = []
    document.getElementById("woodUS").checked = false
    woodUS = false
    updateSummary()
    renderList()
    saveState()
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
    updateHeader()
    rebuild()
    go("measure")
    updateSummary()
    renderList()
    saveState()
}

/* HEADER */
function updateHeader() {
    let info = [bundle.value, woodType.value, thickness.value + "cm", quality.value]
        .filter(v => v != "")
        .join(" • ")
    headerInfo.innerText = info
}

/* BUILD GRID */
function rebuild() {
    lenMinLabel.innerText = lenMin
    lenMaxLabel.innerText = lenMax
    widMinLabel.innerText = widMin
    widMaxLabel.innerText = widMax
    createButtons()
    saveState()
}
function createButtons() {
    lengthGrid.innerHTML = ""
    widthGrid.innerHTML = ""
    lengthGrid.style.gridTemplateColumns = "repeat(" + grid + ",1fr)"
    widthGrid.style.gridTemplateColumns = "repeat(" + grid + ",1fr)"
    let lengths = []
    for (let i = lenMin; i <= lenMax; i++) {
        lengths.push(i)
        if (woodUS) {
            lengths.push(Number((i + 0.3).toFixed(1)))
            lengths.push(Number((i + 0.5).toFixed(1)))
            lengths.push(Number((i + 0.7).toFixed(1)))
        }
    }
    lengths.forEach(v => {
        let b = document.createElement("button")
        b.innerText = v

        /* gỗ Mỹ: số nguyên in đậm */
        if (woodUS && Number.isInteger(v)) {
            b.classList.add("usWhole")
        }
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
    let widths = []
    for (let i = widMin; i <= widMax; i++) {
        widths.push(i)
        if (woodUS) {
            widths.push(Number((i + 0.5).toFixed(1)))
        }
    }
    widths.forEach(v => {
        let b = document.createElement("button")
        b.innerText = v
        /* gỗ Mỹ: số nguyên in đậm */
        if (woodUS && Number.isInteger(v)) {
            b.classList.add("usWhole")
        }
        b.onclick = () => {
            if (selectedLength == null) return
            speakNumber(v)
            boards.push({
                l: selectedLength,
                w: v,
                turn: currentTurn
            })
            selectedLength = null
            document.querySelectorAll("#lengthGrid button")
                .forEach(x => x.classList.remove("selected"))
            widthGrid.classList.add("disabled")
            updateSummary()
            renderList()
            saveState()
        }
        widthGrid.appendChild(b)
    })
}

/* SUMMARY */
function updateSummary() {
    let vol = 0
    boards.forEach(b => {
        vol += (b.l / 10) * (b.w / 100) * (thickness.value / 100)
    })
    summary.innerText = boards.length + " tấm • " + vol.toFixed(4) + " m³"
}

/* LIST */
function renderList() {
    boardList.innerHTML = ""
    if (boards.length === 0) return
    let groups = {}
    boards.forEach(b => {
        if (!groups[b.turn]) groups[b.turn] = []
        groups[b.turn].push(b)
    })
    let turns = Object.keys(groups).sort((a, b) => b - a)
    turns.forEach(turn => {
        let arr = groups[turn]
        let header = document.createElement("div")
        header.style.fontWeight = "bold"
        header.style.marginTop = "6px"
        header.innerText = "Lượt " + turn + " : " + arr.length + " tấm"
        boardList.appendChild(header)
        arr.slice().reverse().forEach((b) => {
            let index = boards.indexOf(b)
            let row = document.createElement("div")
            row.style.display = "flex"
            row.style.justifyContent = "space-between"
            row.style.alignItems = "center"
            row.innerHTML =
                "<span>" + b.l + " x " + b.w + "</span>" +
                "<button onclick='deleteBoard(" + index + ")'>x</button>"
            boardList.appendChild(row)
        })
    })
}
function deleteBoard(i) {
    boards.splice(i, 1)
    updateSummary()
    renderList()
    saveState()
}
function confirmResetBoards() {
    if (confirm("Bạn có chắc muốn xóa toàn bộ tấm đã nhập?")) {
        resetBoards()
    }
}
function resetBoards() {
    boards = []
    /* reset lượt về 1 */
    currentTurn = 1
    selectedLength = null
    document.querySelectorAll("#lengthGrid button")
        .forEach(x => x.classList.remove("selected"))
    widthGrid.classList.add("disabled")
    updateSummary()
    renderList()
    saveState()
    showToast("Đã reset dữ liệu")
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
    let vol = 0
    boards.forEach(b => {
        vol += (b.l / 10) * (b.w / 100) * (thickness.value / 100)
    })
    let info = [bundle.value, woodType.value, thickness.value + "cm", quality.value]
        .filter(v => v != "")
        .join(" • ")
    matrixHeader.innerText = info
    matrixPieces.innerText = boards.length + " tấm"
    matrixVolume.innerText = vol.toFixed(4) + " m³"
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
    if (excelMode.checked) renderExcelMatrix()
    else renderHeatmap()
    setTimeout(autoScaleMatrix, 50)
}

/* HEATMAP */
function renderHeatmap() {
    let map = {}
    boards.forEach(b => {
        let key = b.w + "_" + b.l
        map[key] = (map[key] || 0) + 1
    })
    let widths = [...new Set(boards.map(b => b.w))].sort((a, b) => a - b)
    let lengths = [...new Set(boards.map(b => b.l))].sort((a, b) => a - b)
    let html = "<table><tr><th>Rộng \\ Dài</th>"
    lengths.forEach(l => html += "<th>" + l + "</th>")
    html += "</tr>"
    widths.forEach(w => {
        html += "<tr><th>" + w + "</th>"
        lengths.forEach(l => {
            let v = map[w + "_" + l] || 0
            let color = v == 0 ? "white" : v == 1 ? "#dcfce7" : v == 2 ? "#86efac" : "#22c55e"
            html += "<td style='background:" + color + "'>" + v + "</td>"
        })
        html += "</tr>"
    })
    html += "</table>"
    matrixContainer.innerHTML = html
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
    let html = "<table><tr>"
    /* CỘT MÔ TẢ */
    html += "<th style='font-family:Arial;font-weight:bold'>Dài</th>"
    columns.forEach(c => {
        html += "<th>" + c.length + "</th>"
    })
    html += "</tr>"
    /* 10 HÀNG RỘNG */
    for (let r = 0; r < 10; r++) {
        html += "<tr>"
        if (r == 0) {
            html += "<th rowspan='10' style='font-family:Arial;font-weight:bold'>Rộng</th>"
        }
        columns.forEach(c => {
            html += "<td>" + (c.values[r] || "") + "</td>"
        })
        html += "</tr>"
    }
    /* HÀNG TỔNG */
    html += "<tr>"
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
    try {
        let el = document.getElementById("matrixCaptureArea")
        let table = el.querySelector("table")
        let oldTransform = table ? table.style.transform : ""
        if (table) {
            table.style.transform = "scale(1)"
            // Chỉ mở rộng el khi table rộng hơn, không bao giờ thu hẹp
            if (table.scrollWidth > el.offsetWidth) {
                el.style.width = table.scrollWidth + "px"
            }
        }
        let canvas = await html2canvas(el, {
            scale: 3,
            scrollX: 0,
            scrollY: 0,
            windowWidth: el.scrollWidth,
            windowHeight: el.scrollHeight
        })

        el.style.removeProperty("width")
        if (table) table.style.transform = oldTransform
        canvas.toBlob(async function (blob) {
            let file = new File([blob], "matrix.png", { type: "image/png" })
            if (navigator.share) {
                await navigator.share({
                    files: [file],
                    title: ""
                })
                showToast("Chia sẻ thành công")
            } else {
                showToast("Thiết bị không hỗ trợ chia sẻ")
            }
        })
    } catch (e) {
        showToast("Chia sẻ thất bại")
    }
}

/* LOAD */
window.addEventListener("load", async function () {
    await verifySavedAccess()
    accessInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
            checkAccessCode()
        }
    })
    loadState()
    rebuild()
    updateSummary()
    renderList()
})

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .then(() => console.log("PWA ready"));
}
