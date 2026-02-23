/* ============================================================
   STORAGE KEY
============================================================ */
const STORAGE_KEY = "aida_order_v4";

/* ============================================================
   STATE
============================================================ */
let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

if (!state.persons) state.persons = [];
if (!state.meals)   state.meals   = [];
if (!state.orders)  state.orders  = [];

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ============================================================
   TOAST
============================================================ */
let toastTimer = null;
const toastEl = (() => {
  const el = document.createElement("div");
  el.className = "toast";
  document.body.appendChild(el);
  return el;
})();

function toast(msg, duration) {
  duration = duration || 2200;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toastEl.classList.remove("show"); }, duration);
}

/* ============================================================
   REMOTE DATA FETCH (meals.json / users.json)
============================================================ */
async function fetchRemoteData() {
  let updated = false;

  try {
    const r = await fetch("meals.json", { cache: "no-store" });
    if (r.ok) {
      const meals = await r.json();
      if (Array.isArray(meals) && meals.length > 0) {
        meals.forEach(function(m) {
          const existing = state.meals.find(function(x) { return x.id === m.id; });
          if (!existing) {
            state.meals.push(m);
          } else {
            existing.name  = m.name  || existing.name;
            existing.price = m.price != null ? m.price : existing.price;
            existing.cat   = m.cat   || existing.cat;
            existing.icon  = m.icon  || existing.icon;
          }
        });
        updated = true;
      }
    }
  } catch (_) {}

  try {
    const r = await fetch("users.json", { cache: "no-store" });
    if (r.ok) {
      const users = await r.json();
      if (Array.isArray(users) && users.length > 0) {
        users.forEach(function(u) {
          const existing = state.persons.find(function(p) {
            return p.id === u.id ||
              (u.uid && p.uid && p.uid === u.uid) ||
              (u.name && p.name && p.name.trim().toLowerCase() === u.name.trim().toLowerCase());
          });
          if (!existing) {
            state.persons.push({
              id:   u.id   || ("p" + Date.now() + Math.floor(Math.random()*9999)),
              name: u.name || "Unbekannt",
              uid:  u.uid  || null
            });
          } else {
            if (u.id && !existing.id)   existing.id   = u.id;
            if (u.name)                 existing.name = u.name;
            if (u.uid)                  existing.uid  = u.uid;
          }
        });
        updated = true;
      }
    }
  } catch (_) {}

  if (updated) {
    save();
    render();
    toast("Daten aktualisiert");
  }
}

/* ============================================================
   CART
============================================================ */
let cart = [];
let currentPersonId = null;

function cartTotal() {
  return cart.reduce(function(s, i) { return s + i.price * i.qty; }, 0);
}

function cartItemCount() {
  return cart.reduce(function(s, i) { return s + i.qty; }, 0);
}

function addToCart(meal) {
  const existing = cart.find(function(i) { return i.id === meal.id; });
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: meal.id, name: meal.name, icon: meal.icon || "", price: meal.price, qty: 1 });
  }
  updateCartBar();
  toast((meal.icon || "") + " " + meal.name + " hinzugefuegt");
}

function updateCartBar() {
  const count = cartItemCount();
  const total = cartTotal();
  document.getElementById("cartCount").textContent =
    count === 0 ? "Warenkorb leer" : count + " Artikel";
  document.getElementById("cartTotal").textContent =
    total.toFixed(2).replace(".", ",") + " \u20AC";
}

/* ============================================================
   UNDO
============================================================ */
let lastOrderId = null;

function undoLastOrder() {
  if (!lastOrderId) return false;
  const idx = state.orders.findIndex(function(o) { return o.id === lastOrderId; });
  if (idx === -1) return false;
  state.orders.splice(idx, 1);
  lastOrderId = null;
  save();
  renderLog();
  renderAdmin();
  return true;
}

/* ============================================================
   PERSONS
============================================================ */
function addPerson(name) {
  state.persons.push({ id: "p" + Date.now(), name: name.trim(), uid: null });
  save();
  renderUserGrid();
  renderAdmin();
}

