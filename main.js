/**
 * @fileoverview FF14 素材分解＆ギャザクラ採集ルート最適化アプリケーション
 * 誰でも読める公開API ＆ 秘密の鍵で書き込みを守る堅牢アーキテクチャ版。
 * @author Diamond Stellar(Mandragora) & Assistant
 * @version 2.3.0
 */

// =============================================================================
// 型定義 (JSDoc)
// =============================================================================

/**
 * @typedef {Object} Coords
 * @property {number} x - ゲーム内X座標
 * @property {number} y - ゲーム内Y座標
 */

/**
 * @typedef {Object} Ingredient
 * @property {string} name - 素材名
 * @property {number} amount - 必要数
 */

/**
 * @typedef {Object} RecipeItem
 * @property {string} id - 一意ID
 * @property {string} name - アイテム名
 * @property {number} yields - 獲得数
 * @property {"gather"|"craft"|"battle"|"shop"} type - 入手区分
 * @property {string} [job] - 担当クラス名
 * @property {string} [zone] - エリア名
 * @property {string} [location] - エーテライト名
 * @property {Coords|null} [coords] - 座標データ
 * @property {string} [note] - 入手メモ
 * @property {Ingredient[]} ingredients - 必要素材リスト
 */

/**
 * @typedef {Object} TargetItem
 * @property {string} name - 製作するアイテム名
 * @property {number} amount - 製作個数
 */

/**
 * @typedef {Object} RouteNode
 * @property {string} location - エーテライト名
 * @property {string} zone - エリア名
 * @property {string} region - リージョン区分
 * @property {Coords|null} coords - 座標情報
 * @property {{name: string, amount: number, job: string}[]} items - 採集素材一覧
 */

// =============================================================================
// 定数・設定
// =============================================================================

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyywlSg4YyBvm-SmOdCHFsuC8SwMF8NoS0VSRh5HBeIgQjenloKP0agAFa6HMTZjayc/exec";

const STORAGE_KEYS = {
  ADMIN_PASS: "XIV_ADMIN_PASSCODE",
  VIEW_MODE: "XIV_RESULT_VIEW_MODE"
};

const CITIES = Object.freeze({
  old_sharlayan: { name: "オールド・シャーレアン", region: "sharlayan" },
  tuliyollal:    { name: "トライヨラ",           region: "tural" },
  limsa_lominsa: { name: "リムサ・ロミンサ",     region: "la_noscea" },
  gridania:      { name: "グリダニア",           region: "black_shroud" },
  uldah:         { name: "ウルダハ",             region: "thanalan" },
  crystarium:    { name: "クリスタリウム",       region: "norvrandt" },
  kugane:        { name: "クガネ",               region: "othard" },
  ishgard:       { name: "イシュガルド",         region: "ishgard" }
});

const ZONE_REGION_MAP = Object.freeze({
  "ラヴィリンソス": "sharlayan",
  "サベネア島": "sharlayan",
  "ガレマルド": "ilsabard",
  "嘆きの海": "moon",
  "エルピス": "elpis",
  "ウルティマ・トゥーレ": "elpis",
  "イル・メグ": "norvrandt",
  "レイクランド": "norvrandt",
  "コルシア島": "norvrandt",
  "アム・アレーン": "norvrandt",
  "ラケティカ大森林": "norvrandt",
  "テンペスト": "norvrandt",
  "中央ラノシア": "la_noscea",
  "低地ラノシア": "la_noscea",
  "東ラノシア": "la_noscea",
  "西ラノシア": "la_noscea",
  "黒衣森：中央森林": "black_shroud",
  "黒衣森：東部森林": "black_shroud",
  "東ザナラーン": "thanalan",
  "南ザナラーン": "thanalan",
  "中央ザナラーン": "thanalan",
  "クルザス中央高地": "ishgard",
  "高地ドラヴァニア": "ishgard",
  "紅玉海": "othard",
  "ヤンサ": "othard",
  "オルコ・パチャ": "tural",
  "コザマル・カ": "tural",
  "ヤクテル樹海": "tural",
  "シャーローニ荒野": "tural"
});

// =============================================================================
// アプリケーション状態 (State)
// =============================================================================

/** @type {RecipeItem[]} */
let currentRecipes = [];

/** @type {TargetItem[]} */
let craftCart = [];

/** @type {Map<string, number>} */
let currentBaseMaterialsMap = new Map();

/** @type {Map<string, number>} */
let currentPossessedMap = new Map();

/** @type {Map<string, {amount: number, job: string}>} */
let currentIntermediateCraftsMap = new Map();

let currentViewMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || "group";
let isAdminAuthenticated = false;

