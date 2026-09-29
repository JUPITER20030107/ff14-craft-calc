/**
 * @fileoverview FF14 素材分解＆ギャザラー採集ルート最適化アプリケーション
 * Google Apps Script (GAS) を介したGoogleスプレッドシート連携と、
 * 巡回セールスマン問題 (TSP) に基づく最安テレポルート探索を行います。
 * @author Your Name & Assistant
 * @version 1.0.0
 */

// =============================================================================
// 型定義 (TypeScript/Java風のJSDoc型付け)
// =============================================================================

/**
 * 座標オブジェクト
 * @typedef {Object} Coords
 * @property {number} x - ゲーム内X座標 (1.0 - 42.0)
 * @property {number} y - ゲーム内Y座標 (1.0 - 42.0)
 */

/**
 * 必要素材アイテム
 * @typedef {Object} Ingredient
 * @property {string} name - 素材名
 * @property {number} amount - 必要個数
 */

/**
 * レシピ・素材データ構造
 * @typedef {Object} RecipeItem
 * @property {string} id - 一意の識別ID
 * @property {string} name - 完成品または素材の名称
 * @property {number} yields - 1回の製作・採集での獲得個数
 * @property {"gather"|"battle"|"shop"} type - 入手区分
 * @property {string} [zone] - 採集エリア名
 * @property {string} [location] - 最寄りエーテライト名
 * @property {Coords|null} [coords] - 座標データ
 * @property {string} [note] - 入手メモ（戦闘・店売りのみ）
 * @property {Ingredient[]} ingredients - 必要素材リスト
 */

/**
 * 都市・拠点情報
 * @typedef {Object} CityInfo
 * @property {string} name - 都市の名称
 * @property {string} region - 所属リージョン識別子
 */

/**
 * 採集目的地ノード (TSP計算用)
 * @typedef {Object} RouteNode
 * @property {string} location - エーテライト名
 * @property {string} zone - エリア名
 * @property {string} region - リージョン識別子
 * @property {Coords|null} coords - 座標情報
 * @property {Ingredient[]} items - 当該地点で採集する素材一覧
 */

// =============================================================================
// 定数・設定
// =============================================================================

/**
 * バックエンドとして連携する Google Apps Script の公開WebアプリURL
 * @type {string}
 */
const GAS_API_URL = "ここにGASのWEB_APP_URLを貼り付け";

/**
 * 出発地点として選択可能な主要都市一覧
 * @type {Readonly<Record<string, CityInfo>>}
 */
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

/**
 * エリア名からリージョン区分へのマッピング辞書
 * @type {Readonly<Record<string, string>>}
 */
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
// アプリケーション状態管理 (State)
// =============================================================================

/**
 * スプレッドシートから読み込んだ最新レシピ一覧キャッシュ
 * @type {RecipeItem[]}
 */
let currentRecipes = [];

/**
 * 直近の計算結果である末端素材の集計マップ (素材名 -> 合計必要数)
 * @type {Map<string, number>}
 */
let currentBaseMaterialsMap = new Map();

/**
 * DOM要素のキャッシュマップ
 * @type {Readonly<Record<string, HTMLElement|HTMLInputElement|HTMLSelectElement|HTMLButtonElement>>}
 */
const elements = {
  syncStatus: /** @type {HTMLElement} */ (document.getElementById("sync-status")),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),
  calcForm: /** @type {HTMLFormElement} */ (document.getElementById("calc-form")),
  calcItemSelect: /** @type {HTMLSelectElement} */ (document.getElementById("calc-item-select")),
  calcTargetAmount: /** @type {HTMLInputElement} */ (document.getElementById("calc-target-amount")),
  calcResults: /** @type {HTMLElement} */ (document.getElementById("calc-results")),
  resultItemsList: /** @type {HTMLElement} */ (document.getElementById("result-items-list")),
  routeStartCity: /** @type {HTMLSelectElement} */ (document.getElementById("route-start-city")),
  routeFreeDest: /** @type {HTMLSelectElement} */ (document.getElementById("route-free-dest")),
  routeFavDest: /** @type {HTMLSelectElement} */ (document.getElementById("route-fav-dest")),
  calcRouteBtn: /** @type {HTMLButtonElement} */ (document.getElementById("calc-route-btn")),
  routeResultsContainer: /** @type {HTMLElement} */ (document.getElementById("route-results-container")),
  routeTotalGil: /** @type {HTMLElement} */ (document.getElementById("route-total-gil")),
  routeDiscountInfo: /** @type {HTMLElement} */ (document.getElementById("route-discount-info")),
  routeTimeline: /** @type {HTMLElement} */ (document.getElementById("route-timeline")),
  recipeForm: /** @type {HTMLFormElement} */ (document.getElementById("recipe-form")),
  itemName: /** @type {HTMLInputElement} */ (document.getElementById("item-name")),
  itemYield: /** @type {HTMLInputElement} */ (document.getElementById("item-yield")),
  itemType: /** @type {HTMLSelectElement} */ (document.getElementById("item-type")),
  gatherFields: /** @type {HTMLElement} */ (document.getElementById("gather-fields")),
  itemZone: /** @type {HTMLInputElement} */ (document.getElementById("item-zone")),
  itemLocation: /** @type {HTMLInputElement} */ (document.getElementById("item-location")),
  coordX: /** @type {HTMLInputElement} */ (document.getElementById("coord-x")),
  coordY: /** @type {HTMLInputElement} */ (document.getElementById("coord-y")),
  noteFields: /** @type {HTMLElement} */ (document.getElementById("note-fields")),
  itemNote: /** @type {HTMLInputElement} */ (document.getElementById("item-note")),
  ingredientsContainer: /** @type {HTMLElement} */ (document.getElementById("ingredients-container")),
  addIngredientBtn: /** @type {HTMLButtonElement} */ (document.getElementById("add-ingredient-btn")),
  registeredRecipesList: /** @type {HTMLElement} */ (document.getElementById("registered-recipes-list")),
  recipeCount: /** @type {HTMLElement} */ (document.getElementById("recipe-count")),
  saveRecipeBtn: /** @type {HTMLButtonElement} */ (document.getElementById("save-recipe-btn")),
  refreshSheetBtn: /** @type {HTMLButtonElement} */ (document.getElementById("refresh-sheet-btn"))
};