function deletePerson(id) {
  state.persons = state.persons.filter(function(p) { return p.id !== id; });
  if (currentPersonId === id) {
    currentPersonId = null;
    updateCurrentUserInfo();
  }
  save();
  renderUserGrid();
  renderAdmin();
}

/* ============================================================
   MEALS
============================================================ */
function addMeal(name, price, cat, icon) {
  state.meals.push({
    id:    "m" + Date.now(),
    name:  name.trim(),
    price: parseFloat(price),
    cat:   cat.trim() || "Sonstiges",
    icon:  icon.trim() || "\uD83C\uDF7D\uFE0F"
  });
  save();
  renderCatBar();
  renderItemGrid();
  renderAdmin();
}

function deleteMeal(id) {
  state.meals = state.meals.filter(function(m) { return m.id !== id; });
  save();
  renderCatBar();
  renderItemGrid();
  renderAdmin();
}

/* ============================================================
   ORDERS
============================================================ */
function placeOrder() {
  if (!currentPersonId) { toast("Bitte zuerst eine Person waehlen!"); return; }
  if (cart.length === 0) { toast("Warenkorb ist leer!"); return; }

  const person = state.persons.find(function(p) { return p.id === currentPersonId; });
  if (!person) return;

  const order = {
    id:       "o" + Date.now(),
    personId: currentPersonId,
    person:   person.name,
    time:     new Date().toISOString(),
    items:    cart.map(function(i) {
      return { id: i.id, name: i.name, icon: i.icon, price: i.price, qty: i.qty };
    }),
    total:    cartTotal()
  };

  state.orders.push(order);
  lastOrderId = order.id;
  cart = [];
  save();
  updateCartBar();
  updateCurrentUserInfo();
  renderLog();
  renderAdmin();
  toast("\u2714 Bestellung fuer " + person.name + " gebucht");
}

/* ============================================================
   CATEGORIES
============================================================ */
function getCategories() {
  const seen = new Set();
  const cats = [];
  state.meals.forEach(function(m) {
    if (!seen.has(m.cat)) { seen.add(m.cat); cats.push(m.cat); }
  });
  return cats;
}

let currentCat = null;
let mealSearchTerm = "";

/* ============================================================
   RENDER: USER GRID
============================================================ */
function selectPerson(id) {
  currentPersonId = id;
  updateCurrentUserInfo();
}

function updateCurrentUserInfo() {
  const info = document.getElementById("currentUserInfo");
  if (!currentPersonId) {
    info.textContent = "Keine Person ausgewaehlt.";
    info.className = "scan-person-info";
    return;
  }
  const p = state.persons.find(function(x) { return x.id === currentPersonId; });
  if (!p) { info.textContent = "Keine Person ausgewaehlt."; info.className = "scan-person-info"; return; }
  const personOrders = state.orders.filter(function(o) { return o.personId === p.id; });
  const total = personOrders.reduce(function(s, o) { return s + o.total; }, 0);
  info.textContent = "\uD83D\uDC64 " + p.name + " \u2014 " + personOrders.length + " Bestellung(en), " +
    total.toFixed(2).replace(".", ",") + " \u20AC";
  info.className = "scan-person-info active";
}

/* ============================================================
   RENDER: CATEGORY BAR
============================================================ */
function renderCatBar() {
  const bar = document.getElementById("catBar");
  bar.innerHTML = "";
  const cats = getCategories();
  if (cats.length === 0) return;
  if (!currentCat || !cats.includes(currentCat)) currentCat = cats[0];

  cats.forEach(function(cat) {
    const btn = document.createElement("button");
    btn.className = "cat-btn" + (cat === currentCat ? " active" : "");
    btn.textContent = cat;
    btn.onclick = function() {
      currentCat = cat;
      mealSearchTerm = "";
      document.getElementById("mealSearch").value = "";
      renderCatBar();
      renderItemGrid();
    };
    bar.appendChild(btn);
  });
}