const elements = {
  syncStatus: document.getElementById("sync-status"),
  etClockDisplay: document.getElementById("et-clock-display"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),
  itemSearchInput: document.getElementById("item-search-input"),
  searchSuggestions: document.getElementById("search-suggestions"),
  selectedItemName: document.getElementById("selected-item-name"),
  targetAmount: document.getElementById("target-amount"),
  addToCartBtn: document.getElementById("add-to-cart-btn"),
  cartCount: document.getElementById("cart-count"),
  cartItemsList: document.getElementById("cart-items-list"),
  cartEmptyMsg: document.getElementById("cart-empty-msg"),
  calcAllBtn: document.getElementById("calc-all-btn"),
  intermediateCraftsContainer: document.getElementById("intermediate-crafts-container"),
  intermediateCraftsList: document.getElementById("intermediate-crafts-list"),
  calcResults: document.getElementById("calc-results"),
  resultItemsList: document.getElementById("result-items-list"),
  toggleViewModeBtn: document.getElementById("toggle-view-mode-btn"),
  routeStartCity: document.getElementById("route-start-city"),
  routeFreeDest: document.getElementById("route-free-dest"),
  routeFavDest: document.getElementById("route-fav-dest"),
  calcRouteBtn: document.getElementById("calc-route-btn"),
  routeResultsContainer: document.getElementById("route-results-container"),
  routeTotalGil: document.getElementById("route-total-gil"),
  routeDiscountInfo: document.getElementById("route-discount-info"),
  routeTimeline: document.getElementById("route-timeline"),
  adminLockScreen: document.getElementById("admin-lock-screen"),
  adminFormContainer: document.getElementById("admin-form-container"),
  authPasscodeBtn: document.getElementById("auth-passcode-btn"),
  lockAdminBtn: document.getElementById("lock-admin-btn"),
  recipeForm: document.getElementById("recipe-form"),
  itemName: document.getElementById("item-name"),
  btnXivapiFetch: document.getElementById("btn-xivapi-fetch"),
  itemYield: document.getElementById("item-yield"),
  itemType: document.getElementById("item-type"),
  gatherJobField: document.getElementById("gather-job-field"),
  craftFields: document.getElementById("craft-fields"),
  gatherFields: document.getElementById("gather-fields"),
  itemZone: document.getElementById("item-zone"),
  itemLocation: document.getElementById("item-location"),
  coordX: document.getElementById("coord-x"),
  coordY: document.getElementById("coord-y"),
  noteFields: document.getElementById("note-fields"),
  itemNote: document.getElementById("item-note"),
  ingredientsContainer: document.getElementById("ingredients-container"),
  addIngredientBtn: document.getElementById("add-ingredient-btn"),
  registeredRecipesList: document.getElementById("registered-recipes-list"),
  recipeCount: document.getElementById("recipe-count"),
  saveRecipeBtn: document.getElementById("save-recipe-btn"),
  refreshSheetBtn: document.getElementById("refresh-sheet-btn"),
  toastNotification: document.getElementById("toast-notification")
};

// =============================================================================
// 初期化
// =============================================================================

function init() {
  setupTabs();
  setupEventListeners();
  setupSearchFeature();
  setupQuickButtons();
  setupEtClock();
  loadDataFromGAS();
}

function updateSyncStatus(text, stateClass) {
  elements.syncStatus.textContent = text;
  elements.syncStatus.className = `sync-status ${stateClass}`;
}

function showToast(msg) {
  elements.toastNotification.textContent = msg;
  elements.toastNotification.classList.remove("hidden");
  setTimeout(() => {
    elements.toastNotification.classList.add("hidden");
  }, 2000);
}

// =============================================================================
// ET (エオルゼア時間) タイマー
// =============================================================================

const EORZEA_MULTIPLIER = 144 / 7;

function getEorzeaDate(date = new Date()) {
  const epoch = date.getTime() * EORZEA_MULTIPLIER;
  const etHours = Math.floor((epoch / (1000 * 60 * 60)) % 24);
  const etMinutes = Math.floor((epoch / (1000 * 60)) % 60);
  return { etHours, etMinutes };
}

function setupEtClock() {
  function update() {
    const { etHours, etMinutes } = getEorzeaDate();
    const hh = String(etHours).padStart(2, "0");
    const mm = String(etMinutes).padStart(2, "0");
    elements.etClockDisplay.textContent = `ET ${hh}:${mm}`;
  }
  update();
  setInterval(update, 2000);
}

// =============================================================================
// GAS 通信モジュール
// =============================================================================

async function loadDataFromGAS() {
  updateSyncStatus("● 読み込み中...", "loading");

  try {
    const response = await fetch(GAS_API_URL);
    if (!response.ok) throw new Error(`HTTP通信エラー: ${response.status}`);

    const result = await response.json();
    if (result.status === "success") {
      currentRecipes = result.data;
      renderRecipeList();
      updateSyncStatus("● 接続完了 (最新データ同期済み)", "ready");
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    console.error("GASエラー:", err);
    updateSyncStatus("❌ 接続エラー", "error");
  }
}

async function postDataToGAS(payload) {
  updateSyncStatus("● スプレッドシートを更新中...", "loading");
  
  const currentPass = localStorage.getItem(STORAGE_KEYS.ADMIN_PASS) || "";
  payload.adminPass = currentPass;

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);

    const result = await response.json();
    if (result.status === "success") {
      updateSyncStatus("● 更新完了", "ready");
      await loadDataFromGAS();
      return true;
    }
    throw new Error(result.message);
  } catch (err) {
    updateSyncStatus("❌ 更新失敗", "error");
    alert("エラー: " + err.message);
    return false;
  }
}