// =============================================================================
// 初期化およびライフサイクル
// =============================================================================

/**
 * アプリケーションの初期化処理を実行します。
 * イベントリスナーの登録とGASからのデータ取得を開始します。
 * @returns {void}
 */
function init() {
  setupTabs();
  setupEventListeners();
  loadDataFromGAS();
}

/**
 * 画面上部の通信ステータスインジケーターの表示を更新します。
 * @param {string} text - 表示メッセージ
 * @param {"ready"|"loading"|"error"} stateClass - CSSクラス識別子
 * @returns {void}
 */
function updateSyncStatus(text, stateClass) {
  elements.syncStatus.textContent = text;
  elements.syncStatus.className = `sync-status ${stateClass}`;
}

// =============================================================================
// GAS (Google Apps Script) 通信モジュール
// =============================================================================

/**
 * GAS Web API から最新のレシピ一覧を非同期取得し、内部状態を同期します。
 * @async
 * @returns {Promise<void>}
 */
async function loadDataFromGAS() {
  if (!GAS_API_URL || GAS_API_URL.includes("ここにGAS")) {
    updateSyncStatus("⚠️ GAS_API_URL未設定", "error");
    return;
  }

  updateSyncStatus("● スプレッドシートから読み込み中...", "loading");

  try {
    const response = await fetch(GAS_API_URL);
    if (!response.ok) {
      throw new Error(`HTTP通信エラー: ${response.status}`);
    }

    const result = await response.json();
    if (result.status === "success") {
      currentRecipes = result.data;
      renderRecipeList();
      renderCalcSelectOptions();
      updateSyncStatus("● 接続完了 (最新データ同期済み)", "ready");
    } else {
      throw new Error(result.message || "不明なAPIエラー");
    }
  } catch (err) {
    console.error("GAS読み込みエラー:", err);
    updateSyncStatus("❌ 接続エラー", "error");
  }
}

/**
 * GAS Web API に対してデータの保存・削除リクエストを非同期送信します。
 * @async
 * @param {Object} payload - 送信ペイロード
 * @param {"save"|"delete"} payload.action - 実行アクション名
 * @param {RecipeItem} [payload.item] - 保存対象アイテムデータ (action="save"時)
 * @param {string} [payload.id] - 削除対象ID (action="delete"時)
 * @returns {Promise<boolean>} 処理が成功した場合は true、失敗時は false
 */
async function postDataToGAS(payload) {
  updateSyncStatus("● スプレッドシートを更新中...", "loading");
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP通信エラー: ${response.status}`);
    }

    const result = await response.json();
    if (result.status === "success") {
      updateSyncStatus("● 更新完了", "ready");
      await loadDataFromGAS();
      return true;
    } else {
      throw new Error(result.message || "API更新拒否");
    }
  } catch (err) {
    console.error("GAS更新エラー:", err);
    updateSyncStatus("❌ 更新失敗", "error");
    alert("更新に失敗しました: " + err.message);
    return false;
  }
}

// =============================================================================
// UIイベント・タブ制御
// =============================================================================

/**
 * ナビゲーションタブの切り替えイベントを設定します。
 * @returns {void}
 */
function setupTabs() {
  elements.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      elements.tabButtons.forEach(b => b.classList.remove("active"));
      elements.tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      if (targetId) {
        document.getElementById(targetId)?.classList.add("active");
      }

      if (targetId === "calc-view") {
        renderCalcSelectOptions();
      }
    });
  });
}

/**
 * 必要素材の動的入力行をフォームに追加します。
 * @param {string} [name=""] - 素材名の初期値
 * @param {number} [amount=1] - 必要個数の初期値
 * @returns {void}
 */
function addIngredientRow(name = "", amount = 1) {
  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <input type="text" class="ing-name" placeholder="素材名" value="${escapeHtml(name)}" required>
    <input type="number" class="ing-amount" placeholder="数量" min="1" value="${amount}" required style="width: 80px;">
    <button type="button" class="btn-remove-ing" title="削除">&times;</button>
  `;

  row.querySelector(".btn-remove-ing")?.addEventListener("click", () => row.remove());
  elements.ingredientsContainer.appendChild(row);
}

