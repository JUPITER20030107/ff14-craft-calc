/**
 * XIV Craft & Route Optimizer
 */

const STORAGE_KEY = "XIV_CRAFT_RECIPES_OPTIMIZER_V1";

// 主要都市とリージョン定義
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

// エリア名からリージョンへの自動マッピング
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
  "リムサ・ロミンサ": "la_noscea",
  "中央ラノシア": "la_noscea",
  "高地ラノシア": "la_noscea",
  "低地ラノシア": "la_noscea",
  "外地ラノシア": "la_noscea",
  "東ラノシア": "la_noscea",
  "西ラノシア": "la_noscea",
  "グリダニア": "black_shroud",
  "黒衣森：中央森林": "black_shroud",
  "黒衣森：東部森林": "black_shroud",
  "黒衣森：南部森林": "black_shroud",
  "黒衣森：北部森林": "black_shroud",
  "ウルダハ": "thanalan",
  "西ザナラーン": "thanalan",
  "中央ザナラーン": "thanalan",
  "東ザナラーン": "thanalan",
  "南ザナラーン": "thanalan",
  "北ザナラーン": "thanalan",
  "イシュガルド": "ishgard",
  "クルザス中央高地": "ishgard",
  "クルザス西部高地": "ishgard",
  "アバラシア雲海": "ishgard",
  "高地ドラヴァニア": "ishgard",
  "低地ドラヴァニア": "ishgard",
  "ドラヴァニア雲海": "ishgard",
  "クガネ": "othard",
  "紅玉海": "othard",
  "ヤンサ": "othard",
  "アジムステップ": "othard",
  "トライヨラ": "tural",
  "オルコ・パチャ": "tural",
  "コザマル・カ": "tural",
  "ヤクテル樹海": "tural",
  "シャーローニ荒野": "tural",
  "ヘリテージファウンド": "tural",
  "リビング・メモリー": "tural"
};

// 初期サンプルデータ
const INITIAL_RECIPES = [
  {
    id: "sample-1",
    name: "ハイダリウムインゴット",
    yields: 1,
    zone: "",
    location: "",
    coords: null,
    ingredients: [
      { name: "輝水鉛鉱", amount: 4 },
      { name: "硬金鉱", amount: 1 }
    ]
  },
  {
    id: "sample-2",
    name: "輝水鉛鉱",
    yields: 1,
    zone: "ラヴィリンソス",
    location: "アルケイオン保管庫",
    coords: { x: 21.4, y: 19.8 },
    ingredients: []
  },
  {
    id: "sample-3",
    name: "硬金鉱",
    yields: 1,
    zone: "イル・メグ",
    location: "リダ・ラーン",
    coords: { x: 29.5, y: 15.2 },
    ingredients: []
  },
  {
    id: "sample-4",
    name: "ハイダリウム・クリナリーナイフ",
    yields: 1,
    zone: "",
    location: "",
    coords: null,
    ingredients: [
      { name: "ハイダリウムインゴット", amount: 2 },
      { name: "オピオタウロスレザー", amount: 1 }
    ]
  },
  {
    id: "sample-5",
    name: "オピオタウロスレザー",
    yields: 1,
    zone: "エルピス",
    location: "アナグノリシス追悼録",
    coords: { x: 24.0, y: 23.5 },
    ingredients: []
  }
];

class AppState {
  constructor() {
    this.recipes = this.loadRecipes();
  }

  loadRecipes() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.saveRecipes(INITIAL_RECIPES);
      return INITIAL_RECIPES;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("Storage load error:", e);
      return [];
    }
  }

  saveRecipes(recipes) {
    this.recipes = recipes;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.recipes));
  }

  addRecipe(recipe) {
    const index = this.recipes.findIndex(r => r.name === recipe.name);
    if (index >= 0) {
      this.recipes[index] = recipe;
    } else {
      this.recipes.push(recipe);
    }
    this.saveRecipes(this.recipes);
  }

  deleteRecipe(id) {
    this.recipes = this.recipes.filter(r => r.id !== id);
    this.saveRecipes(this.recipes);
  }

  findRecipeByName(name) {
    return this.recipes.find(r => r.name === name);
  }
}

const state = new AppState();

// 現在の計算対象となる末端素材（テレポ最適化用）
let currentBaseMaterialsMap = new Map();