// =============================================================================
// セキュリティ・管理者ロック
// =============================================================================

function checkAdminAuth() {
  if (isAdminAuthenticated) {
    elements.adminLockScreen.classList.add("hidden");
    elements.adminFormContainer.classList.remove("hidden");
  } else {
    elements.adminLockScreen.classList.remove("hidden");
    elements.adminFormContainer.classList.add("hidden");
  }
}

async function authenticateWithPasscode() {
  const input = prompt("管理用パスコードを入力してください:");
  if (!input) return;

  showToast("パスコードを照合中...");

  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "verify", adminPass: input })
    });
    const data = await res.json();

    if (data.status === "success") {
      localStorage.setItem(STORAGE_KEYS.ADMIN_PASS, input);
      isAdminAuthenticated = true;
      checkAdminAuth();
      showToast("管理者認証に成功しました！");
    } else {
      alert("パスコードが間違っています。");
    }
  } catch (err) {
    alert("通信エラーが発生しました: " + err.message);
  }
}

// =============================================================================
// 検索 ＆ カートモジュール
// =============================================================================

function normalizeJapanese(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60)).trim();
}

function setupSearchFeature() {
  elements.itemSearchInput.addEventListener("input", () => {
    const query = normalizeJapanese(elements.itemSearchInput.value);
    if (!query) {
      elements.searchSuggestions.classList.add("hidden");
      elements.searchSuggestions.innerHTML = "";
      return;
    }

    const matches = currentRecipes.filter(r => normalizeJapanese(r.name).includes(query));
    renderSearchSuggestions(matches);
  });

  document.addEventListener("click", (e) => {
    if (!elements.itemSearchInput.contains(e.target) && !elements.searchSuggestions.contains(e.target)) {
      elements.searchSuggestions.classList.add("hidden");
    }
  });

  elements.addToCartBtn.addEventListener("click", () => {
    const name = elements.selectedItemName.value.trim();
    const amount = clampValue(elements.targetAmount.value, 1, 999);

    if (!name) {
      alert("検索候補からアイテムを選択してください。");
      return;
    }

    const existing = craftCart.find(c => c.name === name);
    if (existing) {
      existing.amount = clampValue(existing.amount + amount, 1, 999);
    } else {
      craftCart.push({ name, amount });
    }

    elements.itemSearchInput.value = "";
    elements.selectedItemName.value = "";
    elements.targetAmount.value = "1";
    renderCart();
  });

  elements.calcAllBtn.addEventListener("click", () => {
    if (craftCart.length === 0) return;
    calculateMultipleTargets(craftCart);
  });
}

function renderSearchSuggestions(matches) {
  elements.searchSuggestions.innerHTML = "";
  if (matches.length === 0) {
    elements.searchSuggestions.innerHTML = `<div class="suggestion-item" style="color:var(--text-muted);">一致するアイテムがありません</div>`;
    elements.searchSuggestions.classList.remove("hidden");
    return;
  }

  matches.slice(0, 10).forEach(item => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    const jobBadge = item.job ? `[${item.job}]` : "";
    const typeLabel = item.ingredients && item.ingredients.length > 0 ? (jobBadge || "製作") : (
      item.type === "battle" ? "戦闘" : item.type === "shop" ? "店売" : (jobBadge || "採集")
    );

    div.innerHTML = `
      <span>${escapeHtml(item.name)}</span>
      <span class="suggestion-type">${typeLabel}</span>
    `;

    div.addEventListener("click", () => {
      elements.selectedItemName.value = item.name;
      elements.itemSearchInput.value = item.name;
      elements.searchSuggestions.classList.add("hidden");
    });

    elements.searchSuggestions.appendChild(div);
  });

  elements.searchSuggestions.classList.remove("hidden");
}

