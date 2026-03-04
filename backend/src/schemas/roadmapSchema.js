// ─── Constants ────────────────────────────────────────────────────────────────
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const PRIORITY_SKILL = new Set(["must-have", "important", "nice-to-have"]);
const PRIORITY_PROJECT = new Set(["high", "medium", "low"]);

const WEAK_FALLBACK = "Output quality limited due to vague input.";
const MIN_TEXT_LEN = 20;
const MAX_SKILLS = 8;
const MAX_PHASES = 5;
const MAX_PROJECTS = 3;
const MAX_TRAPS = 6;

const FLUFF = [
  /^good luck\.?$/i, /^you can do it\.?$/i, /^all the best\.?$/i,
  /^hope this helps\.?$/i, /^best of luck\.?$/i,
];

// ─── Primitives ───────────────────────────────────────────────────────────────
function str(v, fallback = "") {
  return (typeof v === "string" && v.trim()) ? v.trim() : fallback;
}

function cleanLine(line) {
  const s = String(line ?? "").trim();
  return (s && !FLUFF.some((r) => r.test(s))) ? s : "";
}

function toText(value, fallback) {
  const raw = str(value, "");
  if (!raw) return fallback;
  const cleaned = raw.split(/\r?\n/).map(cleanLine).filter(Boolean).join("\n").trim();
  return cleaned.length >= MIN_TEXT_LEN ? cleaned : fallback;
}

function flatItem(item) {
  if (typeof item === "string") return item.trim();
  if (Array.isArray(item)) return item.map((x) => String(x ?? "").trim()).filter(Boolean).join(" • ");
  if (item && typeof item === "object") { try { return JSON.stringify(item); } catch { return String(item); } }
  return String(item ?? "");
}

// ─── Skill normalizer ─────────────────────────────────────────────────────────
/**
 * Handles three formats from the AI:
 * 1. Ideal: { name, priority, duration, resource }
 * 2. Bullet string: "Python • Description • Deep • Common mistake"
 * 3. Plain string: "Python"
 */
function parseSkillItem(item) {
  // Format 1: proper object
  if (item && typeof item === "object" && !Array.isArray(item)) {
    let name = str(item.name, "");
    // name must not be a bullet-joined blob — strip anything after the first bullet
    if (name.includes("•")) name = name.split("•")[0].trim();
    if (!name) return null;
    return {
      name,
      priority: PRIORITY_SKILL.has(str(item.priority)) ? str(item.priority) : "important",
      duration: str(item.duration, ""),
      resource: str(item.resource, ""),
    };
  }

  // Format 2 & 3: string (possibly bullet-joined)
  const raw = flatItem(item);
  if (!raw) return null;

  if (raw.includes("•")) {
    const parts = raw.split("•").map((p) => p.trim()).filter(Boolean);
    // parts[0] = skill name, parts[1] = description (ignore), parts[2] = depth (ignore), parts[3] = mistake (ignore)
    return {
      name: parts[0] || raw,
      priority: "important",
      duration: "",
      resource: "",
    };
  }

  return { name: raw, priority: "important", duration: "", resource: "" };
}

function normalizeSkills(skills, legacyCoreSkills) {
  const source = (Array.isArray(skills) && skills.length) ? skills : (legacyCoreSkills || []);
  if (!Array.isArray(source)) return [];
  return source
    .map(parseSkillItem)
    .filter(Boolean)
    .slice(0, MAX_SKILLS);
}

// ─── Study plan normalizer ────────────────────────────────────────────────────
/**
 * Handles:
 * 1. Ideal: array of { phase, title, subtitle, steps[], milestone }
 * 2. AI returns a string (incl. WEAK_FALLBACK) — try to extract phases from it
 * 3. Array of plain strings
 */
