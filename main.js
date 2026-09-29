/**
 * XIV Craft & Route Optimizer (GAS API Connected)
 */

// ★ デプロイしたGASのウェブアプリURLをここに貼り付けてください
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxt6h62y5Dupnzcf8U3bZtFI4jqeaN3nRdrumQxbzTk6QqGCgzE2eX_YvZgG1GRxV6R/exec";

const CITIES = {
  old_sharlayan: { name: "オールド・シャーレアン", region: "sharlayan" },
  tuliyollal:    { name: "トライヨラ",           region: "tural" },
  limsa_lominsa: { name: "リムサ・ロミンサ",     region: "la_noscea" },
  gridania:      { name: "グリダニア",           region: "black_shroud" },
  uldah:         { name: "ウルダハ",             region: "thanalan" },
  crystarium:    { name: "クリスタリウム",       region: "norvrandt" },
  kugane:        { name: "クガネ",               region: "othard" },
  ishgard:       { name: "イシュガルド",         region: "ishgard" }
};

const ZONE_REGION_MAP = {
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
  "クルザス中央高地": "ishgard",
  "高地ドラヴァニア": "ishgard",
  "紅玉海": "othard",
  "ヤンサ": "othard",
  "オルコ・パチャ": "tural",
  "コザマル・カ": "tural",
  "ヤクテル樹海": "tural",
  "シャーローニ荒野": "tural"
};

let currentRecipes = [];
let currentBaseMaterialsMap = new Map();

const elements = {
  syncStatus: document.getElementById("sync-status"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),
  calcForm: document.getElementById("calc-form"),
  calcItemSelect: document.getElementById("calc-item-select"),
  calcTargetAmount: document.getElementById("calc-target-amount"),
  calcResults: document.getElementById("calc-results"),
  resultItemsList: document.getElementById("result-items-list"),
  routeStartCity: document.getElementById("route-start-city"),
  routeFreeDest: document.getElementById("route-free-dest"),
  routeFavDest: document.getElementById("route-fav-dest"),
  calcRouteBtn: document.getElementById("calc-route-btn"),
  routeResultsContainer: document.getElementById("route-results-container"),
  routeTotalGil: document.getElementById("route-total-gil"),
  routeDiscountInfo: document.getElementById("route-discount-info"),
  routeTimeline: document.getElementById("route-timeline"),
  recipeForm: document.getElementById("recipe-form"),
  itemName: document.getElementById("item-name"),
  itemYield: document.getElementById("item-yield"),
  itemType: document.getElementById("item-type"),
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
  refreshSheetBtn: document.getElementById("refresh-sheet-btn")
};

function init() {
  setupTabs();
  setupEventListeners();
  loadDataFromGAS();
}

function updateSyncStatus(text, stateClass) {
  elements.syncStatus.textContent = text;
  elements.syncStatus.className = `sync-status ${stateClass}`;
}

/**
 * GASから全データを非同期取得
 */
async function loadDataFromGAS() {
  if (!GAS_API_URL || GAS_API_URL.includes("ここにGAS")) {
    updateSyncStatus("⚠️ GAS_API_URL未設定", "error");
    return;
  }

  updateSyncStatus("● スプレッドシートから読み込み中...", "loading");

  try {
    const response = await fetch(GAS_API_URL);
    const result = await response.json();

    if (result.status === "success") {
      currentRecipes = result.data;
      renderRecipeList();
      renderCalcSelectOptions();
      updateSyncStatus("● 接続完了 (最新データ同期済み)", "ready");
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    console.error("GAS読み込みエラー:", err);
    updateSyncStatus("❌ 接続エラー", "error");
  }
}

/**
 * GASへPOST送信
 */
async function postDataToGAS(payload) {
  updateSyncStatus("● スプレッドシートを更新中...", "loading");
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status === "success") {
      updateSyncStatus("● 更新完了", "ready");
      await loadDataFromGAS();
      return true;
    } else {
      throw new Error(result.message);
    }
  } catch (err) {
    console.error("GAS更新エラー:", err);
    updateSyncStatus("❌ 更新失敗", "error");
    alert("更新に失敗しました: " + err.message);
    return false;
  }
}