/**
 * 各種入力フォームおよびボタンのイベントリスナーを設定します。
 * @returns {void}
 */
function setupEventListeners() {
  // 入手タイプに応じた入力欄の動的表示切り替え
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

  // 素材行の追加
  elements.addIngredientBtn.addEventListener("click", () => addIngredientRow());

  // レシピ登録フォーム送信
  elements.recipeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = elements.itemName.value.trim();
    const yields = parseInt(elements.itemYield.value, 10) || 1;
    const type = /** @type {"gather"|"battle"|"shop"} */ (elements.itemType.value);
    const zone = elements.itemZone.value.trim();
    const location = elements.itemLocation.value.trim();
    const note = elements.itemNote.value.trim();

    const xVal = parseFloat(elements.coordX.value);
    const yVal = parseFloat(elements.coordY.value);
    const coords = (!isNaN(xVal) && !isNaN(yVal)) ? { x: xVal, y: yVal } : null;

    /** @type {Ingredient[]} */
    const ingredients = [];
    elements.ingredientsContainer.querySelectorAll(".ingredient-row").forEach(row => {
      const ingName = /** @type {HTMLInputElement} */ (row.querySelector(".ing-name")).value.trim();
      const ingAmount = parseInt(/** @type {HTMLInputElement} */ (row.querySelector(".ing-amount")).value, 10) || 1;
      if (ingName) {
        ingredients.push({ name: ingName, amount: ingAmount });
      }
    });

    /** @type {RecipeItem} */
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

  // 素材計算実行
  elements.calcForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const itemName = elements.calcItemSelect.value;
    const amount = parseInt(elements.calcTargetAmount.value, 10) || 1;
    if (!itemName) return;
    calculateBaseMaterials(itemName, amount);
  });

  // テレポ巡回ルート最適化
  elements.calcRouteBtn.addEventListener("click", optimizeTeleportRoute);

  // スプレッドシート最新化ボタン
  elements.refreshSheetBtn.addEventListener("click", loadDataFromGAS);
}

// =============================================================================
// コアロジック: 再帰的素材分解 (Recursion)
// =============================================================================

/**
 * 指定された完成品アイテムを末端素材（これ以上分解できない素材）まで再帰的に分解・集計します。
 * @param {string} rootName - 製作目標のアイテム名
 * @param {number} rootAmount - 製作希望個数
 * @throws {Error} 循環参照またはネストが20階層を超えた場合にスローされます。
 * @returns {void}
 */
function calculateBaseMaterials(rootName, rootAmount) {
  currentBaseMaterialsMap.clear();

  /**
   * 再帰探索を行う内部関数
   * @param {string} name - 対象素材名
   * @param {number} needed - 必要個数
   * @param {number} depth - 再帰深度カウンタ
   * @returns {void}
   */
  function resolve(name, needed, depth) {
    if (depth > 20) {
      throw new Error(`循環参照を検知しました: ${name}`);
    }

    const recipe = currentRecipes.find(r => r.name === name);

    // 基底条件: レシピがない、または必要素材が空の場合は「末端素材」として合算
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      currentBaseMaterialsMap.set(name, (currentBaseMaterialsMap.get(name) || 0) + needed);
      return;
    }

    // 中間素材: 獲得数による必要クラフト回数の切り上げ計算
    const mult = Math.ceil(needed / (recipe.yields || 1));

    // 各構成素材について再帰呼び出し
    for (const ing of recipe.ingredients) {
      resolve(ing.name, ing.amount * mult, depth + 1);
    }
  }

  try {
    resolve(rootName, rootAmount, 0);
    renderResults(currentBaseMaterialsMap);
    updateTeleportSelectOptions();
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
}

/**
 * 末端素材の集計結果カード一覧をHTMLに描画します。
 * @param {Map<string, number>} baseMap - 素材名と必要数のマップ
 * @returns {void}
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

/**
 * テレポ割引候補（無料/お気に入り）のセレクトボックスの選択肢を更新します。
 * @returns {void}
 */