/* ============================================================
   RENDER: ITEM GRID
============================================================ */
const CAT_COLORS = ["cat-color-0","cat-color-1","cat-color-2","cat-color-3","cat-color-4","cat-color-5"];

function renderItemGrid() {
  const grid = document.getElementById("itemGrid");
  grid.innerHTML = "";
  const cats = getCategories();
  const colorMap = {};
  cats.forEach(function(c, i) { colorMap[c] = CAT_COLORS[i % CAT_COLORS.length]; });

  const q = mealSearchTerm.trim().toLowerCase();
  const items = state.meals.filter(function(m) {
    if (q) return m.name.toLowerCase().includes(q) || (m.cat && m.cat.toLowerCase().includes(q));
    return m.cat === currentCat;
  });
  if (items.length === 0) {
    grid.innerHTML = "<p style='opacity:0.5;font-size:0.9rem;padding:0.5rem;'>" + (q ? "Keine Treffer." : "Keine Artikel in dieser Kategorie.") + "</p>";
    return;
  }
  items.forEach(function(m) {
    const btn = document.createElement("button");
    btn.className = "item-btn " + (colorMap[m.cat] || "");
    btn.innerHTML =
      "<span class=\"item-icon\">" + (m.icon || "\uD83C\uDF7D\uFE0F") + "</span>" +
      "<span class=\"item-name\">" + m.name + "</span>" +
      "<span class=\"item-price\">" + m.price.toFixed(2).replace(".", ",") + " \u20AC</span>";
    btn.onclick = function() {
      if (!currentPersonId) { toast("Bitte zuerst eine Person waehlen!"); return; }
      addToCart(m);
    };
    grid.appendChild(btn);
  });
}

/* ============================================================
   RENDER: LOG
============================================================ */
function renderLog() {
  const list = document.getElementById("logList");
  list.innerHTML = "";
  const sorted = state.orders.slice().sort(function(a, b) {
    return new Date(b.time) - new Date(a.time);
  });
  if (sorted.length === 0) {
    list.innerHTML = "<p style='opacity:0.5;font-size:0.9rem;'>Noch keine Bestellungen.</p>";
    return;
  }
  sorted.forEach(function(o) {
    const itemStr = o.items.map(function(i) { return i.qty + "\u00D7 " + i.name; }).join(", ");
    const d = new Date(o.time);
    const time = d.toLocaleDateString("de-DE", { day:"2-digit", month:"2-digit" }) +
      " " + d.toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit" });
    const el = document.createElement("div");
    el.className = "log-entry";
    el.innerHTML =
      "<div class=\"log-entry-left\">" +
        "<div class=\"log-entry-time\">" + time + "</div>" +
        "<div class=\"log-entry-person\">" + o.person + "</div>" +
        "<div class=\"log-entry-items\">" + itemStr + "</div>" +
      "</div>" +
      "<div class=\"log-entry-price\">" + o.total.toFixed(2).replace(".", ",") + " \u20AC</div>";
    list.appendChild(el);
  });
}

/* ============================================================
   RENDER: ADMIN
============================================================ */
function renderAdmin() {
  renderPersonList();
  renderMealList();
  renderBalanceList();
}

function renderPersonList() {
  const list = document.getElementById("personList");
  list.innerHTML = "";
  if (state.persons.length === 0) {
    list.innerHTML = "<p style='opacity:0.5;font-size:0.9rem;'>Keine Personen angelegt.</p>";
    return;
  }
  state.persons.forEach(function(p) {
    const el = document.createElement("div");
    el.className = "admin-item";
    el.innerHTML =
      "<div class=\"admin-item-info\">" +
        "<div class=\"admin-item-name\">" + p.name + "</div>" +
        "<div class=\"admin-item-sub\">ID: " + p.id + (p.uid ? " \u00B7 UID: " + p.uid : "") + "</div>" +
      "</div>" +
      "<button class=\"btn-danger btn-small\" onclick=\"deletePerson('" + p.id + "')\">&#x2715;</button>";
    list.appendChild(el);
  });
}