function setupTabs() {
  elements.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      elements.tabButtons.forEach(b => b.classList.remove("active"));
      elements.tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      document.getElementById(targetId).classList.add("active");

      if (targetId === "calc-view") renderCalcSelectOptions();
    });
  });
}

function addIngredientRow(name = "", amount = 1) {
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <input type="text" class="ing-name" placeholder="素材名" value="${escapeHtml(name)}" required>
    <input type="number" class="ing-amount" placeholder="数量" min="1" value="${amount}" required style="width: 80px;">
    <button type="button" class="btn-remove-ing">&times;</button>
  `;
  row.querySelector(".btn-remove-ing").addEventListener("click", () => row.remove());
  elements.ingredientsContainer.appendChild(row);
}

function setupEventListeners() {
  // 入手タイプ切り替え
  elements.itemType.addEventListener("change", () => {
    const type = elements.itemType.value;
    if (type === "gather") {
      elements.gatherFields.classList.remove("hidden");
      elements.noteFields.classList.add("hidden");
    } else {
      elements.gatherFields.classList.add("hidden");
      elements.noteFields.classList.remove("hidden");
    }
  });

  elements.addIngredientBtn.addEventListener("click", () => addIngredientRow());

  // レシピ登録送信
  elements.recipeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = elements.itemName.value.trim();
    const yields = parseInt(elements.itemYield.value, 10) || 1;
    const type = elements.itemType.value;
    const zone = elements.itemZone.value.trim();
    const location = elements.itemLocation.value.trim();
    const note = elements.itemNote.value.trim();

    const xVal = parseFloat(elements.coordX.value);
    const yVal = parseFloat(elements.coordY.value);
    let coords = null;
    if (!isNaN(xVal) && !isNaN(yVal)) {
      coords = { x: xVal, y: yVal };
    }

    const ingredients = [];
    elements.ingredientsContainer.querySelectorAll(".ingredient-row").forEach(row => {
      const ingName = row.querySelector(".ing-name").value.trim();
      const ingAmount = parseInt(row.querySelector(".ing-amount").value, 10) || 1;
      if (ingName) ingredients.push({ name: ingName, amount: ingAmount });
    });

    const item = {
      id: "item-" + Date.now(),
      name,
      yields,
      type,
      zone: type === "gather" ? zone : "",
      location: type === "gather" ? location : "",
      coords: type === "gather" ? coords : null,
      note: type !== "gather" ? note : "",
      ingredients
    };

    elements.saveRecipeBtn.disabled = true;
    const success = await postDataToGAS({ action: "save", item });
    elements.saveRecipeBtn.disabled = false;

    if (success) {
      elements.recipeForm.reset();
      elements.ingredientsContainer.innerHTML = "";
      elements.itemType.dispatchEvent(new Event("change"));
      alert(`「${name}」をスプレッドシートへ保存しました。`);
    }
  });

  // 計算実行
  elements.calcForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const itemName = elements.calcItemSelect.value;
    const amount = parseInt(elements.calcTargetAmount.value, 10) || 1;
    if (!itemName) return;
    calculateBaseMaterials(itemName, amount);
  });

  elements.calcRouteBtn.addEventListener("click", optimizeTeleportRoute);
  elements.refreshSheetBtn.addEventListener("click", loadDataFromGAS);
}

/**
 * 再帰的末端素材分解ロジック
 */
function calculateBaseMaterials(rootName, rootAmount) {
  currentBaseMaterialsMap.clear();

  function resolve(name, needed, depth) {
    if (depth > 20) throw new Error("循環参照を検知しました。");

    const recipe = currentRecipes.find(r => r.name === name);
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      currentBaseMaterialsMap.set(name, (currentBaseMaterialsMap.get(name) || 0) + needed);
      return;
    }

    const mult = Math.ceil(needed / (recipe.yields || 1));
    for (const ing of recipe.ingredients) {
      resolve(ing.name, ing.amount * mult, depth + 1);
    }
  }

  try {
    resolve(rootName, rootAmount, 0);
    renderResults(currentBaseMaterialsMap);
    updateTeleportSelectOptions();
  } catch (err) {
    alert(err.message);
  }
}

/**
 * 末端素材の入手タイプ別バッジ描画
 */
function renderResults(baseMap) {
  elements.resultItemsList.innerHTML = "";
  elements.routeResultsContainer.classList.add("hidden");

  if (baseMap.size === 0) {
    elements.resultItemsList.innerHTML = `<p class="desc">末端素材がありません。</p>`;
    elements.calcResults.classList.remove("hidden");
    return;
  }

  baseMap.forEach((amount, name) => {
    const itemData = currentRecipes.find(r => r.name === name);
    let badgeHtml = "";

    if (!itemData) {
      badgeHtml = `<div class="badge-type empty">未登録の素材</div>`;
    } else if (itemData.type === "battle") {
      badgeHtml = `<div class="badge-type battle">⚔️ 戦闘: ${escapeHtml(itemData.note || "ドロップ / バイカラージェム / リテイナー")}</div>`;
    } else if (itemData.type === "shop") {
      badgeHtml = `<div class="badge-type shop">🛒 店売り / 交換: ${escapeHtml(itemData.note || "ショップ・軍票等")}</div>`;
    } else {
      // 採集 (gather)
      const coordStr = itemData.coords ? `(X: ${itemData.coords.x.toFixed(1)}, Y: ${itemData.coords.y.toFixed(1)})` : "";
      const locText = `${itemData.zone || ""} ${itemData.location ? "/ " + itemData.location : ""} ${coordStr}`.trim();
      badgeHtml = locText
        ? `<div class="badge-type gather">📍 採集: ${escapeHtml(locText)}</div>`
        : `<div class="badge-type empty">採集場所 未登録</div>`;
    }

    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-header">
        <span class="item-title">${escapeHtml(name)}</span>
        <span class="badge-amount">必要数: ${amount} 個</span>
      </div>
      ${badgeHtml}
    `;
    elements.resultItemsList.appendChild(card);
  });

  elements.calcResults.classList.remove("hidden");
  elements.calcResults.scrollIntoView({ behavior: "smooth" });
}