function updateTeleportSelectOptions() {
  const etherytes = new Set();
  currentBaseMaterialsMap.forEach((_, name) => {
    const item = currentRecipes.find(r => r.name === name);
    if (item && item.type === "gather" && item.location) {
      etherytes.add(item.location);
    }
  });

  /**
   * 選択肢HTMLの生成
   * @param {string} defaultText
   * @returns {string}
   */
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
// コアロジック: テレポ代計算 & TSP巡回最適化
// =============================================================================

/**
 * 移動元と移動先のノード情報から、推定テレポ代（ギル）を計算します。
 * @param {RouteNode|null} pointA - 移動元ノード
 * @param {RouteNode|null} pointB - 移動先ノード
 * @param {string} freeDest - 無料設定エーテライト名
 * @param {string} favDest - お気に入り設定エーテライト名
 * @returns {number} 推定テレポ代 (ギル)
 */
function estimateTeleportCost(pointA, pointB, freeDest, favDest) {
  if (!pointA || !pointB) return 0;
  if (pointA.location && pointB.location && pointA.location === pointB.location) return 0;
  if (pointB.location && pointB.location === freeDest) return 0;

  let baseCost = 100;
  const regA = pointA.region || "unknown";
  const regB = pointB.region || "unknown";

  if (regA === regB) {
    baseCost = 210; // 同一リージョン内移動
  } else if (
    (regA === "norvrandt" && regB !== "norvrandt") ||
    (regB === "norvrandt" && regA !== "norvrandt") ||
    regA === "moon" || regB === "moon" ||
    regA === "elpis" || regB === "elpis"
  ) {
    baseCost = 980; // 異世界・星外空間移動
  } else {
    baseCost = 620; // 原初世界の大陸間移動
  }

  if (pointB.location && pointB.location === favDest) {
    return Math.floor(baseCost * 0.5); // お気に入り半額割引
  }

  return baseCost;
}

/**
 * 採集対象のエーテライトを巡回する最安ルートを探索し、結果を描画します。
 * (順列全探索による厳密解の算出)
 * @returns {void}
 */
function optimizeTeleportRoute() {
  const startCityKey = elements.routeStartCity.value;
  const startCity = CITIES[startCityKey];
  const freeDest = elements.routeFreeDest.value;
  const favDest = elements.routeFavDest.value;

  /** @type {Map<string, RouteNode>} */
  const nodeMap = new Map();

  currentBaseMaterialsMap.forEach((amount, name) => {
    const item = currentRecipes.find(r => r.name === name);
    // 戦闘・店売りは完全に除外
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
      nodeMap.get(locKey)?.items.push({ name, amount });
    }
  });

  const destinations = Array.from(nodeMap.values());
  if (destinations.length === 0) {
    alert("採集場所（エーテライト）が登録された素材がありません。\n（戦闘素材や店売り素材はテレポ巡回の対象外です）");
    return;
  }

  /** @type {RouteNode} */
  const startNode = {
    location: startCity.name,
    zone: startCity.name,
    region: startCity.region,
    coords: null,
    items: []
  };

  /** @type {RouteNode[]|null} */
  let bestRoute = null;
  let minCost = Infinity;

  /**
   * 順列全探索 (Permutation)
   * @param {RouteNode[]} arr - 残り訪問ノード
   * @param {RouteNode[]} [m=[]] - 現在のルート構築列
   * @returns {void}
   */
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

/**
 * 最適化された巡回ルートタイムラインを描画します。
 * @param {RouteNode} startNode - 出発地点
 * @param {RouteNode[]} route - 訪問順序リスト
 * @param {number} totalCost - 合計ギル
 * @param {string} freeDest - 無料設定
 * @param {string} favDest - お気に入り設定
 * @returns {void}
 */
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

// =============================================================================
// レシピ一覧表示・UI同期モジュール
// =============================================================================

/**
 * 登録済みレシピ一覧のDOMを再描画します。
 * @returns {void}
 */
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

    item.querySelector(".delete-btn")?.addEventListener("click", async () => {
      if (confirm(`「${r.name}」をスプレッドシートから削除しますか？`)) {
        await postDataToGAS({ action: "delete", id: r.id });
      }
    });

    elements.registeredRecipesList.appendChild(item);
  });
}

/**
 * 計算用セレクトボックスの選択肢一覧を更新します。
 * @returns {void}
 */
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

// =============================================================================
// セキュリティ・ユーティリティ
// =============================================================================

/**
 * XSS脆弱性を防止するために文字列をHTMLエスケープします。
 * @param {string} str - エスケープ対象文字列
 * @returns {string} サニタイズ済み文字列
 */
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

// DOM読み込み完了時にアプリケーションを起動
document.addEventListener("DOMContentLoaded", init);