function renderMealList() {
  const list = document.getElementById("mealList");
  list.innerHTML = "";
  if (state.meals.length === 0) {
    list.innerHTML = "<p style='opacity:0.5;font-size:0.9rem;'>Keine Artikel vorhanden.</p>";
    return;
  }
  state.meals.forEach(function(m) {
    const el = document.createElement("div");
    el.className = "admin-item";
    el.innerHTML =
      "<div class=\"admin-item-info\">" +
        "<div class=\"admin-item-name\">" + (m.icon || "") + " " + m.name + "</div>" +
        "<div class=\"admin-item-sub\">" + m.cat + " \u00B7 " + m.price.toFixed(2).replace(".", ",") + " \u20AC</div>" +
      "</div>" +
      "<button class=\"btn-danger btn-small\" onclick=\"deleteMeal('" + m.id + "')\">&#x2715;</button>";
    list.appendChild(el);
  });
}

function renderBalanceList() {
  const list = document.getElementById("balanceList");
  list.innerHTML = "";
  if (state.persons.length === 0) {
    list.innerHTML = "<p style='opacity:0.5;font-size:0.9rem;'>Keine Personen.</p>";
    return;
  }
  state.persons.forEach(function(p) {
    const personOrders = state.orders.filter(function(o) { return o.personId === p.id; });
    const total = personOrders.reduce(function(s, o) { return s + o.total; }, 0);
    const el = document.createElement("div");
    el.className = "admin-item";
    el.innerHTML =
      "<div class=\"admin-item-info\">" +
        "<div class=\"admin-item-name\">" + p.name + "</div>" +
        "<div class=\"admin-item-sub\">" + personOrders.length + " Bestellung(en)</div>" +
      "</div>" +
      "<div style=\"font-weight:700;\">" + total.toFixed(2).replace(".", ",") + " \u20AC</div>";
    list.appendChild(el);
  });
}

/* ============================================================
   FULL RENDER
============================================================ */
function render() {
  renderCatBar();
  renderItemGrid();
  renderLog();
  renderAdmin();
  updateCartBar();
  updateCurrentUserInfo();
}

/* ============================================================
   CHECKOUT MODAL
============================================================ */
function openCheckoutModal() {
  if (!currentPersonId) { toast("Bitte zuerst eine Person waehlen!"); return; }
  if (cart.length === 0) { toast("Warenkorb ist leer!"); return; }

  const person = state.persons.find(function(p) { return p.id === currentPersonId; });
  const list = document.getElementById("checkoutList");
  list.innerHTML = "";

  cart.forEach(function(i) {
    const el = document.createElement("div");
    el.className = "checkout-item";
    el.innerHTML =
      "<span>" + (i.icon || "") + " " + i.qty + "\u00D7 " + i.name + "</span>" +
      "<span>" + (i.price * i.qty).toFixed(2).replace(".", ",") + " \u20AC</span>";
    list.appendChild(el);
  });

  const total = document.createElement("div");
  total.className = "checkout-item checkout-total";
  total.innerHTML =
    "<span>Gesamt (" + (person ? person.name : "") + ")</span>" +
    "<span>" + cartTotal().toFixed(2).replace(".", ",") + " \u20AC</span>";
  list.appendChild(total);

  document.getElementById("checkoutModal").style.display = "flex";
}

document.getElementById("checkoutBtn").onclick = openCheckoutModal;
document.getElementById("modalCancel").onclick = function() {
  document.getElementById("checkoutModal").style.display = "none";
};
document.getElementById("modalConfirm").onclick = function() {
  document.getElementById("checkoutModal").style.display = "none";
  openSignatureModal();
};

