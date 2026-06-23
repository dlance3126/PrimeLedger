const assumptions = {
  cogsPercent: 0.31,
  targetLaborPercent: 0.24,
  targetPrimeCostPercent: 0.6,
  bankCash: null,
  payrollDue: null,
  vendorDue: null,
  reserveTarget: null,
  hourlyLaborCost: 22,
  upcomingPayday: "2026-05-28",
};

const configStorageKey = "primeledger-config-v1";
const defaultLaborRules = [
  { id: "owners", name: "Owners", match: "owner,darin,maia,dennis", paid: false, rate: 0 },
  { id: "server-training", name: "Server Training", match: "server training,training", paid: false, rate: 0 },
  { id: "chef", name: "Chef", match: "chef,kody,dustin", paid: true, rate: 22 },
  { id: "default-paid", name: "Default paid labor", match: "*", paid: true, rate: 22 },
];

let rows = [];
let laborRules = defaultLaborRules.map((rule) => ({ ...rule }));
let importSources = [];

const elements = {
  sidebarToggle: document.querySelector("#sidebarToggle"),
  viewLinks: document.querySelectorAll("[data-view-link]"),
  views: document.querySelectorAll("[data-view]"),
  businessDate: document.querySelector("#businessDate"),
  netSales: document.querySelector("#netSales"),
  salesDelta: document.querySelector("#salesDelta"),
  laborPercent: document.querySelector("#laborPercent"),
  laborDelta: document.querySelector("#laborDelta"),
  primeCost: document.querySelector("#primeCost"),
  primeCostDollars: document.querySelector("#primeCostDollars"),
  distributionSafety: document.querySelector("#distributionSafety"),
  cashRunway: document.querySelector("#cashRunway"),
  trendChart: document.querySelector("#trendChart"),
  shiftRows: document.querySelector("#shiftRows"),
  alertsList: document.querySelector("#alertsList"),
  bankCash: document.querySelector("#bankCash"),
  payrollDue: document.querySelector("#payrollDue"),
  vendorDue: document.querySelector("#vendorDue"),
  reserveTarget: document.querySelector("#reserveTarget"),
  hourlyLaborCost: document.querySelector("#hourlyLaborCost"),
  previousPayroll: document.querySelector("#previousPayroll"),
  previousPayrollWindow: document.querySelector("#previousPayrollWindow"),
  upcomingPayroll: document.querySelector("#upcomingPayroll"),
  upcomingPayrollWindow: document.querySelector("#upcomingPayrollWindow"),
  cashAfterPayroll: document.querySelector("#cashAfterPayroll"),
  csvInput: document.querySelector("#csvInput"),
  folderInput: document.querySelector("#folderInput"),
  loadToastData: document.querySelector("#loadToastData"),
  importStatus: document.querySelector("#importStatus"),
  laborRuleRows: document.querySelector("#laborRuleRows"),
  addLaborRule: document.querySelector("#addLaborRule"),
  targetLaborPercent: document.querySelector("#targetLaborPercent"),
  cogsPercent: document.querySelector("#cogsPercent"),
  targetPrimeCostPercent: document.querySelector("#targetPrimeCostPercent"),
  upcomingPayday: document.querySelector("#upcomingPayday"),
};

function setSidebar(open) {
  document.body.classList.toggle("sidebar-open", open);
  document.body.classList.toggle("sidebar-collapsed", !open);
  elements.sidebarToggle.setAttribute("aria-expanded", String(open));
  elements.sidebarToggle.setAttribute("aria-label", open ? "Collapse navigation" : "Expand navigation");
}

function loadConfig() {
  const saved = JSON.parse(localStorage.getItem(configStorageKey) || "{}");

  Object.assign(assumptions, saved.assumptions || {});
  if (Array.isArray(saved.laborRules) && saved.laborRules.length) {
    laborRules = saved.laborRules;
  }
}

function saveConfig() {
  localStorage.setItem(
    configStorageKey,
    JSON.stringify({
      assumptions,
      laborRules,
    }),
  );
}

function setView(viewName) {
  const availableViews = [...elements.views].map((view) => view.dataset.view);
  const nextView = availableViews.includes(viewName) ? viewName : "dashboard";

  elements.views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === nextView);
  });

  elements.viewLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.viewLink === nextView);
  });
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function shortDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function formatDateRange(startDate, endDate) {
  return `${shortDate(startDate)} - ${shortDate(endDate)}`;
}