// DOM要素参照
const elements = {
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),
  calcForm: document.getElementById("calc-form"),
  calcItemSelect: document.getElementById("calc-item-select"),
  calcTargetAmount: document.getElementById("calc-target-amount"),
  calcResults: document.getElementById("calc-results"),
  resultItemsList: document.getElementById("result-items-list"),
  // テレポ最適化UI
  routeStartCity: document.getElementById("route-start-city"),
  routeFreeDest: document.getElementById("route-free-dest"),
  routeFavDest: document.getElementById("route-fav-dest"),
  calcRouteBtn: document.getElementById("calc-route-btn"),
  routeResultsContainer: document.getElementById("route-results-container"),
  routeTotalGil: document.getElementById("route-total-gil"),
  routeDiscountInfo: document.getElementById("route-discount-info"),
  routeTimeline: document.getElementById("route-timeline"),
  // レシピ登録UI
  recipeForm: document.getElementById("recipe-form"),
  itemName: document.getElementById("item-name"),
  itemYield: document.getElementById("item-yield"),
  itemZone: document.getElementById("item-zone"),
  itemLocation: document.getElementById("item-location"),
  coordX: document.getElementById("coord-x"),
  coordY: document.getElementById("coord-y"),
  ingredientsContainer: document.getElementById("ingredients-container"),
  addIngredientBtn: document.getElementById("add-ingredient-btn"),
  registeredRecipesList: document.getElementById("registered-recipes-list"),
  recipeCount: document.getElementById("recipe-count"),
  // 管理UI
  backupJson: document.getElementById("backup-json"),
  exportBtn: document.getElementById("export-btn"),
  importBtn: document.getElementById("import-btn"),
  loadSampleBtn: document.getElementById("load-sample-btn"),
  clearDataBtn: document.getElementById("clear-data-btn")
};

function init() {
  setupTabs();
  setupEventListeners();
  renderRecipeList();
  renderCalcSelectOptions();
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
      if (targetId === "backup-view") elements.backupJson.value = JSON.stringify(state.recipes, null, 2);
    });
  });
}

function addIngredientRow(name = "", amount = 1) {
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <input type="text" class="ing-name" placeholder="素材名" value="${escapeHtml(name)}" required>
    <input type="number" class="ing-amount" placeholder="数量" min="1" value="${amount}" required style="width: 80px;">
    <button type="button" class="btn-remove-ing" title="削除">&times;</button>
  `;
  row.querySelector(".btn-remove-ing").addEventListener("click", () => row.remove());
  elements.ingredientsContainer.appendChild(row);
}

function formatLocationText(item) {
  if (!item) return "";
  const parts = [];

  if (item.zone && item.location) {
    parts.push(`${item.zone} / ${item.location}`);
  } else if (item.zone) {
    parts.push(item.zone);
  } else if (item.location) {
    parts.push(item.location);
  }

  if (item.coords && typeof item.coords.x === "number" && typeof item.coords.y === "number") {
    parts.push(`(X: ${item.coords.x.toFixed(1)}, Y: ${item.coords.y.toFixed(1)})`);
  }

  return parts.length > 0 ? `📍 ${parts.join(" ")}` : "";
}

function setupEventListeners() {
  elements.addIngredientBtn.addEventListener("click", () => addIngredientRow());

  // レシピ登録
  elements.recipeForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = elements.itemName.value.trim();
    const yields = parseInt(elements.itemYield.value, 10) || 1;
    const zone = elements.itemZone.value.trim();
    const location = elements.itemLocation.value.trim();

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

    state.addRecipe({
      id: "item-" + Date.now(),
      name,
      yields,
      zone,
      location,
      coords,
      ingredients
    });

    renderRecipeList();
    renderCalcSelectOptions();
    elements.recipeForm.reset();
    elements.ingredientsContainer.innerHTML = "";
    alert(`「${name}」を登録しました。`);
  });

  // 計算実行
  elements.calcForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const itemName = elements.calcItemSelect.value;
    const amount = parseInt(elements.calcTargetAmount.value, 10) || 1;
    if (!itemName) return;
    calculateBaseMaterials(itemName, amount);
  });

  // テレポ巡回ルート最適化ボタン
  elements.calcRouteBtn.addEventListener("click", () => {
    optimizeTeleportRoute();
  });

  // 管理機能
  elements.exportBtn.addEventListener("click", () => {
    elements.backupJson.value = JSON.stringify(state.recipes, null, 2);
    alert("JSONを出力しました。");
  });

  elements.importBtn.addEventListener("click", () => {
    try {
      const data = JSON.parse(elements.backupJson.value);
      if (!Array.isArray(data)) throw new Error("配列形式である必要があります。");
      state.saveRecipes(data);
      renderRecipeList();
      renderCalcSelectOptions();
      alert("データを復元しました。");
    } catch (err) {
      alert("JSON読み込み失敗: " + err.message);
    }
  });

  elements.loadSampleBtn.addEventListener("click", () => {
    if (confirm("サンプルデータを初期状態に復帰しますか？")) {
      state.saveRecipes(INITIAL_RECIPES);
      renderRecipeList();
      renderCalcSelectOptions();
    }
  });

  elements.clearDataBtn.addEventListener("click", () => {
    if (confirm("全登録データを消去しますか？")) {
      state.saveRecipes([]);
      renderRecipeList();
      renderCalcSelectOptions();
    }
  });
}

/**
 * 再帰的な末端素材分解
 */
function calculateBaseMaterials(rootName, rootAmount) {
  currentBaseMaterialsMap.clear();

  function resolve(name, needed, depth) {
    if (depth > 20) throw new Error("循環参照を検知しました。");

    const recipe = state.findRecipeByName(name);
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
 * 計算結果の描画
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
    const itemData = state.findRecipeByName(name);
    const locText = formatLocationText(itemData);

    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-header">
        <span class="item-title">${escapeHtml(name)}</span>
        <span class="badge-amount">必要数: ${amount} 個</span>
      </div>
      <div class="teleport-badge ${locText ? "" : "empty"}">
        ${locText ? escapeHtml(locText) : "採集場所 未登録 (店売り・中間素材)"}
      </div>
    `;
    elements.resultItemsList.appendChild(card);
  });

  elements.calcResults.classList.remove("hidden");
  elements.calcResults.scrollIntoView({ behavior: "smooth" });
}

