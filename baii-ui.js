/* BA II Plus UI wiring. Depends on window.BAII from baii-core.js. */
(function () {
  "use strict";

  const TVM = window.BAII.TVM;
  const CF = window.BAII.CashFlow;

  // Format a number for display: up to 6 decimals, trailing zeros trimmed.
  function fmt(x) {
    if (x === null || !isFinite(x)) return "Error";
    const rounded = parseFloat(x.toFixed(6));
    return String(rounded);
  }

  // Parse a field's value; blank or invalid -> 0.
  function num(el) {
    const v = parseFloat((el.value || "").replace(/,/g, "").trim());
    return isNaN(v) ? 0 : v;
  }

  // ---- Tabs ---------------------------------------------------------------
  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("tab--active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("panel--active"));
      tab.classList.add("tab--active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("panel--active");
    });
  });

  // ---- TVM ----------------------------------------------------------------
  const tvmField = {};
  ["N", "IY", "PV", "PMT", "FV", "PY", "CY"].forEach(function (k) {
    tvmField[k] = document.querySelector('[data-field="' + k + '"]');
  });
  const bgnToggle = document.getElementById("bgnToggle");

  bgnToggle.addEventListener("click", function () {
    const begin = bgnToggle.dataset.begin === "true";
    bgnToggle.dataset.begin = String(!begin);
    bgnToggle.textContent = !begin ? "BGN 期初" : "END 期末";
  });

  function readTvm() {
    return {
      N: num(tvmField.N),
      IY: num(tvmField.IY),
      PV: num(tvmField.PV),
      PMT: num(tvmField.PMT),
      FV: num(tvmField.FV),
      PY: num(tvmField.PY) || 1,
      CY: num(tvmField.CY) || 1,
      begin: bgnToggle.dataset.begin === "true",
    };
  }

  const tvmCompute = {
    N: TVM.computeN.bind(TVM),
    IY: TVM.computeIY.bind(TVM),
    PV: TVM.computePV.bind(TVM),
    PMT: TVM.computePMT.bind(TVM),
    FV: TVM.computeFV.bind(TVM),
  };

  document.querySelectorAll(".cpt[data-cpt]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const key = btn.dataset.cpt;
      const result = tvmCompute[key](readTvm());
      const target = tvmField[key];
      target.value = fmt(result);
      target.classList.add("computed");
    });
  });

  // Editing any field clears the "computed" highlight on it.
  Object.values(tvmField).forEach(function (el) {
    el.addEventListener("input", function () {
      el.classList.remove("computed");
    });
  });

  document.getElementById("clearTvm").addEventListener("click", function () {
    ["N", "IY", "PV", "PMT", "FV"].forEach(function (k) {
      tvmField[k].value = "";
      tvmField[k].classList.remove("computed");
    });
    tvmField.PY.value = "1";
    tvmField.CY.value = "1";
    bgnToggle.dataset.begin = "false";
    bgnToggle.textContent = "END 期末";
  });

  // ---- Cash Flow ----------------------------------------------------------
  const cfList = document.getElementById("cfList");
  let cfCount = 0;

  function addCfRow(amount, freq) {
    cfCount += 1;
    const idx = cfCount;
    const row = document.createElement("div");
    row.className = "cf-row";
    row.innerHTML =
      '<span class="cf-name">C' + (idx < 10 ? "0" + idx : idx) + "</span>" +
      '<input class="cf-amount" type="text" inputmode="decimal" placeholder="金额" />' +
      '<input class="cf-freq" type="text" inputmode="numeric" placeholder="次数" />' +
      '<button class="cf-del" title="删除">×</button>';
    if (amount !== undefined) row.querySelector(".cf-amount").value = amount;
    row.querySelector(".cf-freq").value = freq || "1";
    row.querySelector(".cf-del").addEventListener("click", function () {
      row.remove();
      renumberCf();
    });
    cfList.appendChild(row);
  }

  function renumberCf() {
    const names = cfList.querySelectorAll(".cf-name");
    names.forEach(function (el, i) {
      const n = i + 1;
      el.textContent = "C" + (n < 10 ? "0" + n : n);
    });
    cfCount = names.length;
  }

  function readCashFlows() {
    const cf0 = num(document.querySelector("[data-cf0]"));
    const flows = [{ amount: cf0 }];
    cfList.querySelectorAll(".cf-row").forEach(function (row) {
      flows.push({
        amount: num(row.querySelector(".cf-amount")),
        freq: parseInt(row.querySelector(".cf-freq").value, 10) || 1,
      });
    });
    return flows;
  }

  document.getElementById("addCf").addEventListener("click", function () {
    addCfRow();
  });

  document.getElementById("computeNpv").addEventListener("click", function () {
    const rate = num(document.getElementById("cfRate"));
    const npv = CF.npv(readCashFlows(), rate);
    document.getElementById("cfResult").textContent = "NPV = " + fmt(npv);
  });

  document.getElementById("computeIrr").addEventListener("click", function () {
    const irr = CF.irr(readCashFlows());
    document.getElementById("cfResult").textContent =
      irr === null ? "IRR 无解" : "IRR = " + fmt(irr) + " %";
  });

  // Seed with two example rows so the worksheet isn't empty.
  addCfRow();
  addCfRow();

  // ---- Standard calculator ------------------------------------------------
  const calc = { current: "0", previous: null, op: null, evaluated: false };
  const curEl = document.getElementById("calcCurrent");
  const histEl = document.getElementById("calcHistory");
  const opSym = { "+": "+", "-": "−", "*": "×", "/": "÷" };

  function renderCalc() {
    curEl.textContent = calc.current;
    histEl.textContent =
      calc.op && calc.previous !== null ? calc.previous + " " + opSym[calc.op] : "";
    document.querySelectorAll("#panel-calc .key--op").forEach(function (b) {
      b.classList.toggle("active", calc.op === b.dataset.op && calc.previous !== null);
    });
  }

  function inputNum(d) {
    if (calc.current === "Error") calcReset();
    if (calc.evaluated) { calc.current = "0"; calc.evaluated = false; }
    if (d === ".") {
      if (!calc.current.includes(".")) calc.current += ".";
    } else if (calc.current === "0") {
      calc.current = d;
    } else {
      calc.current += d;
    }
    renderCalc();
  }

  function chooseOp(op) {
    if (calc.op !== null && calc.previous !== null && !calc.evaluated) computeCalc();
    calc.previous = calc.current;
    calc.op = op;
    calc.evaluated = true;
    renderCalc();
  }

  function computeCalc() {
    if (calc.op === null || calc.previous === null) return;
    const a = parseFloat(calc.previous);
    const b = parseFloat(calc.current);
    let r;
    switch (calc.op) {
      case "+": r = a + b; break;
      case "-": r = a - b; break;
      case "*": r = a * b; break;
      case "/": r = b === 0 ? null : a / b; break;
    }
    calc.current = r === null || !isFinite(r) ? "Error" : String(parseFloat(r.toPrecision(12)));
    calc.previous = null;
    calc.op = null;
  }

  function calcReset() {
    calc.current = "0"; calc.previous = null; calc.op = null; calc.evaluated = false;
  }

  document.querySelector("#panel-calc .keys").addEventListener("click", function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.num !== undefined) {
      inputNum(btn.dataset.num);
    } else if (btn.dataset.op !== undefined) {
      chooseOp(btn.dataset.op);
    } else {
      switch (btn.dataset.action) {
        case "clear": calcReset(); break;
        case "delete":
          if (calc.current === "Error" || calc.evaluated) { calc.current = "0"; calc.evaluated = false; }
          else calc.current = calc.current.length > 1 ? calc.current.slice(0, -1) : "0";
          break;
        case "percent":
          calc.current = String(parseFloat(calc.current) / 100); break;
        case "sign":
          if (calc.current !== "0" && calc.current !== "Error")
            calc.current = calc.current.startsWith("-") ? calc.current.slice(1) : "-" + calc.current;
          break;
        case "equals":
          computeCalc(); calc.evaluated = true; break;
      }
    }
    renderCalc();
  });

  renderCalc();
})();