function groupByDate(data) {
  return data.reduce((dates, row) => {
    dates[row.date] ||= [];
    dates[row.date].push(row);
    return dates;
  }, {});
}

function summarizeRows(data) {
  const netSales = data.reduce((sum, row) => sum + row.net_sales, 0);
  const laborCost = data.reduce((sum, row) => sum + row.labor_cost, 0);
  const laborHours = data.reduce((sum, row) => sum + row.labor_hours, 0);
  const cogs = netSales * assumptions.cogsPercent;
  const primeCost = laborCost + cogs;

  return {
    netSales,
    laborCost,
    laborHours,
    cogs,
    primeCost,
    laborPercent: netSales ? laborCost / netSales : 0,
    primeCostPercent: netSales ? primeCost / netSales : 0,
    contribution: netSales - primeCost,
  };
}

function dailySummaries() {
  const grouped = groupByDate(rows);
  return Object.keys(grouped)
    .sort()
    .map((date) => ({ date, ...summarizeRows(grouped[date]) }));
}

function payrollCycles() {
  const upcomingPayday = assumptions.upcomingPayday;
  const previousPayday = addDays(upcomingPayday, -14);
  const previousStart = addDays(previousPayday, -14);
  const previousEnd = addDays(previousPayday, -1);
  const upcomingStart = previousPayday;
  const upcomingEnd = addDays(upcomingPayday, -1);

  return {
    previous: {
      payday: previousPayday,
      start: previousStart,
      end: previousEnd,
      summary: summarizeRows(rows.filter((row) => row.date >= previousStart && row.date <= previousEnd)),
    },
    upcoming: {
      payday: upcomingPayday,
      start: upcomingStart,
      end: upcomingEnd,
      summary: summarizeRows(rows.filter((row) => row.date >= upcomingStart && row.date <= upcomingEnd)),
    },
  };
}

function upcomingPayrollDue() {
  const cycles = payrollCycles();
  return cycles.upcoming.summary.laborCost + (assumptions.payrollDue ?? 0);
}

function currentDate() {
  return elements.businessDate.value || dailySummaries().at(-1)?.date;
}

function hasData() {
  return rows.length > 0;
}

function setInitialInputs() {
  elements.bankCash.value = assumptions.bankCash ?? "";
  elements.payrollDue.value = assumptions.payrollDue ?? "";
  elements.vendorDue.value = assumptions.vendorDue ?? "";
  elements.reserveTarget.value = assumptions.reserveTarget ?? "";
  elements.hourlyLaborCost.value = assumptions.hourlyLaborCost;
  elements.targetLaborPercent.value = assumptions.targetLaborPercent * 100;
  elements.cogsPercent.value = assumptions.cogsPercent * 100;
  elements.targetPrimeCostPercent.value = assumptions.targetPrimeCostPercent * 100;
  elements.upcomingPayday.value = assumptions.upcomingPayday;
}

function syncCashAssumptions() {
  assumptions.bankCash = elements.bankCash.value === "" ? null : Number(elements.bankCash.value) || 0;
  assumptions.payrollDue = elements.payrollDue.value === "" ? null : Number(elements.payrollDue.value) || 0;
  assumptions.vendorDue = elements.vendorDue.value === "" ? null : Number(elements.vendorDue.value) || 0;
  assumptions.reserveTarget = elements.reserveTarget.value === "" ? null : Number(elements.reserveTarget.value) || 0;
  assumptions.hourlyLaborCost = Number(elements.hourlyLaborCost.value) || 0;
  assumptions.targetLaborPercent = (Number(elements.targetLaborPercent.value) || 0) / 100;
  assumptions.cogsPercent = (Number(elements.cogsPercent.value) || 0) / 100;
  assumptions.targetPrimeCostPercent = (Number(elements.targetPrimeCostPercent.value) || 0) / 100;
  assumptions.upcomingPayday = elements.upcomingPayday.value || assumptions.upcomingPayday;
}