function renderCart() {
  elements.cartItemsList.innerHTML = "";
  elements.cartCount.textContent = String(craftCart.length);

  if (craftCart.length === 0) {
    elements.cartItemsList.appendChild(elements.cartEmptyMsg);
    elements.calcAllBtn.disabled = true;
    return;
  }

  elements.calcAllBtn.disabled = false;

  craftCart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <span class="cart-item-title">${escapeHtml(item.name)}</span>
        <span class="cart-item-amount">× ${item.amount} 個</span>
      </div>
      <button type="button" class="btn btn-danger btn-sm" style="min-width:32px; height:32px; padding:0 0.5rem;">✕</button>
    `;

    row.querySelector("button")?.addEventListener("click", () => {
      craftCart.splice(index, 1);
      renderCart();
    });

    elements.cartItemsList.appendChild(row);
  });
}

// =============================================================================
// コアロジック: 再帰分解 ＆ 所持数差分 ＆ エリア別グループ化
// =============================================================================

function calculateMultipleTargets(targets) {
  currentBaseMaterialsMap.clear();
  currentIntermediateCraftsMap.clear();

  function resolve(name, needed, depth, isRoot = false) {
    if (depth > 20) throw new Error(`循環参照を検知: ${name}`);

    const recipe = currentRecipes.find(r => r.name === name);
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      currentBaseMaterialsMap.set(name, (currentBaseMaterialsMap.get(name) || 0) + needed);
      return;
    }

    const mult = Math.ceil(needed / (recipe.yields || 1));

    if (!isRoot) {
      const existing = currentIntermediateCraftsMap.get(name);
      const totalAmount = (existing ? existing.amount : 0) + needed;
      currentIntermediateCraftsMap.set(name, {
        amount: totalAmount,
        job: recipe.job || "製作クラス未指定"
      });
    }

    for (const ing of recipe.ingredients) {
      resolve(ing.name, ing.amount * mult, depth + 1, false);
    }
  }

  try {
    for (const target of targets) {
      resolve(target.name, target.amount, 0, true);
    }
    renderIntermediateCrafts(currentIntermediateCraftsMap);
    renderResults();
    updateTeleportSelectOptions();
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
}

function renderIntermediateCrafts(craftMap) {
  elements.intermediateCraftsList.innerHTML = "";
  if (craftMap.size === 0) {
    elements.intermediateCraftsContainer.classList.add("hidden");
    return;
  }

  craftMap.forEach((data, name) => {
    const row = document.createElement("div");
    row.className = "craft-job-item";
    const jobsArray = data.job.split(",").map(j => j.trim()).filter(Boolean);
    const jobsFormatted = jobsArray.length > 0 ? jobsArray.map(j => `🔨 ${j}`).join(" / ") : "製作クラス未指定";

    row.innerHTML = `
      <div>
        <span style="font-weight:bold; color:var(--text-main);">${escapeHtml(name)}</span>
        <span style="color:var(--accent-cyan); font-weight:bold; margin-left:0.5rem;">× ${data.amount} 個</span>
      </div>
      <span class="craft-job-badge">${escapeHtml(jobsFormatted)}</span>
    `;
    elements.intermediateCraftsList.appendChild(row);
  });

  elements.intermediateCraftsContainer.classList.remove("hidden");
}

function renderResults() {
  elements.resultItemsList.innerHTML = "";
  elements.routeResultsContainer.classList.add("hidden");

  if (currentBaseMaterialsMap.size === 0) {
    elements.resultItemsList.innerHTML = `<p class="desc">末端素材がありません。</p>`;
    elements.calcResults.classList.remove("hidden");
    return;
  }

  if (currentViewMode === "group") {
    renderGroupedResults();
  } else {
    renderStandardResults();
  }

  elements.calcResults.classList.remove("hidden");
  elements.calcResults.scrollIntoView({ behavior: "smooth" });
}

function renderStandardResults() {
  currentBaseMaterialsMap.forEach((requiredAmount, name) => {
    const card = createMaterialCard(name, requiredAmount);
    elements.resultItemsList.appendChild(card);
  });
}

function renderGroupedResults() {
  const groups = new Map();

  currentBaseMaterialsMap.forEach((requiredAmount, name) => {
    const itemData = currentRecipes.find(r => r.name === name);
    let groupKey = "その他 / クラフト・店売り・未登録素材";

    if (itemData && itemData.type === "gather" && (itemData.zone || itemData.location)) {
      groupKey = `📍 ${itemData.zone || "エリア未指定"}（最寄り：${itemData.location || "エーテライト未指定"}）`;
    }

    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push({ name, requiredAmount });
  });

  groups.forEach((items, groupTitle) => {
    const groupSection = document.createElement("div");
    groupSection.className = "group-section";
    groupSection.innerHTML = `
      <div class="group-header">
        <span>${escapeHtml(groupTitle)}</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">${items.length}品目</span>
      </div>
      <div class="group-body"></div>
    `;

    const body = groupSection.querySelector(".group-body");
    items.forEach(item => {
      body.appendChild(createMaterialCard(item.name, item.requiredAmount));
    });

    elements.resultItemsList.appendChild(groupSection);
  });
}

function createMaterialCard(name, requiredAmount) {
  const itemData = currentRecipes.find(r => r.name === name);
  const possessed = currentPossessedMap.get(name) || 0;
  const shortage = Math.max(0, requiredAmount - possessed);
  const isComplete = (shortage === 0);

  const card = document.createElement("div");
  card.className = `result-card ${isComplete ? "done" : ""}`;

  let badgeHtml = "";
  let copyButtonHtml = "";

  if (!itemData) {
    badgeHtml = `<div class="badge-type empty">未登録の素材</div>`;
  } else if (itemData.type === "battle") {
    badgeHtml = `<div class="badge-type battle">⚔️ 戦闘: ${escapeHtml(itemData.note || "ドロップ / ジェム交換 / リテイナー")}</div>`;
  } else if (itemData.type === "shop") {
    badgeHtml = `<div class="badge-type shop">🛒 店売り / 交換: ${escapeHtml(itemData.note || "ショップ・軍票等")}</div>`;
  } else {
    const jobsArray = (itemData.job || "").split(",").map(j => j.trim()).filter(Boolean);
    const jobsFormatted = jobsArray.map(j => {
      const icon = j === "園芸師" ? "🪓" : j === "漁師" ? "🎣" : "⛏️";
      return `${icon} ${j}`;
    }).join(" / ");

    const jobLabel = jobsFormatted ? `[${jobsFormatted}] ` : "";
    const coordStr = itemData.coords ? `(X: ${itemData.coords.x.toFixed(1)}, Y: ${itemData.coords.y.toFixed(1)})` : "";
    const locText = `${jobLabel}${itemData.zone || ""} ${itemData.location ? "/ " + itemData.location : ""} ${coordStr}`.trim();

    if (itemData.coords) {
      copyButtonHtml = `<button type="button" class="btn-copy-pos" data-pos="/p 採集地点: <pos> ${itemData.zone || ""} (X:${itemData.coords.x.toFixed(1)} Y:${itemData.coords.y.toFixed(1)})">📋 座標コピー</button>`;
    }

    badgeHtml = locText
      ? `<div class="badge-type gather">📍 採集: ${escapeHtml(locText)} ${copyButtonHtml}</div>`
      : `<div class="badge-type empty">採集場所 未登録</div>`;
  }

  card.innerHTML = `
    <div class="result-header">
      <span class="item-title">${escapeHtml(name)}</span>
      <span class="badge-amount ${isComplete ? "complete" : "shortage"}">
        ${isComplete ? "採集完了 (0個)" : `不足: ${shortage} 個`} (計 ${requiredAmount})
      </span>
    </div>
    ${badgeHtml}
    
    <div class="possessed-input-row">
      <span class="possessed-label">所持数:</span>
      <div class="possessed-controls">
        <input type="number" min="0" max="999" class="possessed-input" value="${possessed}">
        <button type="button" class="btn-quick btn-pos-add" data-add="1">+1</button>
        <button type="button" class="btn-quick btn-pos-add" data-add="10">+10</button>
        <button type="button" class="btn-quick btn-pos-add" data-add="clear">C</button>
      </div>
    </div>
  `;

  const posInput = card.querySelector(".possessed-input");
  posInput.addEventListener("change", () => {
    currentPossessedMap.set(name, clampValue(posInput.value, 0, 999));
    renderResults();
  });

  card.querySelectorAll(".btn-pos-add").forEach(btn => {
    btn.addEventListener("click", () => {
      const add = btn.getAttribute("data-add");
      let cur = currentPossessedMap.get(name) || 0;
      if (add === "clear") cur = 0;
      else cur += parseInt(add, 10);
      currentPossessedMap.set(name, clampValue(cur, 0, 999));
      renderResults();
    });
  });

  const copyBtn = card.querySelector(".btn-copy-pos");
  if (copyBtn) {
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const posText = copyBtn.getAttribute("data-pos");
      if (posText && navigator.clipboard) {
        navigator.clipboard.writeText(posText).then(() => showToast("チャット用マクロをコピーしました！"));
      }
    });
  }

  return card;
}

// =============================================================================
// テレポ巡回最適化 (不足分のみ計算)
// =============================================================================

function estimateTeleportCost(pointA, pointB, freeDest, favDest) {
  if (!pointA || !pointB) return 0;
  if (pointA.location && pointB.location && pointA.location === pointB.location) return 0;
  if (pointB.location && pointB.location === freeDest) return 0;

  let baseCost = 100;
  const regA = pointA.region || "unknown";
  const regB = pointB.region || "unknown";

  if (regA === regB) {
    baseCost = 210;
  } else if (
    (regA === "norvrandt" && regB !== "norvrandt") ||
    (regB === "norvrandt" && regA !== "norvrandt") ||
    regA === "moon" || regB === "moon" ||
    regA === "elpis" || regB === "elpis"
  ) {
    baseCost = 980;
  } else {
    baseCost = 620;
  }

  if (pointB.location && pointB.location === favDest) {
    return Math.floor(baseCost * 0.5);
  }
  return baseCost;
}

function optimizeTeleportRoute() {
  const startCityKey = elements.routeStartCity.value;
  const startCity = CITIES[startCityKey];
  const freeDest = elements.routeFreeDest.value;
  const favDest = elements.routeFavDest.value;

  const nodeMap = new Map();

  currentBaseMaterialsMap.forEach((requiredAmount, name) => {
    const possessed = currentPossessedMap.get(name) || 0;
    const shortage = Math.max(0, requiredAmount - possessed);

    if (shortage > 0) {
      const item = currentRecipes.find(r => r.name === name);
      if (item && item.type === "gather" && item.location) {
        const locKey = item.location;
        if (!nodeMap.has(locKey)) {
          const zone = item.zone || "";
          nodeMap.set(locKey, {
            location: item.location,
            zone: item.zone || "",
            region: ZONE_REGION_MAP[zone] || "unknown",
            coords: item.coords || null,
            items: []
          });
        }
        nodeMap.get(locKey)?.items.push({ name, amount: shortage, job: item.job || "採集" });
      }
    }
  });

  const destinations = Array.from(nodeMap.values());
  if (destinations.length === 0) {
    alert("採集が必要な不足素材（エーテライト登録あり）がありません！\nすべて所持しているか、戦闘・店売り素材のみです。");
    return;
  }

  const startNode = {
    location: startCity.name,
    zone: startCity.name,
    region: startCity.region,
    coords: null,
    items: []
  };

  let bestRoute = null;
  let minCost = Infinity;

  function permute(arr, m = []) {
    if (arr.length === 0) {
      let cost = 0;
      let prev = startNode;
      for (const dest of m) {
        cost += estimateTeleportCost(prev, dest, freeDest, favDest);
        prev = dest;
      }
      if (cost < minCost) {
        minCost = cost;
        bestRoute = [...m];
      }
    } else {
      for (let i = 0; i < arr.length; i++) {
        const curr = arr.slice();
        const next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next));
      }
    }
  }

  permute(destinations);

  if (bestRoute) {
    renderOptimizedRoute(startNode, bestRoute, minCost, freeDest, favDest);
  }
}

function renderOptimizedRoute(startNode, route, totalCost, freeDest, favDest) {
  elements.routeTimeline.innerHTML = "";
  elements.routeTotalGil.textContent = totalCost.toLocaleString();
  elements.routeDiscountInfo.textContent = (freeDest || favDest) ? "※ 無料/お気に入り割引適用済み" : "";

  let prevNode = startNode;

  route.forEach((dest, index) => {
    const cost = estimateTeleportCost(prevNode, dest, freeDest, favDest);
    const itemsSummary = dest.items.map(i => `${i.name} [${i.job}] × ${i.amount}`).join("、 ");
    const coordStr = dest.coords ? `(X: ${dest.coords.x.toFixed(1)}, Y: ${dest.coords.y.toFixed(1)})` : "";

    const stepCard = document.createElement("div");
    stepCard.className = "timeline-step";
    stepCard.innerHTML = `
      <div class="step-number">${index + 1}</div>
      <div class="step-content">
        <div class="step-dest">📍 ${escapeHtml(dest.zone)} / ${escapeHtml(dest.location)} ${coordStr}</div>
        <div class="step-details">移動元: ${escapeHtml(prevNode.location)} からテレポ</div>
        <div class="step-materials">採集対象 (不足分): ${escapeHtml(itemsSummary)}</div>
      </div>
      <div class="step-cost-badge">${cost === 0 ? "無料" : cost + " G"}</div>
    `;
    elements.routeTimeline.appendChild(stepCard);
    prevNode = dest;
  });

  elements.routeResultsContainer.classList.remove("hidden");
  elements.routeResultsContainer.scrollIntoView({ behavior: "smooth" });
}

function updateTeleportSelectOptions() {
  const etherytes = new Set();
  currentBaseMaterialsMap.forEach((_, name) => {
    const item = currentRecipes.find(r => r.name === name);
    if (item && item.type === "gather" && item.location) {
      etherytes.add(item.location);
    }
  });

  const generateOptionsHtml = (defaultText) => {
    let html = `<option value="">${defaultText}</option>`;
    etherytes.forEach(eth => {
      html += `<option value="${escapeHtml(eth)}">${escapeHtml(eth)}</option>`;
    });
    return html;
  };

  elements.routeFreeDest.innerHTML = generateOptionsHtml("設定なし");
  elements.routeFavDest.innerHTML = generateOptionsHtml("設定なし");
}

// =============================================================================
// UIイベント ＆ 登録フォーム
// =============================================================================

function setupTabs() {
  elements.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      if (targetId === "recipe-view") checkAdminAuth();

      elements.tabButtons.forEach(b => b.classList.remove("active"));
      elements.tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      if (targetId) document.getElementById(targetId)?.classList.add("active");
    });
  });
}

function addIngredientRow(name = "", amount = 1) {
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <input type="text" class="ing-name" placeholder="素材名" value="${escapeHtml(name)}" required>
    <input type="number" class="ing-amount" placeholder="数量" min="1" max="999" value="${amount}" required style="width: 80px;">
    <button type="button" class="btn-remove-ing" title="削除">&times;</button>
  `;
  row.querySelector(".btn-remove-ing")?.addEventListener("click", () => row.remove());
  elements.ingredientsContainer.appendChild(row);
}