function parsePhase(item, i) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const steps = Array.isArray(item.steps)
      ? item.steps.map((s) => String(s ?? "").trim()).filter(Boolean)
      : str(item.steps, "").split(/\n/).map(cleanLine).filter(Boolean);
    return {
      phase: str(item.phase, `Phase ${i + 1}`),
      title: str(item.title, `Part ${i + 1}`),
      subtitle: str(item.subtitle, ""),
      steps,
      milestone: str(item.milestone, ""),
    };
  }
  if (typeof item === "string") {
    return { phase: `Phase ${i + 1}`, title: item.trim(), subtitle: "", steps: [], milestone: "" };
  }
  return null;
}

function parseStudyPlanString(text) {
  // Try to detect "Phase N" headings and split on them
  const phaseRegex = /phase\s*\d+[:\-–]?\s*/gi;
  const parts = text.split(phaseRegex).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((p, i) => {
      const lines = p.split(/\n/).map(cleanLine).filter(Boolean);
      return { phase: `Phase ${i + 1}`, title: lines[0] || `Phase ${i + 1}`, subtitle: "", steps: lines.slice(1), milestone: "" };
    });
  }
  // Fallback: single block
  const lines = text.split(/\n/).map(cleanLine).filter(Boolean);
  return [{ phase: "Phase 1", title: "Learning Plan", subtitle: "", steps: lines, milestone: "" }];
}

function normalizeStudyPlan(studyPlan) {
  if (Array.isArray(studyPlan) && studyPlan.length) {
    const phases = studyPlan
      .map((item, i) => parsePhase(item, i))
      .filter(Boolean)
      .slice(0, MAX_PHASES);
    if (phases.length) return phases;
  }
  if (typeof studyPlan === "string") {
    const text = studyPlan.trim();
    if (!text || text === WEAK_FALLBACK || text.length < MIN_TEXT_LEN) return [];
    return parseStudyPlanString(text);
  }
  return [];
}

// ─── Project normalizer ───────────────────────────────────────────────────────
/**
 * Handles:
 * 1. Ideal: { name, priority, description, stack[] }
 * 2. Wrong keys: { "Problem it solves": "...", "Why recruiters care": "...", "What makes it impressive": "..." }
 * 3. JSON string containing the above
 * 4. Plain string
 */
function parseProject(item) {
  // Format 3: JSON-stringified object
  if (typeof item === "string") {
    const s = item.trim();
    if (s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        return parseProject(parsed); // recurse as object
      } catch { /* fall through to plain string */ }
    }
    return s ? { name: s.split(/[.,\n]/)[0].trim() || "Project", priority: "medium", description: s, stack: [] } : null;
  }

  if (!item || typeof item !== "object") return null;

  // Format 2: wrong keys from AI
  const problemKey = Object.keys(item).find((k) => k.toLowerCase().includes("problem") || k.toLowerCase().includes("solves"));
  const recruiterKey = Object.keys(item).find((k) => k.toLowerCase().includes("recruiter") || k.toLowerCase().includes("care"));
  const impressKey = Object.keys(item).find((k) => k.toLowerCase().includes("impressive") || k.toLowerCase().includes("makes"));

  if (problemKey || recruiterKey || impressKey) {
    const problem = str(item[problemKey], "");
    const recruiter = str(item[recruiterKey], "");
    const impress = str(item[impressKey], "");
    const desc = [problem, recruiter, impress].filter(Boolean).join(" ");
    // Try to extract a short name from the problem statement
    const firstSentence = problem.split(/[.!?]/)[0].trim();
    return {
      name: firstSentence.length < 60 ? firstSentence : "Project",
      priority: PRIORITY_PROJECT.has(str(item.priority)) ? str(item.priority) : "medium",
      description: desc,
      stack: Array.isArray(item.stack) ? item.stack.map((s) => String(s)).filter(Boolean) : [],
    };
  }

  // Format 1: ideal object
  const name = str(item.name, "Project");
  return {
    name,
    priority: PRIORITY_PROJECT.has(str(item.priority)) ? str(item.priority) : "medium",
    description: str(item.description, ""),
    stack: Array.isArray(item.stack) ? item.stack.map((s) => String(s)).filter(Boolean) : [],
  };
}