function updateTeleportSelectOptions() {
  const etherytes = new Set();
  currentBaseMaterialsMap.forEach((_, name) => {
    const item = currentRecipes.find(r => r.name === name);
    // 採集タイプかつエーテライトが登録されているもののみ
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

/* ========================================================
   テレポ代最適化 (戦闘・店売りを除外する安全なTSP)
   ======================================================== */

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

  currentBaseMaterialsMap.forEach((amount, name) => {
    const item = currentRecipes.find(r => r.name === name);
    // ★要件③: 戦闘・店売り素材は完全に除外し、「採集かつエーテライトあり」のみを計算対象とする
    if (item && item.type === "gather" && item.location) {
      const locKey = item.location;
      if (!nodeMap.has(locKey)) {
        const zone = item.zone || "";
        nodeMap.set(locKey, {
          location: item.location,
          zone: item.zone || "",
          region: ZONE_REGION_MAP[zone] || "unknown",
          coords: item.coords,
          items: []
        });
      }
      nodeMap.get(locKey).items.push({ name, amount });
    }
  });

  const destinations = Array.from(nodeMap.values());
  if (destinations.length === 0) {
    alert("採集場所（エーテライト）が登録された素材がありません。\n（戦闘素材や店売り素材はテレポ巡回の対象外です）");
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
  renderOptimizedRoute(startNode, bestRoute, minCost, freeDest, favDest);
}

function renderOptimizedRoute(startNode, route, totalCost, freeDest, favDest) {
  elements.routeTimeline.innerHTML = "";
  elements.routeTotalGil.textContent = totalCost.toLocaleString();
  elements.routeDiscountInfo.textContent = (freeDest || favDest) ? "※ 無料/お気に入り割引適用済み" : "";

  let prevNode = startNode;

  route.forEach((dest, index) => {
    const cost = estimateTeleportCost(prevNode, dest, freeDest, favDest);
    const itemsSummary = dest.items.map(i => `${i.name} × ${i.amount}`).join("、 ");
    const coordStr = dest.coords ? `(X: ${dest.coords.x.toFixed(1)}, Y: ${dest.coords.y.toFixed(1)})` : "";

    const stepCard = document.createElement("div");
    stepCard.className = "timeline-step";
    stepCard.innerHTML = `
      <div class="step-number">${index + 1}</div>
      <div class="step-content">
        <div class="step-dest">📍 ${escapeHtml(dest.zone)} / ${escapeHtml(dest.location)} ${coordStr}</div>
        <div class="step-details">移動元: ${escapeHtml(prevNode.location)} からテレポ</div>
        <div class="step-materials">採集対象: ${escapeHtml(itemsSummary)}</div>
      </div>
      <div class="step-cost-badge">${cost === 0 ? "無料" : cost + " G"}</div>
    `;
    elements.routeTimeline.appendChild(stepCard);
    prevNode = dest;
  });

  elements.routeResultsContainer.classList.remove("hidden");
  elements.routeResultsContainer.scrollIntoView({ behavior: "smooth" });
}

function renderRecipeList() {
  elements.registeredRecipesList.innerHTML = "";
  elements.recipeCount.textContent = currentRecipes.length;

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
    if (r.type === "battle") {
      badgeHtml = `<div class="badge-type battle" style="font-size:0.8rem; margin-top:4px;">⚔️ 戦闘: ${escapeHtml(r.note || "なし")}</div>`;
    } else if (r.type === "shop") {
      badgeHtml = `<div class="badge-type shop" style="font-size:0.8rem; margin-top:4px;">🛒 店売り: ${escapeHtml(r.note || "なし")}</div>`;
    } else {
      const coordStr = r.coords ? `(X:${r.coords.x}, Y:${r.coords.y})` : "";
      badgeHtml = `<div class="badge-type gather" style="font-size:0.8rem; margin-top:4px;">📍 採集: ${escapeHtml(r.zone || "")} ${escapeHtml(r.location || "")} ${coordStr}</div>`;
    }

    item.innerHTML = `
      <div class="recipe-header">
        <span class="item-title">${escapeHtml(r.name)}</span>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${r.id}">削除</button>
      </div>
      <div class="recipe-details">制作/獲得数: ${r.yields}個 | 素材: [ ${escapeHtml(ingText)} ]</div>
      ${badgeHtml}
    `;

    item.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm(`「${r.name}」をスプレッドシートから削除しますか？`)) {
        await postDataToGAS({ action: "delete", id: r.id });
      }
    });

    elements.registeredRecipesList.appendChild(item);
  });
}

function renderCalcSelectOptions() {
  const current = elements.calcItemSelect.value;
  elements.calcItemSelect.innerHTML = `<option value="">-- レシピを選択してください --</option>`;

  currentRecipes.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.name;
    const isCraft = r.ingredients && r.ingredients.length > 0;
    opt.textContent = `${r.name} ${isCraft ? "[製作]" : `[${r.type === "battle" ? "戦闘" : r.type === "shop" ? "店売" : "採集"}]`}`;
    elements.calcItemSelect.appendChild(opt);
  });

  if (current) elements.calcItemSelect.value = current;
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