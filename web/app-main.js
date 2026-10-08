const enhancementStyles = document.createElement("link");
enhancementStyles.rel = "stylesheet";
enhancementStyles.href = "./personalize.css";
document.head.appendChild(enhancementStyles);

Object.assign(benchmarkDefinitions, {
  health_optimal: {
    label: "Health optimization review",
    shortLabel: "Health optimization",
    lower: 1.2,
    upper: 1.6,
    basis: "bodyweight",
    color: "#0d9488",
    description: "Review-level target proposed for optimizing adult health outcomes.",
    source: "https://pubmed.ncbi.nlm.nih.gov/26960445/"
  },
  weight_management: {
    label: "Weight management / fat-loss diets",
    shortLabel: "Weight management",
    lower: 1.2,
    upper: 1.6,
    basis: "bodyweight",
    color: "#ca8a04",
    description: "Review range associated with appetite, weight-management, and cardiometabolic outcomes.",
    source: "https://pubmed.ncbi.nlm.nih.gov/25926512/"
  },
  older_active: {
    label: "Active or exercising adults aged 65+",
    shortLabel: "Active 65+ minimum",
    lower: 1.2,
    upper: 1.2,
    basis: "bodyweight",
    color: "#7c3aed",
    description: "PROT-AGE advises at least 1.2 g/kg/day for older adults who exercise or are otherwise active.",
    source: "https://pubmed.ncbi.nlm.nih.gov/23867520/"
  },
  older_ill: {
    label: "Older adults with acute or chronic illness",
    shortLabel: "Older illness context",
    lower: 1.2,
    upper: 1.5,
    basis: "bodyweight",
    color: "#be123c",
    description: "Clinical-context PROT-AGE range; not a self-treatment recommendation.",
    source: "https://pubmed.ncbi.nlm.nih.gov/23867520/"
  },
  personal: {
    label: "Personal / custom target",
    shortLabel: "Personal target",
    lower: 1.4,
    upper: 2.0,
    basis: "bodyweight",
    color: "#2563eb",
    description: "Editable educational target; it is not generated as medical advice."
  }
});

benchmarkOrder.splice(
  0,
  benchmarkOrder.length,
  "none",
  "rda",
  "us_dga",
  "health_optimal",
  "weight_management",
  "exercise",
  "morton",
  "older",
  "older_active",
  "older_ill",
  "deficit",
  "personal"
);

const personalProfiles = {
  general_health: {
    label: "General health / current U.S. goal",
    lower: 1.2,
    upper: 1.6,
    basis: "bodyweight",
    source: "https://cdn.realfood.gov/DGA.pdf",
    description: "Current U.S. protein serving goal."
  },
  health_optimization: {
    label: "Health optimization review",
    lower: 1.2,
    upper: 1.6,
    basis: "bodyweight",
    source: "https://pubmed.ncbi.nlm.nih.gov/26960445/",
    description: "Review-level target for adults."
  },
  weight_management: {
    label: "Weight management / fat loss",
    lower: 1.2,
    upper: 1.6,
    basis: "bodyweight",
    source: "https://pubmed.ncbi.nlm.nih.gov/25926512/",
    description: "Higher-protein weight-management range."
  },
  regular_exercise: {
    label: "Regular exercise",
    lower: 1.4,
    upper: 2.0,
    basis: "bodyweight",
    source: "https://doi.org/10.1186/s12970-017-0177-8",
    description: "ISSN range for most exercising individuals."
  },
  healthy_older: {
    label: "Healthy adult aged 65+",
    lower: 1.0,
    upper: 1.2,
    basis: "bodyweight",
    source: "https://pubmed.ncbi.nlm.nih.gov/23867520/",
    description: "PROT-AGE range for healthy older adults."
  },
  active_older: {
    label: "Active or exercising adult aged 65+",
    lower: 1.2,
    upper: 1.2,
    basis: "bodyweight",
    source: "https://pubmed.ncbi.nlm.nih.gov/23867520/",
    description: "PROT-AGE minimum for active older adults."
  },
  lean_trained_deficit: {
    label: "Lean, resistance-trained, energy deficit",
    lower: 2.3,
    upper: 3.1,
    basis: "ffm",
    source: "https://doi.org/10.1123/ijsnem.2013-0054",
    description: "Specialized range per kilogram of fat-free mass."
  },
  custom: {
    label: "Custom",
    lower: 1.2,
    upper: 1.6,
    basis: "bodyweight",
    source: "",
    description: "User-defined contextual range."
  }
};