function renderDateOptions() {
  if (!hasData()) {
    elements.businessDate.innerHTML = `<option value="">No data loaded</option>`;
    return;
  }

  const selected = currentDate();
  elements.businessDate.innerHTML = dailySummaries()
    .map((day) => `<option value="${day.date}">${shortDate(day.date)}</option>`)
    .join("");
  elements.businessDate.value = selected || dailySummaries().at(-1)?.date;
}

function renderMetrics() {
  syncCashAssumptions();

  const summaries = dailySummaries();
  if (!summaries.length) {
    elements.netSales.textContent = "No data";
    elements.salesDelta.textContent = "Upload Toast CSV files";
    elements.laborPercent.textContent = "--";
    elements.laborDelta.textContent = "No labor data loaded";
    elements.primeCost.textContent = "--";
    elements.primeCostDollars.textContent = "No COGS or labor data loaded";
    elements.distributionSafety.textContent = "--";
    elements.cashRunway.textContent = "Load data to calculate";
    return;
  }

  const selectedIndex = summaries.findIndex((day) => day.date === currentDate());
  const selected = summaries[selectedIndex] || summaries.at(-1);
  const previous = summaries[selectedIndex - 1];
  const payrollDue = upcomingPayrollDue();
  const canCalculateDistribution =
    assumptions.bankCash !== null && assumptions.vendorDue !== null && assumptions.reserveTarget !== null;
  const safety = canCalculateDistribution
    ? assumptions.bankCash - payrollDue - assumptions.vendorDue - assumptions.reserveTarget
    : null;
  const dailyBurn = Math.max(1, (payrollDue + (assumptions.vendorDue ?? 0)) / 14);

  elements.netSales.textContent = money(selected.netSales);
  elements.salesDelta.textContent = previous
    ? `${(((selected.netSales - previous.netSales) / previous.netSales) * 100).toFixed(1)}% vs prior day`
    : "No prior day comparison";
  elements.laborPercent.textContent = percent(selected.laborPercent);
  elements.laborDelta.textContent = `${((selected.laborPercent - assumptions.targetLaborPercent) * 100).toFixed(1)} pts vs target`;
  elements.primeCost.textContent = percent(selected.primeCostPercent);
  elements.primeCostDollars.textContent = `${money(selected.primeCost)} labor + COGS`;
  elements.distributionSafety.textContent = safety === null ? "--" : money(Math.max(0, safety));
  elements.cashRunway.textContent =
    safety === null ? "Enter cash, vendors, and reserve" : `${Math.floor(assumptions.bankCash / dailyBurn)} days runway`;
}

function renderTrendChart() {
  const summaries = dailySummaries().slice(-7);
  if (!summaries.length) {
    elements.trendChart.innerHTML = `<div class="empty-state">Upload Toast CSV files to view trends.</div>`;
    return;
  }

  const maxSales = Math.max(...summaries.map((day) => day.netSales), 1);

  elements.trendChart.innerHTML = summaries
    .map((day) => {
      const salesHeight = Math.max(8, (day.netSales / maxSales) * 100);
      const laborHeight = Math.max(8, (day.laborPercent / 0.4) * 100);
      const primeHeight = Math.max(8, (day.primeCostPercent / 0.75) * 100);

      return `
        <div class="bar-group" title="${shortDate(day.date)}: ${money(day.netSales)} sales">
          <div class="bars">
            <div class="bar sales" style="height: ${salesHeight}%"></div>
            <div class="bar labor" style="height: ${laborHeight}%"></div>
            <div class="bar prime" style="height: ${primeHeight}%"></div>
          </div>
          <div class="bar-label">${shortDate(day.date)}</div>
        </div>
      `;
    })
    .join("");
}

