const API_BASE = "";

// ─── Utilities ────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function slugClass(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
}

// ── Section label ─────────────────────────────────────────────────────────────
function sectionLabel(text) {
  return el("div", "section-label", `// ${text}`);
}

// ─── Data normalizer ──────────────────────────────────────────────────────────
function normalizeRoadmapForUI(data) {
  const d = data && typeof data === "object" ? data : {};

  let roleReality = d.roleReality;
  if (!roleReality || typeof roleReality === "string") {
    roleReality = { jobTitle: "", demandTag: "", dailyReality: typeof d.roleReality === "string" ? d.roleReality : "", hardTruth: "" };
  }

  let skills = Array.isArray(d.skills) ? d.skills : [];
  if (!skills.length && Array.isArray(d.coreSkills)) {
    skills = d.coreSkills.map((s) => ({ name: String(s), priority: "important", duration: "", resource: "" }));
  }

  let studyPlan = Array.isArray(d.studyPlan) ? d.studyPlan : [];
  if (!studyPlan.length && typeof d.studyPlan === "string" && d.studyPlan.trim()) {
    studyPlan = [{ phase: "Plan", title: "Learning Plan", subtitle: "", steps: d.studyPlan.split(/\n/).filter(Boolean), milestone: "" }];
  }

  let projects = Array.isArray(d.projects) ? d.projects : [];
  if (projects.length && typeof projects[0] === "string") {
    projects = projects.map((s) => ({ name: s, priority: "medium", description: "", stack: [] }));
  }

  let traps = Array.isArray(d.traps) ? d.traps : [];
  if (traps.length && typeof traps[0] === "string") {
    traps = traps.map((s) => ({ title: s, why: "", instead: "" }));
  }

  let topCompanies = Array.isArray(d.topCompanies) ? d.topCompanies : [];
  if (topCompanies.length && typeof topCompanies[0] === "string") {
    topCompanies = topCompanies.map((s) => ({ name: s, type: "", salaryRange: "", note: "" }));
  }

  return {
    roleReality,
    skills,
    studyPlan,
    projects,
    traps,
    topCompanies,
    finalRealityCheck: typeof d.finalRealityCheck === "string" ? d.finalRealityCheck : "",
    confidenceLevel: typeof d.confidenceLevel === "string" ? d.confidenceLevel : "medium",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** // role reality */
function renderRoleReality(outputEl, rr) {
  outputEl.appendChild(sectionLabel("role reality"));
  const panel = el("div", "panel");

  if (rr.jobTitle) panel.appendChild(el("h2", "role-title", rr.jobTitle));

  if (rr.demandTag) {
    const tag = el("span", `demand-tag ${slugClass(rr.demandTag)}`, rr.demandTag);
    panel.appendChild(tag);
  }

  if (rr.dailyReality) panel.appendChild(el("p", "role-daily-reality", rr.dailyReality));

  if (rr.hardTruth) {
    const block = el("div", "hard-truth-block");
    block.appendChild(el("div", "hard-truth-label", "hard truth"));
    block.appendChild(el("p", "hard-truth-text", rr.hardTruth));
    panel.appendChild(block);
  }

  outputEl.appendChild(panel);
}

/** // skills required
    Layout: number | name | [pill] · duration · resource  */
function renderSkills(outputEl, skills) {
  if (!skills.length) return;
  outputEl.appendChild(sectionLabel("skills required"));

  const panel = el("div", "panel");
  const list = el("div", "skills-list");

  skills.forEach((skill, i) => {
    const row = el("div", "skill-row");

    // Column 1: number
    row.appendChild(el("span", "skill-num", String(i + 1).padStart(2, "0")));

    // Column 2: name + inline pill + duration + resource
    const body = el("div", "skill-body");
    body.appendChild(el("span", "skill-name", skill.name));

    const inline = el("div", "skill-inline");

    const pill = el("span", `priority-pill ${skill.priority || "important"}`, skill.priority || "important");
    inline.appendChild(pill);

    if (skill.duration) {
      inline.appendChild(el("span", "skill-duration", `${skill.duration}`));
    }
    if (skill.resource) {
      const dot = el("span", "skill-duration", " · ");
      inline.appendChild(dot);
      inline.appendChild(el("span", "skill-resource", skill.resource));
    }

    body.appendChild(inline);
    row.appendChild(body);
    list.appendChild(row);
  });

  panel.appendChild(list);
  outputEl.appendChild(panel);
}

/** // learning plan
    Phase tag | Title   Subtitle (right)
    → step
    ✓ milestone */
function renderStudyPlan(outputEl, phases) {
  if (!phases.length) return;
  outputEl.appendChild(sectionLabel("learning plan"));

  const panel = el("div", "panel");
  const list = el("div", "phases-list");

  phases.forEach((phase) => {
    const block = el("div", "phase-block");
    const header = el("div", "phase-header");

    if (phase.phase) {
      let tagText = phase.phase.toUpperCase();
      if (phase.title) tagText += ":  " + phase.title.toUpperCase();
      header.appendChild(el("span", "phase-tag", tagText));
    }
    if (phase.subtitle) {
      header.appendChild(el("span", "phase-subtitle", phase.subtitle));
    }
    block.appendChild(header);

    if (phase.steps && phase.steps.length) {
      const ul = el("ul", "phase-steps");
      phase.steps.forEach((step) => {
        const li = el("li", "phase-step");
        // strip leading → if the step already has it (AI sometimes adds it)
        li.textContent = step.replace(/^→\s*/, "").trim();
        ul.appendChild(li);
      });
      block.appendChild(ul);
    }

    if (phase.milestone) {
      const ms = el("div", "phase-milestone");
      ms.appendChild(el("span", "milestone-check", "✓"));
      ms.appendChild(el("span", "", ` milestone: ${phase.milestone}`));
      block.appendChild(ms);
    }

    list.appendChild(block);
  });

  panel.appendChild(list);
  outputEl.appendChild(panel);
}

/** // portfolio projects
    Project Name            [HIGH]
    description text
    stack: Tech1, Tech2     */
function renderProjects(outputEl, projects) {
  if (!projects.length) return;
  outputEl.appendChild(sectionLabel("portfolio projects"));

  const panel = el("div", "panel");
  const list = el("div", "projects-list");

  projects.forEach((proj) => {
    const card = el("div", "project-card");
    const header = el("div", "project-header");

    header.appendChild(el("span", "project-name", proj.name));
    if (proj.priority) {
      header.appendChild(el("span", `project-priority ${proj.priority}`, proj.priority.toUpperCase()));
    }
    card.appendChild(header);

    if (proj.description) card.appendChild(el("p", "project-desc", proj.description));

    if (proj.stack && proj.stack.length) {
      const row = el("div", "project-stack-row");
      const label = el("span", "stack-label", "stack: ");
      const chips = el("span", "stack-chips");
      proj.stack.forEach((s, si) => {
        const chip = el("span", "stack-chip", s);
        chips.appendChild(chip);
      });
      row.appendChild(label);
      row.appendChild(chips);
      card.appendChild(row);
    }

    list.appendChild(card);
  });

  panel.appendChild(list);
  outputEl.appendChild(panel);
}

/** // common traps
    ▏ ⚠ Trap Title in mono accent
      Body text
      → instead: alternative   */
function renderTraps(outputEl, traps) {
  if (!traps.length) return;
  outputEl.appendChild(sectionLabel("common traps"));

  const panel = el("div", "panel");
  const list = el("div", "traps-list");

  traps.forEach((trap) => {
    const block = el("div", "trap-block");

    const title = el("div", "trap-title");
    const icon = el("span", "trap-icon");
    icon.textContent = "⚠";
    title.appendChild(icon);
    title.appendChild(document.createTextNode(" " + trap.title));
    block.appendChild(title);

    if (trap.why) block.appendChild(el("p", "trap-why", trap.why));

    if (trap.instead) {
      const row = el("div", "trap-instead");
      row.appendChild(el("span", "trap-instead-label", "→ instead:"));
      row.appendChild(el("span", "trap-instead-text", " " + trap.instead));
      block.appendChild(row);
    }

    list.appendChild(block);
  });

  panel.appendChild(list);
  outputEl.appendChild(panel);
}

/** // top 5 companies */
function renderTopCompanies(outputEl, companies) {
  if (!companies || !companies.length) return;
  outputEl.appendChild(sectionLabel("top companies hiring"));

  const panel = el("div", "panel");
  const list = el("div", "companies-list");

  companies.forEach((comp, i) => {
    const card = el("div", "company-card");
    const header = el("div", "company-header");

    const left = el("div", "company-left");
    left.appendChild(el("span", "company-rank", String(i + 1).padStart(2, "0")));
    left.appendChild(el("span", "company-name", comp.name));
    header.appendChild(left);

    if (comp.salaryRange) {
      header.appendChild(el("span", "company-salary", comp.salaryRange));
    }
    card.appendChild(header);

    if (comp.type) {
      const typeBadge = el("span", "company-type", comp.type);
      card.appendChild(typeBadge);
    }

    if (comp.note) {
      card.appendChild(el("p", "company-note", comp.note));
    }

    list.appendChild(card);
  });

  panel.appendChild(list);
  outputEl.appendChild(panel);
}

/** // final words */
function renderFinalWords(outputEl, text) {
  if (!text) return;
  outputEl.appendChild(sectionLabel("final words"));
  const panel = el("div", "panel");
  panel.appendChild(el("p", "final-quote", text));
  outputEl.appendChild(panel);
}

function renderFooter(outputEl) {
  const footer = el("p", "footer-note");
  footer.innerHTML = `powered by ai<span class="footer-dot">·</span>not financial advice<span class="footer-dot">·</span>salaries vary wildly`;
  outputEl.appendChild(footer);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FORM SUBMIT
// ═══════════════════════════════════════════════════════════════════════════════
async function onSubmit(e) {
  e.preventDefault();
  const statusEl = $("status");
  const errorEl = $("error");
  const outputEl = $("output");
  const submitBtn = $("submit");

  errorEl.textContent = ""; statusEl.textContent = "";
  clearNode(outputEl);

  const role = $("role").value.trim();
  if (!role) { errorEl.textContent = "Role is required."; return; }

  const payload = {
    role,
    currentLevel: $("currentLevel").value || "",
    hoursPerDay: $("hoursPerDay").value || "",
    targetTimelineMonths: $("targetTimelineMonths").value || "",
  };

  submitBtn.disabled = true;
  statusEl.textContent = "Generating roadmap…";

  try {
    const res = await fetch(`${API_BASE}/api/roadmap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message || "Something went wrong. Please try again.");

    const roadmap = normalizeRoadmapForUI(data?.roadmap);

    const disclaimer = el("p", "disclaimer", "⚡ Opinionated roadmap based on real hiring patterns — not a guarantee.");
    outputEl.appendChild(disclaimer);
    outputEl.appendChild(el("p", "meta", `output confidence: ${roadmap.confidenceLevel}`));

    renderRoleReality(outputEl, roadmap.roleReality);
    renderSkills(outputEl, roadmap.skills);
    renderStudyPlan(outputEl, roadmap.studyPlan);
    renderProjects(outputEl, roadmap.projects);
    renderTraps(outputEl, roadmap.traps);
    renderTopCompanies(outputEl, roadmap.topCompanies);
    renderFinalWords(outputEl, roadmap.finalRealityCheck);
    renderFooter(outputEl);

    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = "";
    errorEl.textContent = err?.message || "Something went wrong. Please try again.";
  } finally {
    submitBtn.disabled = false;
  }
}

// ─── Optional fields toggle ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  $("roadmap-form").addEventListener("submit", onSubmit);

  const toggle = $("optional-toggle");
  const fields = $("optional-fields");
  if (toggle && fields) {
    toggle.addEventListener("click", () => {
      const open = fields.classList.toggle("visible");
      toggle.classList.toggle("open", open);
      toggle.querySelector("span").textContent = open ? "− hide optional inputs" : "+ optional inputs";
    });
  }
});