function setupQuickButtons() {
  document.querySelectorAll(".btn-quick").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const addVal = btn.getAttribute("data-val");
      const input = document.getElementById(targetId);
      if (!input) return;

      let cur = parseInt(input.value, 10) || 0;
      if (addVal === "clear") cur = 0;
      else cur += parseInt(addVal, 10);

      input.value = String(Math.max(0, Math.min(999, cur)));
      input.dispatchEvent(new Event("input"));
    });
  });
}

function clampValue(val, min = 0, max = 999) {
  let num = parseInt(val, 10);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function setupEventListeners() {
  elements.toggleViewModeBtn.addEventListener("click", () => {
    if (currentViewMode === "group") {
      currentViewMode = "list";
      elements.toggleViewModeBtn.textContent = "📍 エリア別グループ表示に切替";
    } else {
      currentViewMode = "group";
      elements.toggleViewModeBtn.textContent = "📋 通常一覧表示に切替";
    }
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, currentViewMode);
    renderResults();
  });

  elements.authPasscodeBtn.addEventListener("click", authenticateWithPasscode);
  elements.lockAdminBtn.addEventListener("click", () => {
    isAdminAuthenticated = false;
    checkAdminAuth();
    showToast("編集権限をロックしました");
  });

  elements.btnXivapiFetch.addEventListener("click", fetchFromXivapi);

  elements.itemType.addEventListener("change", () => {
    const type = elements.itemType.value;
    if (type === "gather") {
      elements.gatherJobField.classList.remove("hidden");
      elements.gatherFields.classList.remove("hidden");
      elements.craftFields.classList.add("hidden");
      elements.noteFields.classList.add("hidden");
    } else if (type === "craft") {
      elements.gatherJobField.classList.add("hidden");
      elements.gatherFields.classList.add("hidden");
      elements.craftFields.classList.remove("hidden");
      elements.noteFields.classList.add("hidden");
    } else {
      elements.gatherJobField.classList.add("hidden");
      elements.gatherFields.classList.add("hidden");
      elements.craftFields.classList.add("hidden");
      elements.noteFields.classList.remove("hidden");
    }
  });

  elements.addIngredientBtn.addEventListener("click", () => addIngredientRow());

  elements.recipeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = elements.itemName.value.trim();
    const yields = clampValue(elements.itemYield.value, 1, 99);
    const type = elements.itemType.value;
    
    let selectedJobs = [];
    if (type === "craft") {
      const checked = elements.craftFields.querySelectorAll('input[name="craft-job"]:checked');
      selectedJobs = Array.from(checked).map(cb => cb.value);
    } else if (type === "gather") {
      const checked = elements.gatherJobField.querySelectorAll('input[name="gather-job"]:checked');
      selectedJobs = Array.from(checked).map(cb => cb.value);
    }
    const job = selectedJobs.join(", ");

    const zone = elements.itemZone.value.trim();
    const location = elements.itemLocation.value.trim();
    const note = elements.itemNote.value.trim();

    const xVal = parseFloat(elements.coordX.value);
    const yVal = parseFloat(elements.coordY.value);
    const coords = (!isNaN(xVal) && !isNaN(yVal)) ? { x: xVal, y: yVal } : null;

    const ingredients = [];
    elements.ingredientsContainer.querySelectorAll(".ingredient-row").forEach(row => {
      const ingName = row.querySelector(".ing-name").value.trim();
      const ingAmount = clampValue(row.querySelector(".ing-amount").value, 1, 999);
      if (ingName) ingredients.push({ name: ingName, amount: ingAmount });
    });

    const item = {
      id: "item-" + Date.now(),
      name,
      yields,
      type,
      job,
      zone: type === "gather" ? zone : "",
      location: type === "gather" ? location : "",
      coords: type === "gather" ? coords : null,
      note: (type !== "gather" && type !== "craft") ? note : "",
      ingredients
    };

    elements.saveRecipeBtn.disabled = true;
    const success = await postDataToGAS({ action: "save", item });
    elements.saveRecipeBtn.disabled = false;

    if (success) {
      elements.recipeForm.reset();
      elements.ingredientsContainer.innerHTML = "";
      elements.craftFields.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      elements.gatherJobField.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
      elements.itemType.dispatchEvent(new Event("change"));
      showToast(`「${name}」をスプレッドシートへ保存しました。`);
    }
  });

  elements.calcRouteBtn.addEventListener("click", optimizeTeleportRoute);
  elements.refreshSheetBtn.addEventListener("click", loadDataFromGAS);
}