/* ============================================================
   ADD PERSON MODAL
============================================================ */
document.getElementById("addPersonBtn").onclick = function() {
  document.getElementById("newPersonName").value = "";
  document.getElementById("addPersonModal").style.display = "flex";
  setTimeout(function() { document.getElementById("newPersonName").focus(); }, 100);
};
document.getElementById("addPersonCancel").onclick = function() {
  document.getElementById("addPersonModal").style.display = "none";
};
document.getElementById("addPersonConfirm").onclick = function() {
  const name = document.getElementById("newPersonName").value.trim();
  if (!name) { toast("Bitte einen Namen eingeben!"); return; }
  addPerson(name);
  document.getElementById("addPersonModal").style.display = "none";
  toast("Person angelegt: " + name);
};
document.getElementById("newPersonName").addEventListener("keydown", function(e) {
  if (e.key === "Enter") document.getElementById("addPersonConfirm").click();
});

/* ============================================================
   ADD MEAL MODAL
============================================================ */
document.getElementById("addMealBtn").onclick = function() {
  document.getElementById("newMealName").value = "";
  document.getElementById("newMealPrice").value = "";
  document.getElementById("newMealCat").value = "";
  document.getElementById("newMealIcon").value = "";
  document.getElementById("addMealModal").style.display = "flex";
  setTimeout(function() { document.getElementById("newMealName").focus(); }, 100);
};
document.getElementById("addMealCancel").onclick = function() {
  document.getElementById("addMealModal").style.display = "none";
};
document.getElementById("addMealConfirm").onclick = function() {
  const name  = document.getElementById("newMealName").value.trim();
  const price = document.getElementById("newMealPrice").value;
  const cat   = document.getElementById("newMealCat").value.trim() || "Sonstiges";
  const icon  = document.getElementById("newMealIcon").value.trim() || "\uD83C\uDF7D\uFE0F";
  if (!name || !price) { toast("Name und Preis benoetigt!"); return; }
  addMeal(name, price, cat, icon);
  document.getElementById("addMealModal").style.display = "none";
  toast("Artikel hinzugefuegt: " + name);
};

/* ============================================================
   RELOAD DATA BUTTON
============================================================ */
document.getElementById("reloadDataBtn").onclick = function() {
  toast("Lade Daten...");
  fetchRemoteData();
};

/* ============================================================
   MEAL SEARCH
============================================================ */
document.getElementById("mealSearch").addEventListener("input", function() {
  mealSearchTerm = this.value;
  renderItemGrid();
});

