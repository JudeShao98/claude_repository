(function () {
  "use strict";

  // --- State ---------------------------------------------------------------
  // current:   the number currently being typed (as a string)
  // previous:  the stored operand from before an operator was pressed
  // operator:  the pending operator ("+", "-", "*", "/") or null
  // justEvaluated: true right after "=" so the next digit starts fresh
  const state = {
    current: "0",
    previous: null,
    operator: null,
    justEvaluated: false,
  };

  const currentEl = document.getElementById("current");
  const historyEl = document.getElementById("history");
  const keysEl = document.querySelector(".keys");

  const OP_SYMBOLS = { "+": "+", "-": "−", "*": "×", "/": "÷" };

  // --- Rendering -----------------------------------------------------------
  function render() {
    currentEl.textContent = formatForDisplay(state.current);

    if (state.operator && state.previous !== null) {
      historyEl.textContent =
        formatForDisplay(state.previous) + " " + OP_SYMBOLS[state.operator];
    } else {
      historyEl.textContent = "";
    }

    // Highlight the active operator key
    keysEl.querySelectorAll(".key--op").forEach(function (btn) {
      btn.classList.toggle(
        "active",
        state.operator !== null &&
          state.previous !== null &&
          btn.dataset.op === state.operator
      );
    });
  }

  // Add thousands separators to the integer part for readability.
  function formatForDisplay(value) {
    if (value === "Error") return value;
    const negative = value.startsWith("-");
    const unsigned = negative ? value.slice(1) : value;
    const parts = unsigned.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (negative ? "-" : "") + parts.join(".");
  }

  // --- Input handlers ------------------------------------------------------
  function inputNumber(digit) {
    if (state.current === "Error") resetAll();

    if (state.justEvaluated) {
      state.current = "0";
      state.justEvaluated = false;
    }

    if (digit === ".") {
      if (state.current.includes(".")) return;
      state.current += ".";
    } else if (state.current === "0") {
      state.current = digit;
    } else {
      state.current += digit;
    }
    render();
  }

  function chooseOperator(op) {
    if (state.current === "Error") return;

    // Chaining: if there is already a pending operation, evaluate it first.
    if (state.operator !== null && state.previous !== null && !state.justEvaluated) {
      compute();
    }

    state.previous = state.current;
    state.operator = op;
    state.justEvaluated = false;
    // Next digit should start a fresh operand.
    state.current = state.previous;
    state.justEvaluated = true;
    render();
  }

  function compute() {
    if (state.operator === null || state.previous === null) return;

    const a = parseFloat(state.previous);
    const b = parseFloat(state.current);
    let result;

    switch (state.operator) {
      case "+": result = a + b; break;
      case "-": result = a - b; break;
      case "*": result = a * b; break;
      case "/":
        if (b === 0) {
          state.current = "Error";
          state.previous = null;
          state.operator = null;
          return;
        }
        result = a / b;
        break;
      default: return;
    }

    state.current = roundResult(result);
    state.previous = null;
    state.operator = null;
  }

  function equals() {
    if (state.operator === null) return;
    compute();
    state.justEvaluated = true;
    render();
  }

  function percent() {
    if (state.current === "Error") return;
    const value = parseFloat(state.current) / 100;
    state.current = roundResult(value);
    render();
  }

  function deleteLast() {
    if (state.current === "Error" || state.justEvaluated) {
      resetCurrent();
    } else if (state.current.length <= 1 || (state.current.length === 2 && state.current.startsWith("-"))) {
      state.current = "0";
    } else {
      state.current = state.current.slice(0, -1);
    }
    render();
  }

  // Avoid floating point noise like 0.1 + 0.2 = 0.30000000000000004
  function roundResult(value) {
    if (!isFinite(value)) return "Error";
    return String(parseFloat(value.toPrecision(12)));
  }

  function resetCurrent() {
    state.current = "0";
    state.justEvaluated = false;
  }

  function resetAll() {
    state.current = "0";
    state.previous = null;
    state.operator = null;
    state.justEvaluated = false;
  }

  function clearAll() {
    resetAll();
    render();
  }

  // --- Event wiring --------------------------------------------------------
  keysEl.addEventListener("click", function (event) {
    const btn = event.target.closest("button");
    if (!btn) return;

    if (btn.dataset.num !== undefined) {
      inputNumber(btn.dataset.num);
    } else if (btn.dataset.op !== undefined) {
      chooseOperator(btn.dataset.op);
    } else {
      switch (btn.dataset.action) {
        case "clear": clearAll(); break;
        case "delete": deleteLast(); break;
        case "percent": percent(); break;
        case "equals": equals(); break;
      }
    }
  });

  // Keyboard support
  document.addEventListener("keydown", function (event) {
    const key = event.key;
    if (key >= "0" && key <= "9") {
      inputNumber(key);
    } else if (key === ".") {
      inputNumber(".");
    } else if (key === "+" || key === "-" || key === "*" || key === "/") {
      chooseOperator(key);
    } else if (key === "Enter" || key === "=") {
      event.preventDefault();
      equals();
    } else if (key === "Backspace") {
      deleteLast();
    } else if (key === "Escape") {
      clearAll();
    } else if (key === "%") {
      percent();
    }
  });

  render();
})();