Object.assign(state, {
  personalProfile: "regular_exercise",
  customLower: 1.4,
  customUpper: 2.0,
  customBasis: "bodyweight",
  customLabel: "Regular exercise",
  customSource: personalProfiles.regular_exercise.source,
  customDescription: personalProfiles.regular_exercise.description
});

function resolvedBenchmark(key = state.benchmark) {
  if (key === "personal") {
    const lower = Math.max(0, Number(state.customLower));
    const upper = Math.max(lower, Number(state.customUpper));
    const factor = state.customBasis === "ffm" ? 1 - state.bodyFat / 100 : 1;
    return {
      ...benchmarkDefinitions.personal,
      key,
      label: state.customLabel || "Personal / custom target",
      shortLabel: state.customLabel || "Personal target",
      description: state.customDescription || "Editable educational target.",
      source: state.customSource || "",
      basis: state.customBasis,
      lower,
      upper,
      lowerResolved: lower * factor,
      upperResolved: upper * factor,
      isPoint: Math.abs(lower - upper) < 1e-9,
      converted: state.customBasis === "ffm"
    };
  }

  const definition = benchmarkDefinitions[key] || benchmarkDefinitions.none;
  if (definition.lower == null) {
    return {
      ...definition,
      key,
      lowerResolved: null,
      upperResolved: null,
      isPoint: false,
      converted: false
    };
  }
  const factor = definition.basis === "ffm" ? 1 - state.bodyFat / 100 : 1;
  return {
    ...definition,
    key,
    lowerResolved: definition.lower * factor,
    upperResolved: definition.upper * factor,
    isPoint: Math.abs(definition.lower - definition.upper) < 1e-9,
    converted: definition.basis === "ffm"
  };
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const metric = params.get("metric");
  if (metricDefinitions[metric]) state.metric = metric;

  const year = Number(params.get("year"));
  if (Number.isInteger(year)) {
    state.year = year;
    state.urlYearProvided = true;
  }

  const countries = (params.get("countries") || "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => state.countries.has(code));
  if (params.has("countries")) {
    state.selectedCodes = [...new Set(countries)].slice(0, MAX_COUNTRIES);
  }

  const benchmark = params.get("benchmark")
    || params.get("reference")
    || (params.get("benchmarks") || "").split(",").find((key) => benchmarkDefinitions[key]);
  if (benchmarkDefinitions[benchmark]) state.benchmark = benchmark;

  const weight = Number(params.get("weight"));
  if (weight >= 35 && weight <= 250) state.personalWeight = weight;

  const bodyFat = Number(params.get("bodyfat"));
  if (bodyFat >= 5 && bodyFat <= 50) state.bodyFat = bodyFat;

  const profile = params.get("profile");
  if (personalProfiles[profile]) state.personalProfile = profile;

  const lower = Number(params.get("lower"));
  const upper = Number(params.get("upper"));
  if (Number.isFinite(lower) && lower >= 0 && lower <= 6) state.customLower = lower;
  if (Number.isFinite(upper) && upper >= state.customLower && upper <= 6) state.customUpper = upper;

  const basis = params.get("basis");
  if (basis === "bodyweight" || basis === "ffm") state.customBasis = basis;

  const label = params.get("target");
  if (label) state.customLabel = label.slice(0, 60);
}

function syncUrl() {
  const params = new URLSearchParams();
  params.set("metric", state.metric);
  params.set("year", String(state.year));
  params.set("countries", state.selectedCodes.join(","));
  params.set("benchmark", state.benchmark);
  params.set("weight", String(state.personalWeight));
  params.set("bodyfat", String(state.bodyFat));
  if (state.benchmark === "personal") {
    params.set("profile", state.personalProfile);
    params.set("lower", String(state.customLower));
    params.set("upper", String(state.customUpper));
    params.set("basis", state.customBasis);
    params.set("target", state.customLabel);
  }
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash || "#explorer"}`;
  window.history.replaceState(null, "", next);
}

function installPersonalizationUi() {
  const benchmarkRow = document.querySelector(".benchmark-row");
  if (benchmarkRow && !document.getElementById("personal-target-builder")) {
    const builder = document.createElement("section");
    builder.id = "personal-target-builder";
    builder.className = "personal-target-builder";
    builder.innerHTML = `
      <div class="personal-target-heading">
        <div>
          <span class="panel-kicker">Personal target builder</span>
          <strong>Choose a sourced profile, then edit it.</strong>
        </div>
        <button id="personalize-toggle" class="preset-button" type="button" aria-expanded="false">Personalize</button>
      </div>
      <div id="personalize-panel" class="personalize-panel" hidden>
        <label>
          <span>Profile</span>
          <select id="profile-select">
            ${Object.entries(personalProfiles).map(([key, profile]) =>
              `<option value="${escapeHtml(key)}">${escapeHtml(profile.label)}</option>`
            ).join("")}
          </select>
        </label>
        <label>
          <span>Lower target</span>
          <span class="input-with-unit"><input id="custom-lower" type="number" min="0" max="6" step="0.05"><span>g/kg/d</span></span>
        </label>
        <label>
          <span>Upper target</span>
          <span class="input-with-unit"><input id="custom-upper" type="number" min="0" max="6" step="0.05"><span>g/kg/d</span></span>
        </label>
        <label>
          <span>Calculation basis</span>
          <select id="custom-basis">
            <option value="bodyweight">Total bodyweight</option>
            <option value="ffm">Fat-free mass</option>
          </select>
        </label>
        <div id="personal-target-output" class="personal-target-output"></div>
        <p class="personal-target-caveat">Educational calculator only. It does not account for kidney disease, pregnancy, adolescence, acute illness, medications, or other clinical factors.</p>
        <a href="https://github.com/mariomarcolongo/protein-by-bodyweight-country/blob/main/docs/PERSONAL_TARGETS.md" target="_blank" rel="noreferrer">Methods and sources ↗</a>
      </div>`;
    benchmarkRow.insertAdjacentElement("afterend", builder);
  }

  const gdpPanel = document.querySelector(".gdp-panel");
  if (gdpPanel && !document.getElementById("gdp-formula-note")) {
    const heading = gdpPanel.querySelector(".panel-heading");
    const note = document.createElement("p");
    note.id = "gdp-formula-note";
    note.className = "gdp-formula-note";
    heading.insertAdjacentElement("afterend", note);

    const exactValues = document.createElement("div");
    exactValues.id = "gdp-selected-values";
    exactValues.className = "gdp-selected-values";
    gdpPanel.querySelector(".chart-note").insertAdjacentElement("beforebegin", exactValues);
  }

  const benchmarkSection = document.getElementById("benchmarks");
  if (benchmarkSection && !document.getElementById("reference-library")) {
    const library = document.createElement("div");
    library.id = "reference-library";
    library.className = "reference-library";
    const keys = benchmarkOrder.filter((key) => key !== "none" && key !== "personal");
    library.innerHTML = `
      <div class="reference-library-heading">
        <div>
          <p class="eyebrow">Reference library</p>
          <h3>More contexts, one active overlay.</h3>
        </div>
        <p>Click a card to use it in the explorer. Only the selected range is drawn.</p>
      </div>
      <div class="reference-card-grid">
        ${keys.map((key) => {
          const item = benchmarkDefinitions[key];
          const basis = item.basis === "ffm" ? "per kg fat-free mass" : "per kg bodyweight";
          return `<button type="button" class="reference-card" data-reference-key="${escapeHtml(key)}">
            <span>${escapeHtml(item.shortLabel)}</span>
            <strong>${escapeHtml(formatRange(item.lower, item.upper))}</strong>
            <small>g/kg/day · ${escapeHtml(basis)}</small>
          </button>`;
        }).join("")}
      </div>`;
    benchmarkSection.querySelector(".method-cta").insertAdjacentElement("beforebegin", library);
  }
}

function applyPersonalProfile(key, {render = true} = {}) {
  const profile = personalProfiles[key] || personalProfiles.custom;
  state.personalProfile = key;
  state.customLower = profile.lower;
  state.customUpper = profile.upper;
  state.customBasis = profile.basis;
  state.customLabel = profile.label;
  state.customSource = profile.source;
  state.customDescription = profile.description;
  state.benchmark = "personal";

  const benchmarkSelect = document.getElementById("benchmark-select");
  if (benchmarkSelect) benchmarkSelect.value = "personal";
  syncPersonalInputs();

  if (render) {
    updateBenchmarkSummary();
    renderTrend();
    renderComparisonTable();
    renderGdpScatter();
    syncUrl();
  }
}

function syncPersonalInputs() {
  const profile = document.getElementById("profile-select");
  const lower = document.getElementById("custom-lower");
  const upper = document.getElementById("custom-upper");
  const basis = document.getElementById("custom-basis");
  if (profile) profile.value = state.personalProfile;
  if (lower) lower.value = String(state.customLower);
  if (upper) upper.value = String(state.customUpper);
  if (basis) basis.value = state.customBasis;

  const output = document.getElementById("personal-target-output");
  if (output) {
    const target = resolvedBenchmark("personal");
    const dailyLow = target.lowerResolved * state.personalWeight;
    const dailyHigh = target.upperResolved * state.personalWeight;
    output.innerHTML = `
      <span><small>Graph range</small><strong>${escapeHtml(formatRange(target.lowerResolved, target.upperResolved))} g/kg/day</strong></span>
      <span><small>Daily equivalent</small><strong>${escapeHtml(formatRange(dailyLow, dailyHigh, 0))} g/day</strong></span>
      ${target.converted ? `<span><small>Conversion</small><strong>${state.bodyFat}% body fat assumed</strong></span>` : ""}`;
  }

  const bodyFatWrap = document.getElementById("body-fat-wrap");
  if (bodyFatWrap && state.benchmark === "personal") {
    bodyFatWrap.hidden = state.customBasis !== "ffm";
  }
}

function renderBenchmarkControl() {
  el("benchmark-select").innerHTML = benchmarkOrder.map((key) =>
    `<option value="${escapeHtml(key)}" ${state.benchmark === key ? "selected" : ""}>${escapeHtml(benchmarkDefinitions[key].label)}</option>`
  ).join("");
  el("personal-weight").value = String(state.personalWeight);
  el("body-fat").value = String(state.bodyFat);
  el("body-fat-output").value = `${state.bodyFat}%`;
  syncPersonalInputs();
  updateBenchmarkSummary();
  updateBenchmarkAvailability();
}

function updateBenchmarkSummary() {
  if (state.metric !== "protein_supply_g_kg_day") return;

  const item = resolvedBenchmark();
  const bodyFatWrap = el("body-fat-wrap");
  bodyFatWrap.hidden = !(item.key === "deficit" || (item.key === "personal" && item.basis === "ffm"));

  if (item.lowerResolved == null) {
    el("benchmark-summary").innerHTML = `
      <span class="benchmark-muted">No reference is drawn. Country lines use an automatic data-focused scale.</span>
      <span class="no-ul-note">No universal protein upper intake level has been established.</span>`;
    return;
  }

  const point = item.isPoint
    ? `<span class="range-stat"><small>Reference / minimum</small><strong>${item.lowerResolved.toFixed(2)}</strong><span>g/kg/day</span></span>`
    : `<span class="range-stat"><small>Lower endpoint</small><strong>${item.lowerResolved.toFixed(2)}</strong><span>g/kg/day</span></span>
       <span class="range-divider" aria-hidden="true"></span>
       <span class="range-stat"><small>Upper endpoint</small><strong>${item.upperResolved.toFixed(2)}</strong><span>g/kg/day</span></span>`;

  const source = item.source
    ? `<a href="${item.source}" target="_blank" rel="noreferrer">Source ↗</a>`
    : "";

  el("benchmark-summary").innerHTML = `
    <span class="benchmark-color" style="background:${item.color}"></span>
    <span class="benchmark-copy">
      <strong>${escapeHtml(item.shortLabel)}</strong>
      <span>${escapeHtml(item.description)}</span>
    </span>
    ${point}
    <span class="daily-equivalent">${escapeHtml(benchmarkDailyLabel())}</span>
    ${source}
    <span class="no-ul-note">The upper endpoint is not a universal safety maximum.</span>`;

  syncPersonalInputs();
}

function linearRegression(xs, ys) {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index] - meanX;
    numerator += dx * (ys[index] - meanY);
    denominator += dx * dx;
  }
  if (!denominator) return null;
  const slope = numerator / denominator;
  return {slope, intercept: meanY - slope * meanX};
}

function gdpReferenceShapes() {
  if (state.metric !== "protein_supply_g_kg_day") return [];
  const item = resolvedBenchmark();
  if (item.lowerResolved == null) return [];
  const values = item.isPoint
    ? [{value: item.lowerResolved, dash: "dot"}]
    : [
        {value: item.lowerResolved, dash: "dash"},
        {value: item.upperResolved, dash: "dot"}
      ];
  return values.map(({value, dash}) => ({
    type: "line",
    xref: "paper",
    yref: "y",
    x0: 0,
    x1: 1,
    y0: value,
    y1: value,
    line: {color: item.color, width: 1.4, dash},
    layer: "below"
  }));
}

function renderGdpScatter() {
  const definition = metricDefinitions[state.metric];
  const rows = recordsForYear(state.year, false).filter((row) =>
    row.gdp_per_capita_ppp_2021 != null
    && row.gdp_per_capita_ppp_2021 > 0
    && row[state.metric] != null
  );

  const normalized = state.metric === "protein_supply_g_kg_day";
  const explicitLabel = normalized
    ? "Protein supply ÷ estimated adult bodyweight"
    : definition.label;
  el("gdp-title").textContent = `${explicitLabel} vs GDP per capita, ${state.year}`;

  const formulaNote = document.getElementById("gdp-formula-note");
  if (formulaNote) {
    formulaNote.textContent = normalized
      ? "Y-axis = FAOSTAT protein supply (g/person/day) ÷ estimated adult bodyweight (kg). Every point therefore uses g/kg/day."
      : `Y-axis = ${definition.label} (${definition.unit}).`;
  }

  if (!rows.length) {
    const coverage = state.metadata.coverage || {};
    const start = coverage.gdp_year_min || 1990;
    renderEmptyPlot(
      "gdp-chart",
      state.year < start
        ? `World Bank GDP-per-capita coverage begins in ${start}. Choose a later year.`
        : "No matched GDP and indicator values are available for this year."
    );
    el("gdp-summary").textContent = "No matched observations";
    const exact = document.getElementById("gdp-selected-values");
    if (exact) exact.innerHTML = "";
    return;
  }

  const logXs = rows.map((row) => Math.log10(Number(row.gdp_per_capita_ppp_2021)));
  const ys = rows.map((row) => Number(row[state.metric]));
  const correlation = pearsonCorrelation(logXs, ys);
  const regression = linearRegression(logXs, ys);
  el("gdp-summary").textContent = `${rows.length} countries${correlation == null ? "" : ` · descriptive r = ${correlation.toFixed(2)} with log GDP`}`;

  const selected = new Set(state.selectedCodes);
  const baseRows = rows.filter((row) => !selected.has(row.Code));
  const selectedRows = rows.filter((row) => selected.has(row.Code));
  const positions = ["top left", "bottom right", "top right", "bottom left", "middle right", "middle left"];

  const makeTrace = (items, highlighted) => ({
    type: "scatter",
    mode: highlighted ? "markers+text" : "markers",
    x: items.map((row) => row.gdp_per_capita_ppp_2021),
    y: items.map((row) => row[state.metric]),
    text: items.map((row) => row.Entity),
    textposition: highlighted ? items.map((_, index) => positions[index % positions.length]) : "top center",
    customdata: items.map((row) => [
      formatMoney(row.gdp_per_capita_ppp_2021),
      formatValue(row[state.metric], definition),
      formatValue(row.protein_supply_g_day, metricDefinitions.protein_supply_g_day),
      formatValue(row.estimated_adult_bodyweight_kg, metricDefinitions.estimated_adult_bodyweight_kg)
    ]),
    marker: highlighted
      ? {
          size: 11,
          color: isDark() ? "#edf4ef" : "#10231f",
          line: {width: 2, color: chartBg()}
        }
      : {
          size: 8,
          opacity: 0.48,
          color: items.map((row) => row[state.metric]),
          colorscale: definition.colorScale,
          line: {width: 0.35, color: chartBg()},
          showscale: false
        },
    hovertemplate: `<b>%{text}</b><br>GDP per capita PPP: %{customdata[0]}<br>${explicitLabel}: %{customdata[1]}<br>Protein supply numerator: %{customdata[2]}<br>Bodyweight denominator: %{customdata[3]}<extra></extra>`,
    showlegend: false
  });

  const traces = [makeTrace(baseRows, false)];

  if (regression) {
    const minX = Math.min(...logXs);
    const maxX = Math.max(...logXs);
    const regressionX = Array.from({length: 60}, (_, index) =>
      minX + (maxX - minX) * index / 59
    );
    traces.push({
      type: "scatter",
      mode: "lines",
      x: regressionX.map((value) => 10 ** value),
      y: regressionX.map((value) => regression.intercept + regression.slope * value),
      line: {
        color: isDark() ? "rgba(237,244,239,.58)" : "rgba(16,35,31,.58)",
        width: 1.6,
        dash: "dash"
      },
      hoverinfo: "skip",
      showlegend: false
    });
  }

  if (selectedRows.length) traces.push(makeTrace(selectedRows, true));

  const yValues = [...ys];
  if (normalized) {
    const reference = resolvedBenchmark();
    if (reference.lowerResolved != null) {
      yValues.push(reference.lowerResolved, reference.upperResolved);
    }
  }
  const yLow = Math.min(...yValues);
  const yHigh = Math.max(...yValues);
  const ySpan = Math.max(yHigh - yLow, 0.2);

  const layout = {
    ...commonLayout(),
    margin: {l: 92, r: 34, t: 22, b: 72},
    shapes: gdpReferenceShapes(),
    xaxis: {
      title: "GDP per capita, PPP (constant 2021 international dollars; log scale)",
      type: "log",
      gridcolor: chartGrid(),
      zeroline: false,
      tickvals: [1000, 3000, 10000, 30000, 100000],
      ticktext: ["$1k", "$3k", "$10k", "$30k", "$100k"],
      automargin: true
    },
    yaxis: {
      title: normalized
        ? "Protein supply ÷ estimated adult bodyweight (g/kg/day)"
        : `${definition.label} (${definition.unit})`,
      gridcolor: chartGrid(),
      zeroline: false,
      range: [Math.max(0, yLow - ySpan * 0.12), yHigh + ySpan * 0.12],
      automargin: true
    }
  };

  Plotly.react("gdp-chart", traces, layout, plotConfig());

  const exact = document.getElementById("gdp-selected-values");
  if (exact) {
    exact.innerHTML = selectedRows.length
      ? selectedRows.map((row) => `
          <span>
            <strong>${escapeHtml(row.Entity)}</strong>
            <b>${escapeHtml(formatValue(row[state.metric], definition))}</b>
            <small>${escapeHtml(formatMoney(row.gdp_per_capita_ppp_2021))} GDP PPP</small>
          </span>`).join("")
      : `<span class="empty-selection">Select countries to display their exact matched GDP and protein values.</span>`;
  }
}

function renderComparisonTable() {
  const definition = metricDefinitions[state.metric];
  const benchmark = resolvedBenchmark();
  const normalized = state.metric === "protein_supply_g_kg_day";

  el("comparison-title").textContent = normalized && benchmark.lowerResolved != null
    ? `${state.year} relative to ${benchmark.shortLabel}`
    : `${state.year} selected-country values`;
  el("comparison-value-heading").textContent = definition.label;

  if (!state.selectedCodes.length) {
    el("comparison-body").innerHTML = `<tr><td colspan="5" class="empty-list">Select countries to populate this table.</td></tr>`;
    return;
  }

  const rows = state.selectedCodes.map((code) => {
    const record = recordForCountryYear(code, state.year);
    return {
      code,
      name: state.countries.get(code) || code,
      value: record?.[state.metric] ?? null,
      gdp: record?.gdp_per_capita_ppp_2021 ?? null
    };
  }).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));

  el("comparison-body").innerHTML = rows.map((row) => {
    const position = normalized
      ? comparisonPosition(row.value, benchmark)
      : {label: "Different unit", className: "unavailable"};
    const reference = normalized && benchmark.lowerResolved != null
      ? benchmarkRangeLabel()
      : "—";
    return `<tr>
      <td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.code)}</small></td>
      <td><strong>${escapeHtml(formatValue(row.value, definition))}</strong><small>GDP PPP ${escapeHtml(formatMoney(row.gdp))}</small></td>
      <td>${escapeHtml(reference)}</td>
      <td><span class="position-badge ${position.className}">${escapeHtml(position.label)}</span></td>
      <td><button class="remove-row-button" type="button" data-remove-country="${escapeHtml(row.code)}" aria-label="Remove ${escapeHtml(row.name)}">×</button></td>
    </tr>`;
  }).join("");
}

function renderSelectionDependentViews() {
  renderSelectedCountries();
  renderMap();
  renderRanking();
  renderTrend();
  renderComparisonTable();
  renderGdpScatter();
}

function renderAll() {
  const generation = ++state.renderGeneration;
  el("year-output").value = String(state.year);
  el("data-warning").textContent = metricDefinitions[state.metric].warning;
  updateBenchmarkAvailability();
  renderSelectedCountries();
  renderMap();
  renderRanking();
  renderComparisonTable();

  window.requestAnimationFrame(() => {
    if (generation !== state.renderGeneration) return;
    renderTrend();
    renderGdpScatter();
  });
}

function scheduleBenchmarkRefresh() {
  if (state.benchmarkFrame) window.cancelAnimationFrame(state.benchmarkFrame);
  state.benchmarkFrame = window.requestAnimationFrame(() => {
    updateBenchmarkSummary();
    renderTrend();
    renderComparisonTable();
    renderGdpScatter();
    syncUrl();
    state.benchmarkFrame = null;
  });
}

async function copyShareView() {
  syncUrl();
  const feedback = el("share-feedback");
  try {
    await navigator.clipboard.writeText(window.location.href);
    feedback.textContent = "Link copied.";
  } catch (_error) {
    const text = document.createElement("textarea");
    text.value = window.location.href;
    text.style.position = "fixed";
    text.style.opacity = "0";
    document.body.appendChild(text);
    text.select();
    document.execCommand("copy");
    text.remove();
    feedback.textContent = "Link copied.";
  }
  window.setTimeout(() => { feedback.textContent = ""; }, 2200);
}

function wirePersonalizationEvents() {
  const toggle = document.getElementById("personalize-toggle");
  const panel = document.getElementById("personalize-panel");
  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Personalize";
    });
  }

  const profile = document.getElementById("profile-select");
  if (profile) {
    profile.addEventListener("change", (event) => {
      applyPersonalProfile(event.target.value);
    });
  }

  const lower = document.getElementById("custom-lower");
  const upper = document.getElementById("custom-upper");
  const basis = document.getElementById("custom-basis");

  const applyCustomInputs = () => {
    const nextLower = Number(lower?.value);
    const nextUpper = Number(upper?.value);
    if (!Number.isFinite(nextLower) || !Number.isFinite(nextUpper)) return;
    state.personalProfile = "custom";
    state.customLower = Math.max(0, Math.min(nextLower, 6));
    state.customUpper = Math.max(state.customLower, Math.min(nextUpper, 6));
    state.customBasis = basis?.value === "ffm" ? "ffm" : "bodyweight";
    state.customLabel = "Custom target";
    state.customSource = "";
    state.customDescription = "User-defined contextual range.";
    state.benchmark = "personal";
    el("benchmark-select").value = "personal";
    syncPersonalInputs();
    updateBenchmarkSummary();
    renderTrend();
    renderComparisonTable();
    renderGdpScatter();
    syncUrl();
  };

  lower?.addEventListener("change", applyCustomInputs);
  upper?.addEventListener("change", applyCustomInputs);
  basis?.addEventListener("change", applyCustomInputs);

  const library = document.getElementById("reference-library");
  library?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reference-key]");
    if (!button) return;
    state.benchmark = button.dataset.referenceKey;
    el("benchmark-select").value = state.benchmark;
    updateBenchmarkSummary();
    renderTrend();
    renderComparisonTable();
    renderGdpScatter();
    syncUrl();
    document.getElementById("explorer")?.scrollIntoView({behavior: "smooth", block: "start"});
  });
}

function wireEvents() {
  el("metric-select").addEventListener("change", (event) => {
    state.metric = event.target.value;
    setYearForMetric({preferLatest: true});
    renderAll();
    syncUrl();
  });

  el("year-slider").addEventListener("input", (event) => {
    el("year-output").value = event.target.value;
  });
  el("year-slider").addEventListener("change", (event) => {
    state.year = Number(event.target.value);
    renderAll();
    syncUrl();
  });

  const selectFromSearch = ({allowPrefix = false} = {}) => {
    const input = el("country-search");
    const code = resolveCountryQuery(input.value, {allowPrefix});
    if (!code) {
      if (allowPrefix) {
        setCountryFeedback("Choose a country from the suggestions or enter a unique name or ISO-3 code.", true);
      }
      return false;
    }
    if (addCountry(code)) input.value = "";
    return true;
  };

  el("country-search").addEventListener("input", () => {
    const input = el("country-search");
    if (resolveCountryQuery(input.value, {allowPrefix: false})) {
      selectFromSearch({allowPrefix: false});
    }
  });
  el("country-search").addEventListener("change", () => {
    selectFromSearch({allowPrefix: false});
  });
  el("country-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      selectFromSearch({allowPrefix: true});
    }
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });
  el("clear-countries").addEventListener("click", () => {
    state.selectedCodes = [];
    setCountryFeedback("Selection cleared.");
    renderSelectionDependentViews();
    syncUrl();
  });

  el("selected-country-chips").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-country]");
    if (button) removeCountry(button.dataset.removeCountry);
  });
  el("comparison-body").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-country]");
    if (button) removeCountry(button.dataset.removeCountry);
  });
  el("ranking-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-toggle-country]");
    if (button) toggleCountry(button.dataset.toggleCountry);
  });

  el("benchmark-select").addEventListener("change", (event) => {
    state.benchmark = event.target.value;
    if (state.benchmark === "personal") {
      const panel = document.getElementById("personalize-panel");
      const toggle = document.getElementById("personalize-toggle");
      if (panel) panel.hidden = false;
      if (toggle) {
        toggle.setAttribute("aria-expanded", "true");
        toggle.textContent = "Close";
      }
    }
    updateBenchmarkSummary();
    renderTrend();
    renderComparisonTable();
    renderGdpScatter();
    syncUrl();
  });

  el("body-fat").addEventListener("input", (event) => {
    state.bodyFat = Number(event.target.value);
    el("body-fat-output").value = `${state.bodyFat}%`;
    scheduleBenchmarkRefresh();
  });

  el("personal-weight").addEventListener("input", (event) => {
    const value = Number(event.target.value);
    if (value >= 35 && value <= 250) {
      state.personalWeight = value;
      updateBenchmarkSummary();
      syncPersonalInputs();
      syncUrl();
    }
  });

  wirePersonalizationEvents();

  el("share-view").addEventListener("click", copyShareView);
  el("theme-toggle").addEventListener("click", () => {
    document.documentElement.dataset.theme = isDark() ? "light" : "dark";
    localStorage.setItem("protein-theme", document.documentElement.dataset.theme);
    renderAll();
  });
  el("retry-button").addEventListener("click", () => window.location.reload());
}

function showLoaded() {
  el("loading-state").hidden = true;
  el("dashboard-shell").hidden = false;
  document.body.classList.add("data-ready");
}

function showError(error) {
  console.error(error);
  el("loading-state").hidden = true;
  el("dashboard-shell").hidden = true;
  el("error-state").hidden = false;
  el("error-detail").textContent = error instanceof Error ? error.message : String(error);
}

async function init() {
  const savedTheme = localStorage.getItem("protein-theme");
  if (savedTheme === "dark" || savedTheme === "light") {
    document.documentElement.dataset.theme = savedTheme;
  }

  try {
    if (!window.Plotly) throw new Error("The chart library did not load.");
    installPersonalizationUi();
    const response = await fetch(DATA_URL, {cache: "no-cache"});
    if (!response.ok) throw new Error(`Dataset request failed with HTTP ${response.status}.`);
    const payload = await response.json();
    state.metadata = payload.metadata || {};
    state.records = decodePayload(payload);
    buildIndexes();
    readUrlState();
    renderSummary();
    populateCountryDatalist();
    renderBenchmarkControl();
    el("metric-select").value = state.metric;
    setYearForMetric({preferLatest: !state.urlYearProvided});
    wireEvents();
    showLoaded();
    renderAll();
    syncUrl();
  } catch (error) {
    showError(error);
  }
}

window.addEventListener("DOMContentLoaded", init);