/**
 * テレポ割引候補（無料/お気に入り）のセレクトボックス更新
 */
function updateTeleportSelectOptions() {
  const etherytes = new Set();
  currentBaseMaterialsMap.forEach((_, name) => {
    const item = state.findRecipeByName(name);
    if (item && item.location) {
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
   テレポ代最適化ロジック (TSP ブルートフォース全探索)
   ======================================================== */

/**
 * 2つの目的地間のテレポ代を推定する
 * FF14パッチ6.0以降の距離モデル（基本100G + リージョン差分）
 */
function estimateTeleportCost(pointA, pointB, freeDest, favDest) {
  if (!pointA || !pointB) return 0;
  // 同一エーテライト・同一場所
  if (pointA.location && pointB.location && pointA.location === pointB.location) {
    return 0;
  }

  // 無料デスティネーション
  if (pointB.location && pointB.location === freeDest) {
    return 0;
  }

  let baseCost = 100;
  const regA = pointA.region || "unknown";
  const regB = pointB.region || "unknown";

  if (regA === regB) {
    // 同一リージョン内移動
    baseCost = 210;
  } else if (
    (regA === "norvrandt" && regB !== "norvrandt") ||
    (regB === "norvrandt" && regA !== "norvrandt") ||
    (regA === "moon" || regB === "moon") ||
    (regA === "elpis" || regB === "elpis")
  ) {
    // 別世界・異空間移動（原初世界⇔第一世界、月・古代世界等）
    baseCost = 980;
  } else {
    // 原初世界の大陸間移動（エオルゼア ⇔ 東方 ⇔ トラル等）
    baseCost = 620;
  }

  // お気に入り50%割引
  if (pointB.location && pointB.location === favDest) {
    return Math.floor(baseCost * 0.5);
  }

  return baseCost;
}

/**
 * 最安巡回ルートの探索と描画
 */
function optimizeTeleportRoute() {
  const startCityKey = elements.routeStartCity.value;
  const startCity = CITIES[startCityKey];
  const freeDest = elements.routeFreeDest.value;
  const favDest = elements.routeFavDest.value;

  // 採集目的地（エーテライトごと）に素材を集約
  const nodeMap = new Map(); // key: location -> { location, zone, region, coords, items: [] }

  currentBaseMaterialsMap.forEach((amount, name) => {
    const item = state.findRecipeByName(name);
    if (item && item.location) {
      const locKey = item.location;
      if (!nodeMap.has(locKey)) {
        const zone = item.zone || "";
        const region = ZONE_REGION_MAP[zone] || "unknown";
        nodeMap.set(locKey, {
          location: item.location,
          zone: item.zone || "",
          region: region,
          coords: item.coords,
          items: []
        });
      }
      nodeMap.get(locKey).items.push({ name, amount });
    }
  });

  const destinations = Array.from(nodeMap.values());
  if (destinations.length === 0) {
    alert("採集場所（エーテライト）が登録された素材がありません。");
    return;
  }

  const startNode = {
    location: startCity.name,
    zone: startCity.name,
    region: startCity.region,
    coords: null,
    items: []
  };

  // 順列全探索（ブルートフォース）で最小コスト順序を算出
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

/**
 * 最適化されたルート情報の描画
 */
function renderOptimizedRoute(startNode, route, totalCost, freeDest, favDest) {
  elements.routeTimeline.innerHTML = "";
  elements.routeTotalGil.textContent = totalCost.toLocaleString();

  let discountNotice = "";
  if (freeDest || favDest) {
    discountNotice = "※ フリーデスティネーション/お気に入り割引適用済み";
  }
  elements.routeDiscountInfo.textContent = discountNotice;

  let prevNode = startNode;

  route.forEach((dest, index) => {
    const cost = estimateTeleportCost(prevNode, dest, freeDest, favDest);

    const itemsSummary = dest.items
      .map(i => `${i.name} × ${i.amount}`)
      .join("、 ");

    const coordStr = dest.coords ? `(X: ${dest.coords.x.toFixed(1)}, Y: ${dest.coords.y.toFixed(1)})` : "";

    const stepCard = document.createElement("div");
    stepCard.className = "timeline-step";
    stepCard.innerHTML = `
      <div class="step-number">${index + 1}</div>
      <div class="step-content">
        <div class="step-dest">${escapeHtml(dest.zone)} / ${escapeHtml(dest.location)} ${coordStr}</div>
        <div class="step-details">移動元: ${escapeHtml(prevNode.location)} からテレポ</div>
        <div class="step-materials">採集: ${escapeHtml(itemsSummary)}</div>
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
  elements.recipeCount.textContent = state.recipes.length;

  if (state.recipes.length === 0) {
    elements.registeredRecipesList.innerHTML = `<p class="desc">登録されたレシピはありません。</p>`;
    return;
  }

  state.recipes.forEach(r => {
    const item = document.createElement("div");
    item.className = "recipe-item";

    const ingText = r.ingredients && r.ingredients.length > 0
      ? r.ingredients.map(i => `${i.name}×${i.amount}`).join(", ")
      : "末端素材 (直接採集/購入)";

    const locText = formatLocationText(r);

    item.innerHTML = `
      <div class="recipe-header">
        <span class="item-title">${escapeHtml(r.name)}</span>
        <button class="btn btn-danger btn-sm delete-btn">削除</button>
      </div>
      <div class="recipe-details">獲得数: ${r.yields}個 | 素材: [ ${escapeHtml(ingText)} ]</div>
      ${locText ? `<div class="teleport-badge" style="margin-top:0.35rem; font-size:0.85rem;">${escapeHtml(locText)}</div>` : ""}
    `;

    item.querySelector(".delete-btn").addEventListener("click", () => {
      if (confirm(`「${r.name}」を削除しますか？`)) {
        state.deleteRecipe(r.id);
        renderRecipeList();
        renderCalcSelectOptions();
      }
    });

    elements.registeredRecipesList.appendChild(item);
  });
}

function renderCalcSelectOptions() {
  const current = elements.calcItemSelect.value;
  elements.calcItemSelect.innerHTML = `<option value="">-- レシピを選択してください --</option>`;
  state.recipes.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.name;
    const isCraftable = r.ingredients && r.ingredients.length > 0;
    opt.textContent = `${r.name} ${isCraftable ? "[製作]" : "[採集/末端]"}`;
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