// XIVAPI 自動入力 (安定版ミラー ＆ 自動リトライ搭載)
async function fetchFromXivapi() {
  const itemName = elements.itemName.value.trim();
  if (!itemName) {
    alert("アイテム名を入力してください。");
    return;
  }

  elements.btnXivapiFetch.disabled = true;
  elements.btnXivapiFetch.textContent = "検索中...";

  // 安定して動いている2つのサーバーを準備
  const apis = [
    `https://cafemaker.wakingsands.com/search?string=${encodeURIComponent(itemName)}&indexes=Item`,
    `https://xivapi.com/search?string=${encodeURIComponent(itemName)}&indexes=Item`
  ];

  let success = false;

  for (const apiUrl of apis) {
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) continue; // 500エラーが出たら、次の予備サーバーへ切り替え！

      const data = await res.json();
      if (!data.Results || data.Results.length === 0) continue;

      const itemInfo = data.Results[0];
      const host = new URL(apiUrl).origin;
      const detailRes = await fetch(`${host}/item/${itemInfo.ID}`);
      const detail = await detailRes.json();

      // クラフトレシピの自動展開
      if (detail.Recipes && detail.Recipes.length > 0) {
        elements.itemType.value = "craft";
        elements.itemType.dispatchEvent(new Event("change"));
        
        const r = detail.Recipes[0];
        const jobNames = ["木工師", "鍛冶師", "甲冑師", "彫金師", "革細工師", "裁縫師", "錬金術師", "調理師"];
        const jobName = r.ClassJobID ? jobNames[r.ClassJobID - 8] : "";

        // 担当ジョブに自動チェック！
        if (jobName) {
          elements.craftFields.querySelectorAll('input[name="craft-job"]').forEach(cb => {
            cb.checked = (cb.value === jobName);
          });
        }

        // 素材一覧を自動展開！
        elements.ingredientsContainer.innerHTML = "";
        for (let i = 0; i <= 9; i++) {
          const ingItem = r[`ItemIngredient${i}`];
          const ingCount = r[`AmountIngredient${i}`];
          if (ingItem && ingCount > 0) {
            addIngredientRow(ingItem.Name_ja || ingItem.Name, ingCount);
          }
        }
      } else {
        // 採集アイテムの場合
        elements.itemType.value = "gather";
        elements.itemType.dispatchEvent(new Event("change"));
      }

      showToast("APIからレシピを自動取得しました！");
      success = true;
      break; // 成功したので終了！
    } catch (e) {
      console.warn("APIリトライ中...", e);
    }
  }

  elements.btnXivapiFetch.disabled = false;
  elements.btnXivapiFetch.textContent = "🔍 APIから自動入力";

  if (!success) {
    alert("⚠️ アイテムが見つかりませんでした。手動で入力してください。");
  }
}
function renderRecipeList() {
  elements.registeredRecipesList.innerHTML = "";
  elements.recipeCount.textContent = String(currentRecipes.length);

  if (currentRecipes.length === 0) {
    elements.registeredRecipesList.innerHTML = `<p class="desc">登録されたレシピはありません。</p>`;
    return;
  }

  currentRecipes.forEach(r => {
    const item = document.createElement("div");
    item.className = "recipe-item";

    const ingText = r.ingredients && r.ingredients.length > 0
      ? r.ingredients.map(i => `${i.name}×${i.amount}`).join(", ")
      : "末端素材";

    let badgeHtml = "";
    if (r.type === "craft" || (r.ingredients && r.ingredients.length > 0)) {
      const jobsArray = (r.job || "").split(",").map(j => j.trim()).filter(Boolean);
      const jobsFormatted = jobsArray.length > 0 ? jobsArray.map(j => `🔨 ${j}`).join(" / ") : "製作クラス未指定";
      badgeHtml = `<div class="badge-type" style="background:rgba(243, 156, 18, 0.1); border:1px solid rgba(243, 156, 18, 0.35); color:var(--accent-gold); font-size:0.8rem; margin-top:4px;">${escapeHtml(jobsFormatted)}</div>`;
    } else if (r.type === "battle") {
      badgeHtml = `<div class="badge-type battle" style="font-size:0.8rem; margin-top:4px;">⚔️ 戦闘: ${escapeHtml(r.note || "なし")}</div>`;
    } else if (r.type === "shop") {
      badgeHtml = `<div class="badge-type shop" style="font-size:0.8rem; margin-top:4px;">🛒 店売り: ${escapeHtml(r.note || "なし")}</div>`;
    } else {
      const jobsArray = (r.job || "").split(",").map(j => j.trim()).filter(Boolean);
      const jobsFormatted = jobsArray.map(j => {
        const icon = j === "園芸師" ? "🪓" : j === "漁師" ? "🎣" : "⛏️";
        return `${icon} ${j}`;
      }).join(" / ");

      const jobLabel = jobsFormatted ? `[${jobsFormatted}] ` : "";
      const coordStr = r.coords ? `(X:${r.coords.x}, Y:${r.coords.y})` : "";
      badgeHtml = `<div class="badge-type gather" style="font-size:0.8rem; margin-top:4px;">📍 採集: ${escapeHtml(jobLabel)}${escapeHtml(r.zone || "")} ${escapeHtml(r.location || "")} ${coordStr}</div>`;
    }

    item.innerHTML = `
      <div class="recipe-header">
        <span class="item-title">${escapeHtml(r.name)}</span>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${r.id}">削除</button>
      </div>
      <div class="recipe-details">制作/獲得数: ${r.yields}個 | 素材: [ ${escapeHtml(ingText)} ]</div>
      ${badgeHtml}
    `;

    item.querySelector(".delete-btn")?.addEventListener("click", async () => {
      if (confirm(`「${r.name}」をスプレッドシートから削除しますか？`)) {
        await postDataToGAS({ action: "delete", id: r.id });
      }
    });

    elements.registeredRecipesList.appendChild(item);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

document.addEventListener("DOMContentLoaded", init);