function renderShiftRows() {
  const selectedRows = rows.filter((row) => row.date === currentDate());
  if (!selectedRows.length) {
    elements.shiftRows.innerHTML = `
      <tr>
        <td colspan="5">Upload Toast CSV files to view shift profitability.</td>
      </tr>
    `;
    return;
  }

  elements.shiftRows.innerHTML = selectedRows
    .map((row) => {
      const cogs = row.net_sales * assumptions.cogsPercent;
      const contribution = row.net_sales - row.labor_cost - cogs;
      const laborPercent = row.net_sales ? row.labor_cost / row.net_sales : 0;

      return `
        <tr>
          <td>${row.shift}</td>
          <td>${money(row.net_sales)}</td>
          <td>${money(row.labor_cost)}</td>
          <td>${percent(laborPercent)}</td>
          <td>${money(contribution)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderPayroll() {
  syncCashAssumptions();

  if (!hasData()) {
    elements.previousPayroll.textContent = "--";
    elements.previousPayrollWindow.textContent = "Upload Toast labor data";
    elements.upcomingPayroll.textContent = "--";
    elements.upcomingPayrollWindow.textContent = "Upload Toast labor data";
    elements.cashAfterPayroll.textContent = "--";
    return;
  }

  const cycles = payrollCycles();
  const upcomingDue = upcomingPayrollDue();
  const cashAfterPayroll = assumptions.bankCash === null ? null : assumptions.bankCash - upcomingDue;

  elements.previousPayroll.textContent = money(cycles.previous.summary.laborCost);
  elements.previousPayrollWindow.textContent = `${formatDateRange(cycles.previous.start, cycles.previous.end)} paid ${shortDate(cycles.previous.payday)}`;
  elements.upcomingPayroll.textContent = money(upcomingDue);
  elements.upcomingPayrollWindow.textContent = `${formatDateRange(cycles.upcoming.start, cycles.upcoming.end)} pays ${shortDate(cycles.upcoming.payday)}`;
  elements.cashAfterPayroll.textContent = cashAfterPayroll === null ? "--" : money(cashAfterPayroll);
}

function renderLaborRules() {
  elements.laborRuleRows.innerHTML = laborRules
    .map(
      (rule) => `
        <tr data-rule-id="${rule.id}">
          <td>
            <input class="rule-name" value="${rule.name}" aria-label="Rule name" />
          </td>
          <td>
            <input class="rule-match" value="${rule.match}" aria-label="Match text" />
          </td>
          <td>
            <input class="rule-paid" type="checkbox" aria-label="Paid rule" ${rule.paid ? "checked" : ""} />
          </td>
          <td>
            <input class="rule-rate" type="number" min="0" step="0.25" value="${rule.rate}" aria-label="Hourly rate" />
          </td>
          <td>
            <button class="rule-remove" type="button" ${laborRules.length <= 1 ? "disabled" : ""}>Remove</button>
          </td>
        </tr>
      `,
    )
    .join("");
}

function syncLaborRulesFromTable() {
  laborRules = [...elements.laborRuleRows.querySelectorAll("tr")].map((row) => ({
    id: row.dataset.ruleId,
    name: row.querySelector(".rule-name").value.trim() || "Untitled rule",
    match: row.querySelector(".rule-match").value.trim(),
    paid: row.querySelector(".rule-paid").checked,
    rate: Number(row.querySelector(".rule-rate").value) || 0,
  }));
}

async function recalculateImportedData() {
  if (!importSources.length) return;
  const importResult = await parseImportTexts(importSources);
  rows = importResult.rows;
}

function renderAlerts() {
  syncCashAssumptions();

  if (!hasData()) {
    elements.alertsList.innerHTML = `
      <div class="alert">
        <strong>No operating data loaded</strong>
        <span>Upload Toast CSV files before using alerts or distribution safety.</span>
      </div>
    `;
    return;
  }

  const selected = summarizeRows(rows.filter((row) => row.date === currentDate()));
  const hasDistributionInputs =
    assumptions.bankCash !== null && assumptions.vendorDue !== null && assumptions.reserveTarget !== null;
  const cashAfterObligations = hasDistributionInputs
    ? assumptions.bankCash - upcomingPayrollDue() - assumptions.vendorDue - assumptions.reserveTarget
    : null;
  const alerts = [];

  if (selected.laborPercent > assumptions.targetLaborPercent) {
    alerts.push({
      tone: selected.laborPercent > assumptions.targetLaborPercent + 0.04 ? "danger" : "warning",
      title: "Labor is above target",
      body: `${percent(selected.laborPercent)} labor vs ${percent(assumptions.targetLaborPercent)} target.`,
    });
  }

  if (selected.primeCostPercent > assumptions.targetPrimeCostPercent) {
    alerts.push({
      tone: "warning",
      title: "Prime cost pressure",
      body: `${percent(selected.primeCostPercent)} prime cost is above the operating target.`,
    });
  }

  if (!hasDistributionInputs) {
    alerts.push({
      tone: "",
      title: "Distribution guardrail incomplete",
      body: "Enter actual bank cash, vendor obligations, and operating reserve to calculate distribution safety.",
    });
  } else if (cashAfterObligations < 0) {
    alerts.push({
      tone: "danger",
      title: "Distribution unsafe",
      body: `${money(Math.abs(cashAfterObligations))} short after payroll, vendors, and reserve.`,
    });
  } else {
    alerts.push({
      tone: "",
      title: "Distribution guardrail",
      body: `${money(cashAfterObligations)} available after upcoming obligations and reserve.`,
    });
  }

  elements.alertsList.innerHTML = alerts
    .map(
      (alert) => `
        <div class="alert ${alert.tone}">
          <strong>${alert.title}</strong>
          <span>${alert.body}</span>
        </div>
      `,
    )
    .join("");
}

function renderAll() {
  renderDateOptions();
  renderMetrics();
  renderTrendChart();
  renderShiftRows();
  renderPayroll();
  renderAlerts();
}

function parseCsvTable(text) {
  const rows = [];
  let field = "";
  let record = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      record.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      record.push(field.trim());
      if (record.some((value) => value !== "")) rows.push(record);
      field = "";
      record = [];
    } else {
      field += char;
    }
  }

  record.push(field.trim());
  if (record.some((value) => value !== "")) rows.push(record);
  return rows;
}

function recordsFromCsv(text) {
  const table = parseCsvTable(text.trim());
  const headers = table.shift()?.map((header) => header.trim().replace(/^\uFEFF/, "")) || [];

  return table.map((line) =>
    Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""])),
  );
}

function normalizeToastDate(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  if (/^\d{8}$/.test(rawValue)) {
    return `${rawValue.slice(0, 4)}-${rawValue.slice(4, 6)}-${rawValue.slice(6, 8)}`;
  }

  const slashDate = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashDate) {
    const [, month, day, yearValue] = slashDate;
    const year = yearValue.length === 2 ? `20${yearValue}` : yearValue;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftFromDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unassigned";

  const hour = parsed.getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 15) return "Lunch";
  if (hour < 17) return "Afternoon";
  return "Dinner";
}

function numberFrom(value) {
  return Number(String(value || "").replace(/[$,%]/g, "")) || 0;
}

function estimatedLaborRate(record) {
  const searchableText = [
    record["Job title"],
    record["Last Name"],
    record["First Name"],
    record["Chosen Name"],
  ]
    .join(" ")
    .toLowerCase();

  const matchedRule =
    laborRules.find((rule) =>
      String(rule.match || "")
        .split(",")
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean)
        .some((token) => token !== "*" && searchableText.includes(token)),
    ) || laborRules.find((rule) => String(rule.match || "").trim() === "*");

  if (!matchedRule || !matchedRule.paid) return 0;
  return Number(matchedRule.rate) || 0;
}

function addImportRow(map, date, shift, sales = 0, laborCost = 0, laborHours = 0) {
  if (!date || !shift) return;

  const key = `${date}::${shift}`;
  const row = map.get(key) || { date, shift, net_sales: 0, labor_cost: 0, labor_hours: 0 };
  row.net_sales += sales;
  row.labor_cost += laborCost;
  row.labor_hours += laborHours;
  map.set(key, row);
}

function parsePrimeLedgerRows(records) {
  return records
    .map((record) => ({
      date: record.date,
      shift: record.shift,
      net_sales: numberFrom(record.net_sales),
      labor_cost: numberFrom(record.labor_cost),
      labor_hours: numberFrom(record.labor_hours),
    }))
    .filter((row) => row.date && row.shift);
}

async function parseImportFiles(files) {
  const importedRows = new Map();
  const salesByDate = new Map();
  const laborByDate = new Map();
  let aggregateLabor = { hours: 0, cost: 0 };
  const importedTypes = new Set();
  const ignoredFiles = [];
  const debug = [];

  for (const file of files) {
    const records = recordsFromCsv(await file.text());
    const headers = Object.keys(records[0] || {});
    debug.push(`${file.name}: ${records.length} row(s), headers: ${headers.slice(0, 4).join(" | ") || "none"}`);

    if (headers.includes("date") && headers.includes("shift")) {
      parsePrimeLedgerRows(records).forEach((row) => {
        addImportRow(importedRows, row.date, row.shift, row.net_sales, row.labor_cost, row.labor_hours);
      });
      importedTypes.add("PrimeLedger CSV");
    } else if (headers.includes("yyyyMMdd") && headers.includes("Net sales")) {
      records.forEach((record) => {
        const date = normalizeToastDate(record.yyyyMMdd);
        const sales = numberFrom(record["Net sales"]);
        addImportRow(importedRows, date, "All day", sales);
        salesByDate.set(date, (salesByDate.get(date) || 0) + sales);
      });
      importedTypes.add("Toast sales by day");
    } else if (headers.includes("Opened") && headers.includes("Amount")) {
      records.forEach((record) => {
        addImportRow(
          importedRows,
          normalizeToastDate(record.Opened),
          shiftFromDateTime(record.Opened),
          numberFrom(record.Amount),
        );
      });
      importedTypes.add("Toast order details");
    } else if (headers.includes("Total hours") && headers.includes("Day")) {
      records.forEach((record) => {
        const date = normalizeToastDate(record.Day);
        const hours = numberFrom(record["Total hours"]);
        const cost = numberFrom(record["Total cost"]) || hours * estimatedLaborRate(record);

        if (date) {
          laborByDate.set(date, {
            hours: (laborByDate.get(date)?.hours || 0) + hours,
            cost: (laborByDate.get(date)?.cost || 0) + cost,
          });
        } else if (hours > aggregateLabor.hours) {
          aggregateLabor = { hours, cost };
        }
      });
      importedTypes.add("Toast labor by job");
    } else if (headers.includes("Order Date") && headers.includes("Total") && headers.includes("Type")) {
      ignoredFiles.push(`${file.name} is payment detail, not net sales`);
    } else if (headers.length) {
      ignoredFiles.push(file.name);
    }
  }

  salesByDate.forEach((sales, date) => {
    const hasDetailedSales = [...importedRows.values()].some((row) => row.date === date && row.net_sales > 0);
    if (!hasDetailedSales) addImportRow(importedRows, date, "All day", sales);
  });

  if (!importedRows.size && salesByDate.size) {
    salesByDate.forEach((sales, date) => addImportRow(importedRows, date, "All day", sales));
  }

  laborByDate.forEach((labor, date) => {
    const salesRows = [...importedRows.values()].filter((row) => row.date === date && row.net_sales > 0);
    if (!salesRows.length) {
      addImportRow(importedRows, date, "All day", 0, labor.cost, labor.hours);
      return;
    }

    const totalSales = salesRows.reduce((sum, row) => sum + row.net_sales, 0);
    salesRows.forEach((row) => {
      const share = totalSales ? row.net_sales / totalSales : 1 / salesRows.length;
      row.labor_cost += labor.cost * share;
      row.labor_hours += labor.hours * share;
    });
  });

  if (aggregateLabor.hours > 0 && !laborByDate.size) {
    const salesRows = [...importedRows.values()].filter((row) => row.net_sales > 0);
    const totalSales = salesRows.reduce((sum, row) => sum + row.net_sales, 0);

    salesRows.forEach((row) => {
      const share = totalSales ? row.net_sales / totalSales : 1 / salesRows.length;
      row.labor_cost += aggregateLabor.cost * share;
      row.labor_hours += aggregateLabor.hours * share;
    });
  }

  return {
    rows: [...importedRows.values()].sort((a, b) => a.date.localeCompare(b.date)),
    types: [...importedTypes],
    ignoredFiles,
    debug,
  };
}

async function parseImportTexts(files) {
  return parseImportFiles(
    files.map((file) => ({
      name: file.name,
      text: async () => file.text,
    })),
  );
}

elements.businessDate.addEventListener("change", renderAll);

elements.sidebarToggle.addEventListener("click", () => {
  setSidebar(!document.body.classList.contains("sidebar-open"));
});

elements.viewLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setView(link.dataset.viewLink);
    if (window.matchMedia("(max-width: 1080px)").matches) {
      setSidebar(false);
    }
  });
});

document.querySelectorAll(".nav-list a").forEach((link) => {
  link.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 1080px)").matches) {
      setSidebar(false);
    }
  });
});

[elements.bankCash, elements.payrollDue, elements.vendorDue, elements.reserveTarget, elements.hourlyLaborCost].forEach(
  (input) => {
    input.addEventListener("input", () => {
      syncCashAssumptions();
      saveConfig();
      renderAll();
    });
  },
);

[elements.targetLaborPercent, elements.cogsPercent, elements.targetPrimeCostPercent, elements.upcomingPayday].forEach(
  (input) => {
    input.addEventListener("input", () => {
      syncCashAssumptions();
      saveConfig();
      renderAll();
    });
  },
);

elements.addLaborRule.addEventListener("click", () => {
  laborRules.push({
    id: `rule-${Date.now()}`,
    name: "New labor rule",
    match: "",
    paid: true,
    rate: assumptions.hourlyLaborCost,
  });
  saveConfig();
  renderLaborRules();
});

elements.laborRuleRows.addEventListener("input", async () => {
  syncLaborRulesFromTable();
  saveConfig();
  await recalculateImportedData();
  renderAll();
});

elements.laborRuleRows.addEventListener("click", async (event) => {
  if (!event.target.classList.contains("rule-remove")) return;
  const row = event.target.closest("tr");
  laborRules = laborRules.filter((rule) => rule.id !== row.dataset.ruleId);
  saveConfig();
  await recalculateImportedData();
  renderAll();
});

async function handleImportSelection(event) {
  const files = [...(event.target.files || [])].filter((file) => file.name.toLowerCase().endsWith(".csv"));
  event.target.value = "";

  if (!files.length) {
    elements.importStatus.textContent = "No CSV files selected.";
    return;
  }

  elements.importStatus.textContent = `Reading ${files.length} CSV file(s)...`;

  try {
    importSources = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        text: await file.text(),
      })),
    );
    const importResult = await parseImportTexts(importSources);
    if (!importResult.rows.length) {
      const ignored = importResult.ignoredFiles.length
        ? ` Ignored: ${importResult.ignoredFiles.slice(0, 4).join("; ")}.`
        : "";
      elements.importStatus.textContent =
        `No valid rows found. Choose Sales by day, OrderDetails, Labor cost by job, or PrimeLedger CSV files.${ignored} ${importResult.debug.join(" / ")}`;
      return;
    }

    rows = importResult.rows;
    elements.businessDate.value = dailySummaries().at(-1)?.date;
    renderAll();
    const ignored = importResult.ignoredFiles.length
      ? ` Ignored ${importResult.ignoredFiles.length} non-dashboard file(s).`
      : "";
    elements.importStatus.textContent = `Imported ${importResult.rows.length} rows from ${files.length} CSV file(s): ${importResult.types.join(", ")}.${ignored}`;
  } catch (error) {
    elements.importStatus.textContent = `Import failed: ${error.message}`;
  }
}

async function loadLocalToastData() {
  const paths = [
    "ToastData/Sales by day.csv",
    "ToastData/OrderDetails_2026_05_01-2026_05_26.csv",
    "ToastData/Labor cost by job.csv",
  ];

  elements.importStatus.textContent = "Loading local ToastData files...";

  try {
    const files = await Promise.all(
      paths.map(async (path) => {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Could not load ${path}`);
        return {
          name: path.split("/").pop(),
          text: await response.text(),
        };
      }),
    );

    importSources = files;
    const importResult = await parseImportTexts(files);
    if (!importResult.rows.length) {
      elements.importStatus.textContent =
        `Local ToastData loaded, but no dashboard rows were recognized. ${importResult.debug.join(" / ")}`;
      return;
    }

    rows = importResult.rows;
    elements.businessDate.value = dailySummaries().at(-1)?.date;
    renderAll();
    elements.importStatus.textContent = `Loaded local ToastData: ${importResult.rows.length} rows from ${importResult.types.join(", ")}.`;
  } catch (error) {
    elements.importStatus.textContent =
      `Local ToastData could not be loaded from this browser. Use Choose CSV files instead. ${error.message}`;
  }
}

elements.csvInput.addEventListener("change", handleImportSelection);
elements.folderInput.addEventListener("change", handleImportSelection);
elements.loadToastData.addEventListener("click", loadLocalToastData);

loadConfig();
setInitialInputs();
setSidebar(window.matchMedia("(min-width: 1081px)").matches);
setView(location.hash?.replace("#", "") || "dashboard");
renderLaborRules();
renderAll();