/* ============================================================
   DEBUG: PERSON SELECT (non-touch / desktop)
============================================================ */
(function() {
  var isTouchDevice = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  if (isTouchDevice) return;

  var wrap = document.getElementById("debugSelect");
  wrap.style.display = "flex";

  function populateDebugSelect() {
    var sel = document.getElementById("debugPersonSelect");
    var prev = sel.value;
    sel.innerHTML = "";
    state.persons.forEach(function(p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
    if (prev && Array.from(sel.options).some(function(o) { return o.value === prev; })) {
      sel.value = prev;
    }
  }

  var _origRender = render;
  render = function() {
    _origRender();
    populateDebugSelect();
  };

  populateDebugSelect();

  document.getElementById("debugSelectBtn").onclick = function() {
    var id = document.getElementById("debugPersonSelect").value;
    if (!id) return;
    selectPerson(id);
    toast("🖥 Debug: " + state.persons.find(function(p) { return p.id === id; }).name + " ausgewählt");
  };
})();

/* ============================================================
   CLEAR ORDERS BUTTON
============================================================ */
document.getElementById("clearOrdersBtn").onclick = function() {
  if (!confirm("Alle Bestellungen wirklich loeschen?")) return;
  state.orders = [];
  lastOrderId = null;
  save();
  renderLog();
  renderAdmin();
  toast("Alle Bestellungen geloescht");
};

/* ============================================================
   UNDO BUTTON
============================================================ */
document.getElementById("undoBtn").onclick = function() {
  if (undoLastOrder()) {
    toast("\u21A9 Letzte Bestellung rueckgaengig gemacht");
  } else {
    toast("Nichts zum Rueckgaengig machen");
  }
};

/* ============================================================
   DARK MODE TOGGLE
============================================================ */
document.getElementById("toggleDark").onclick = function() {
  document.body.classList.toggle("dark");
  localStorage.setItem("aida_dark", document.body.classList.contains("dark") ? "1" : "0");
};

if (localStorage.getItem("aida_dark") === "1") {
  document.body.classList.add("dark");
}

/* ============================================================
   TAB NAVIGATION
============================================================ */
document.querySelectorAll(".tab-btn").forEach(function(btn) {
  btn.onclick = function() {
    document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
    document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("page-" + btn.dataset.page).classList.add("active");
  };
});

/* ============================================================
   CLOSE MODALS ON BACKDROP CLICK
============================================================ */
document.querySelectorAll(".modal").forEach(function(modal) {
  modal.addEventListener("click", function(e) {
    if (e.target === modal) modal.style.display = "none";
  });
});

/* ============================================================
   SIGNATURE MODAL
============================================================ */
(function() {
  var canvas, ctx, drawing, hasSig, pendingOrderData;

  function initCanvas() {
    canvas = document.getElementById("sigCanvas");
    ctx = canvas.getContext("2d");
  }

  function resizeCanvas() {
    var wrap = canvas.parentElement;
    var w = wrap.clientWidth;
    var h = Math.round(w * 0.38);
    canvas.width = w;
    canvas.height = h;
    ctx.strokeStyle = document.body.classList.contains("dark") ? "#e8eaf0" : "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function getPos(e) {
    var rect = canvas.getBoundingClientRect();
    var src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function onStart(e) {
    e.preventDefault();
    drawing = true;
    var p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onMove(e) {
    e.preventDefault();
    if (!drawing) return;
    var p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasSig) {
      hasSig = true;
      document.getElementById("sigPlaceholder").style.display = "none";
      document.getElementById("sigAcceptBtn").disabled = false;
    }
  }

  function onEnd(e) {
    e.preventDefault();
    drawing = false;
  }

  function clearSig() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSig = false;
    document.getElementById("sigPlaceholder").style.display = "flex";
    document.getElementById("sigAcceptBtn").disabled = true;
  }

  window.openSignatureModal = function() {
    if (!canvas) initCanvas();
    var person = state.persons.find(function(p) { return p.id === currentPersonId; });
    document.getElementById("sigPersonName").textContent =
      person ? "Bitte unterschreiben: " + person.name : "";
    document.getElementById("signatureModal").style.display = "flex";
    requestAnimationFrame(function() {
      resizeCanvas();
      clearSig();
    });
  };

  function closeSignatureModal() {
    document.getElementById("signatureModal").style.display = "none";
  }

  document.getElementById("sigClearBtn").onclick = clearSig;

  document.getElementById("sigAcceptBtn").onclick = function() {
    if (!hasSig) return;
    var sigDataUrl = canvas.toDataURL("image/png");
    closeSignatureModal();
    placeOrderWithSignature(sigDataUrl);
  };

  document.getElementById("signatureModal").addEventListener("click", function(e) {
    if (e.target === document.getElementById("signatureModal")) closeSignatureModal();
  });

  function attachEvents() {
    canvas.addEventListener("mousedown",  onStart, { passive: false });
    canvas.addEventListener("mousemove",  onMove,  { passive: false });
    canvas.addEventListener("mouseup",    onEnd,   { passive: false });
    canvas.addEventListener("mouseleave", onEnd,   { passive: false });
    canvas.addEventListener("touchstart", onStart, { passive: false });
    canvas.addEventListener("touchmove",  onMove,  { passive: false });
    canvas.addEventListener("touchend",   onEnd,   { passive: false });
  }

  document.addEventListener("DOMContentLoaded", function() {
    initCanvas();
    attachEvents();
  });
  if (document.readyState !== "loading") {
    initCanvas();
    attachEvents();
  }
})();

function placeOrderWithSignature(sigDataUrl) {
  if (!currentPersonId) { toast("Bitte zuerst eine Person waehlen!"); return; }
  if (cart.length === 0) { toast("Warenkorb ist leer!"); return; }

  var person = state.persons.find(function(p) { return p.id === currentPersonId; });
  if (!person) return;

  var order = {
    id:        "o" + Date.now(),
    personId:  currentPersonId,
    person:    person.name,
    time:      new Date().toISOString(),
    items:     cart.map(function(i) {
      return { id: i.id, name: i.name, icon: i.icon, price: i.price, qty: i.qty };
    }),
    total:     cartTotal(),
    signature: sigDataUrl
  };

  state.orders.push(order);
  lastOrderId = order.id;
  cart = [];
  currentPersonId = null;
  save();
  updateCartBar();
  updateCurrentUserInfo();
  renderLog();
  renderAdmin();
  toast("\u2714 Bestellung fuer " + person.name + " gebucht");
}

/* ============================================================
   NFC
============================================================ */
let nfcReader = null;
let nfcAbortController = null;
let nfcMode = null; // "scan" | "link"
let nfcLinkPersonId = null;
let nfcLinkAbortController = null;

function nfcSupported() {
  return ("NDEFReader" in window);
}

function setNfcBanner(active) {
  const banner = document.getElementById("nfcBanner");
  const btn    = document.getElementById("nfcToggleBtn");
  if (active) {
    banner.style.display = "flex";
    btn.classList.add("nfc-active");
  } else {
    banner.style.display = "none";
    btn.classList.remove("nfc-active");
  }
}

function stopNfcScan() {
  if (nfcAbortController) {
    nfcAbortController.abort();
    nfcAbortController = null;
  }
  nfcMode = null;
  setNfcBanner(false);
}

async function startNfcScan() {
  if (!nfcSupported()) {
    toast("NFC wird auf diesem Gerät nicht unterstützt");
    return;
  }
  if (nfcAbortController) {
    stopNfcScan();
    return;
  }
  try {
    nfcAbortController = new AbortController();
    nfcMode = "scan";
    const reader = new NDEFReader();
    setNfcBanner(true);
    document.getElementById("nfcBannerText").textContent = "NFC aktiv – Karte ans Gerät halten";

    await reader.scan({ signal: nfcAbortController.signal });

    reader.addEventListener("reading", function(event) {
      const uid = event.serialNumber ? event.serialNumber.toUpperCase() : null;
      if (!uid) { toast("NFC: Keine UID erkannt"); return; }
      const person = state.persons.find(function(p) { return p.uid && p.uid.toUpperCase() === uid; });
      if (person) {
        selectPerson(person.id);
        document.getElementById("nfcBannerText").textContent = "✔ " + person.name + " erkannt";
        toast("📡 " + person.name + " per NFC erkannt");
        document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
        document.querySelectorAll(".page").forEach(function(p) { p.classList.remove("active"); });
        document.querySelector(".tab-btn[data-page='order']").classList.add("active");
        document.getElementById("page-order").classList.add("active");
      } else {
        document.getElementById("nfcBannerText").textContent = "⚠ Unbekannte Karte: " + uid;
        toast("⚠ Unbekannte NFC-Karte: " + uid);
      }
    });

    reader.addEventListener("readingerror", function() {
      toast("NFC Lesefehler");
    });

  } catch (err) {
    nfcAbortController = null;
    nfcMode = null;
    setNfcBanner(false);
    if (err.name !== "AbortError") {
      toast("NFC Fehler: " + err.message);
    }
  }
}

function nfcToggle() {
  if (!nfcSupported()) {
    toast("NFC wird auf diesem Gerät nicht unterstützt");
    return;
  }
  if (nfcAbortController) {
    stopNfcScan();
  } else {
    startNfcScan();
  }
}

document.getElementById("nfcToggleBtn").onclick = nfcToggle;
document.getElementById("scanCardBtn").onclick   = nfcToggle;

document.getElementById("nfcStopBtn").onclick = stopNfcScan;

/* --- NFC Link Modal --- */
function openNfcLinkModal() {
  if (!nfcSupported()) {
    toast("NFC wird auf diesem Gerät nicht unterstützt");
    return;
  }
  const sel = document.getElementById("nfcLinkPersonSelect");
  sel.innerHTML = "";
  if (state.persons.length === 0) {
    toast("Keine Personen vorhanden");
    return;
  }
  state.persons.forEach(function(p) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name + (p.uid ? " (UID: " + p.uid + ")" : "");
    sel.appendChild(opt);
  });
  document.getElementById("nfcLinkStatus").textContent = "Person wählen und Scan starten…";
  document.getElementById("nfcLinkStatus").className = "nfc-link-status";
  document.getElementById("nfcLinkStart").disabled = false;
  document.getElementById("nfcLinkModal").style.display = "flex";
}

function closeNfcLinkModal() {
  if (nfcLinkAbortController) {
    nfcLinkAbortController.abort();
    nfcLinkAbortController = null;
  }
  document.getElementById("nfcLinkModal").style.display = "none";
}

document.getElementById("nfcScanLinkBtn").onclick = openNfcLinkModal;
document.getElementById("nfcLinkCancel").onclick = closeNfcLinkModal;
document.getElementById("nfcLinkModal").addEventListener("click", function(e) {
  if (e.target === document.getElementById("nfcLinkModal")) closeNfcLinkModal();
});

document.getElementById("nfcLinkStart").onclick = async function() {
  const personId = document.getElementById("nfcLinkPersonSelect").value;
  if (!personId) { toast("Bitte eine Person wählen"); return; }

  const statusEl = document.getElementById("nfcLinkStatus");
  const startBtn = document.getElementById("nfcLinkStart");

  if (nfcLinkAbortController) {
    nfcLinkAbortController.abort();
    nfcLinkAbortController = null;
    startBtn.textContent = "📡 Scan starten";
    statusEl.textContent = "Scan gestoppt.";
    statusEl.className = "nfc-link-status";
    return;
  }

  try {
    nfcLinkAbortController = new AbortController();
    startBtn.textContent = "⏹ Scan stoppen";
    statusEl.textContent = "Warte auf NFC-Karte…";
    statusEl.className = "nfc-link-status scanning";

    const reader = new NDEFReader();
    await reader.scan({ signal: nfcLinkAbortController.signal });

    reader.addEventListener("reading", function(event) {
      const uid = event.serialNumber ? event.serialNumber.toUpperCase() : null;
      if (!uid) {
        statusEl.textContent = "⚠ Keine UID erkannt, erneut versuchen.";
        statusEl.className = "nfc-link-status error";
        return;
      }
      const person = state.persons.find(function(p) { return p.id === personId; });
      if (person) {
        person.uid = uid;
        save();
        renderAdmin();
        renderUserGrid();
        statusEl.textContent = "✔ " + person.name + " → UID: " + uid;
        statusEl.className = "nfc-link-status success";
        toast("📡 " + person.name + " mit Karte " + uid + " verknüpft");
        startBtn.textContent = "📡 Scan starten";
        if (nfcLinkAbortController) {
          nfcLinkAbortController.abort();
          nfcLinkAbortController = null;
        }
        const sel = document.getElementById("nfcLinkPersonSelect");
        Array.from(sel.options).forEach(function(opt) {
          if (opt.value === personId) {
            opt.textContent = person.name + " (UID: " + uid + ")";
          }
        });
      }
    });

    reader.addEventListener("readingerror", function() {
      statusEl.textContent = "⚠ NFC Lesefehler";
      statusEl.className = "nfc-link-status error";
    });

  } catch (err) {
    nfcLinkAbortController = null;
    startBtn.textContent = "📡 Scan starten";
    if (err.name !== "AbortError") {
      statusEl.textContent = "Fehler: " + err.message;
      statusEl.className = "nfc-link-status error";
    }
  }
};

/* ============================================================
   INIT
============================================================ */
render();
fetchRemoteData();
