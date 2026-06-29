/*
 * BA II Plus core financial math.
 *
 * Pure functions, no DOM. Loadable in the browser (attaches to window.BAII)
 * and in Node (module.exports) so the math can be unit-tested headless.
 *
 * Sign convention follows the TI BA II Plus: cash inflows are positive,
 * outflows are negative. PV + PMT-annuity + FV (discounted) = 0.
 */
(function (global) {
  "use strict";

  // ---- Root finder: scan for a sign change, then bisect -------------------
  // Robust (no derivative needed) and good enough for exam-range problems.
  function solve(f, lo, hi, coarse) {
    let prev = lo;
    let fprev = f(prev);
    if (fprev === 0) return prev;

    for (let x = lo + coarse; x <= hi; x += coarse) {
      const fx = f(x);
      if (fx === 0) return x;
      if ((fprev < 0 && fx > 0) || (fprev > 0 && fx < 0)) {
        // Bracket found between prev and x -> bisect.
        let a = prev, b = x, fa = fprev;
        for (let k = 0; k < 200; k++) {
          const m = (a + b) / 2;
          const fm = f(m);
          if (fm === 0 || (b - a) / 2 < 1e-12) return m;
          if ((fa < 0 && fm < 0) || (fa > 0 && fm > 0)) {
            a = m; fa = fm;
          } else {
            b = m;
          }
        }
        return (a + b) / 2;
      }
      prev = x;
      fprev = fx;
    }
    return null; // no sign change found in range
  }

  // ---- Time Value of Money ------------------------------------------------
  const TVM = {
    // Rate per payment period, given annual I/Y, payments/yr, compounding/yr.
    periodRate: function (IY, PY, CY) {
      if (IY === 0) return 0;
      return Math.pow(1 + IY / 100 / CY, CY / PY) - 1;
    },

    // Inverse: per-period rate -> annual I/Y (percent).
    annualRate: function (i, PY, CY) {
      return CY * (Math.pow(1 + i, PY / CY) - 1) * 100;
    },

    // Present-value annuity factor for N periods at per-period rate i.
    annuityFactor: function (i, N) {
      if (i === 0) return N;
      return (1 - Math.pow(1 + i, -N)) / i;
    },

    computeFV: function (v) {
      const i = this.periodRate(v.IY, v.PY, v.CY);
      const g = 1 + i * (v.begin ? 1 : 0);
      const a = this.annuityFactor(i, v.N);
      return -(v.PV + g * v.PMT * a) * Math.pow(1 + i, v.N);
    },

    computePV: function (v) {
      const i = this.periodRate(v.IY, v.PY, v.CY);
      const g = 1 + i * (v.begin ? 1 : 0);
      const a = this.annuityFactor(i, v.N);
      return -(g * v.PMT * a + v.FV * Math.pow(1 + i, -v.N));
    },

    computePMT: function (v) {
      const i = this.periodRate(v.IY, v.PY, v.CY);
      const g = 1 + i * (v.begin ? 1 : 0);
      const a = this.annuityFactor(i, v.N);
      return -(v.PV + v.FV * Math.pow(1 + i, -v.N)) / (g * a);
    },

    computeN: function (v) {
      const i = this.periodRate(v.IY, v.PY, v.CY);
      if (i === 0) return -(v.PV + v.FV) / v.PMT;
      const g = 1 + i * (v.begin ? 1 : 0);
      const x = (g * v.PMT - v.FV * i) / (v.PV * i + g * v.PMT);
      if (x <= 0) return null; // no real solution
      return Math.log(x) / Math.log(1 + i);
    },

    computeIY: function (v) {
      const self = this;
      const f = function (i) {
        const g = 1 + i * (v.begin ? 1 : 0);
        const a = self.annuityFactor(i, v.N);
        return v.PV + g * v.PMT * a + v.FV * Math.pow(1 + i, -v.N);
      };
      // Per-period rate is searched over a wide, sensible range.
      const i = solve(f, -0.9999, 5, 0.0005);
      if (i === null) return null;
      return this.annualRate(i, v.PY, v.CY);
    },
  };

  // ---- Cash Flow worksheet: NPV / IRR -------------------------------------
  const CashFlow = {
    // flows: [{ amount, freq }] where index 0 is CF0 (freq ignored, treated 1).
    // Expand into a flat per-period array starting at t = 0.
    expand: function (flows) {
      const out = [];
      flows.forEach(function (cf, idx) {
        const freq = idx === 0 ? 1 : Math.max(1, Math.floor(cf.freq || 1));
        for (let k = 0; k < freq; k++) out.push(cf.amount);
      });
      return out;
    },

    // ratePct is the per-period discount rate in percent.
    npv: function (flows, ratePct) {
      const series = this.expand(flows);
      const r = ratePct / 100;
      let total = 0;
      for (let t = 0; t < series.length; t++) {
        total += series[t] / Math.pow(1 + r, t);
      }
      return total;
    },

    // IRR as a per-period percent, or null if none found in range.
    irr: function (flows) {
      const series = this.expand(flows);
      const f = function (r) {
        let total = 0;
        for (let t = 0; t < series.length; t++) {
          total += series[t] / Math.pow(1 + r, t);
        }
        return total;
      };
      const r = solve(f, -0.9999, 5, 0.0005);
      return r === null ? null : r * 100;
    },
  };

  const BAII = { TVM: TVM, CashFlow: CashFlow, _solve: solve };

  if (typeof module !== "undefined" && module.exports) module.exports = BAII;
  global.BAII = BAII;
})(typeof window !== "undefined" ? window : globalThis);