function normalizeProjects(projects) {
  if (!Array.isArray(projects)) return [];
  return projects.map(parseProject).filter(Boolean).slice(0, MAX_PROJECTS);
}

// ─── Trap normalizer ──────────────────────────────────────────────────────────
/**
 * Handles:
 * 1. Ideal: { title, why, instead }
 * 2. Plain string — use as title, split on common separators for why/instead
 */
function parseTrap(item) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return {
      title: str(item.title, "Common Trap"),
      why: str(item.why, ""),
      instead: str(item.instead, ""),
    };
  }
  const raw = typeof item === "string" ? item.trim() : flatItem(item);
  if (!raw) return null;

  // Try to split on "instead:" marker
  const insteadMatch = raw.match(/instead[:\-–]\s*(.+)/i);
  const instead = insteadMatch ? insteadMatch[1].trim() : "";
  const body = insteadMatch ? raw.slice(0, insteadMatch.index).trim() : raw;

  return { title: body.split(/[.!]/)[0].trim() || raw, why: body, instead };
}

function normalizeTraps(traps, legacyTraps) {
  const source = (Array.isArray(traps) && traps.length) ? traps : (legacyTraps || []);
  if (typeof source === "string") {
    return source.split(/\n/).map(cleanLine).filter(Boolean)
      .map((s) => ({ title: s.split(/[.!]/)[0].trim() || s, why: s, instead: "" }))
      .slice(0, MAX_TRAPS);
  }
  if (!Array.isArray(source)) return [];
  return source.map(parseTrap).filter(Boolean).slice(0, MAX_TRAPS);
}

// ─── Top Companies normalizer ───────────────────────────────────────────────
function normalizeTopCompanies(companies) {
  if (!Array.isArray(companies)) return [];
  return companies.map((c) => {
    if (!c || typeof c !== "object") return null;

    // AI sometimes uses different keys
    const nameStr = str(c.name || c.company || c.org || c.employer, "");

    // Strip obvious placeholders
    if (!nameStr || nameStr.toLowerCase().includes("default") || nameStr.toLowerCase().includes("specific company")) {
      return null;
    }

    return {
      name: nameStr,
      type: str(c.type || c.category, ""),
      salaryRange: str(c.salaryRange || c.salary, ""),
      note: str(c.note || c.description || c.hiringNote, ""),
    };
  }).filter(Boolean).slice(0, 5);
}

// ─── Role reality normalizer ──────────────────────────────────────────────────
function normalizeRoleReality(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      jobTitle: str(value.jobTitle, ""),
      demandTag: str(value.demandTag, ""),
      dailyReality: str(value.dailyReality, WEAK_FALLBACK),
      hardTruth: str(value.hardTruth, ""),
    };
  }
  const text = toText(value, WEAK_FALLBACK);
  return { jobTitle: "", demandTag: "", dailyReality: text, hardTruth: "" };
}

// ─── Root normalizer ──────────────────────────────────────────────────────────
function normalizeRoadmap(raw) {
  if (!raw || typeof raw !== "object") {
    const err = new Error("AI response was not a JSON object.");
    err.statusCode = 502;
    err.publicMessage = "AI service returned invalid output. Please try again.";
    throw err;
  }

  return {
    roleReality: normalizeRoleReality(raw.roleReality),
    skills: normalizeSkills(raw.skills, raw.coreSkills),
    studyPlan: normalizeStudyPlan(raw.studyPlan),
    projects: normalizeProjects(raw.projects),
    traps: normalizeTraps(raw.traps, raw.commonLiesTraps),
    topCompanies: normalizeTopCompanies(raw.topCompanies),
    finalRealityCheck: toText(raw.finalRealityCheck, ""),
    confidenceLevel: CONFIDENCE_LEVELS.has(str(raw.confidenceLevel).toLowerCase())
      ? str(raw.confidenceLevel).toLowerCase()
      : "medium",
  };
}

module.exports = { normalizeRoadmap };
