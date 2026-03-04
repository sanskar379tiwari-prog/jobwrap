const { createRoadmapCompletion } = require("./aiClient");
const { normalizeRoadmap } = require("../schemas/roadmapSchema");

// ─── JSON repair utilities ────────────────────────────────────────────────────
function extractFirstJsonObject(text) {
  if (typeof text !== "string") return null;
  const noFences = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = noFences.indexOf("{");
  const end = noFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return noFences.slice(start, end + 1);
}

function fixTrailingCommas(jsonStr) {
  if (typeof jsonStr !== "string") return jsonStr;
  return jsonStr.replace(/,(\s*[}\]])/g, "$1");
}

function repairTruncatedJson(jsonStr) {
  if (typeof jsonStr !== "string") return jsonStr;
  let s = jsonStr.trim();
  if (!s) return s;
  const openB = (s.match(/\{/g) || []).length;
  const closeB = (s.match(/\}/g) || []).length;
  const openA = (s.match(/\[/g) || []).length;
  const closeA = (s.match(/\]/g) || []).length;
  const last = s.slice(-1);
  if (last !== '"' && last !== '}' && last !== ']') s += '"';
  s += ']'.repeat(Math.max(0, openA - closeA));
  s += '}'.repeat(Math.max(0, openB - closeB));
  return s;
}

function tryParseRoadmapJson(rawText) {
  const attempts = [
    () => rawText,
    () => fixTrailingCommas(rawText),
    () => extractFirstJsonObject(rawText),
    () => fixTrailingCommas(extractFirstJsonObject(rawText) || ""),
    () => repairTruncatedJson(rawText),
    () => repairTruncatedJson(fixTrailingCommas(extractFirstJsonObject(rawText) || rawText)),
  ];
  for (const attempt of attempts) {
    const candidate = attempt();
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch (_) { /* try next */ }
  }
  console.error("[parse_failed] AI output could not be parsed. First 400 chars:", rawText.slice(0, 400));
  return null;
}

// ─── Input analysis ───────────────────────────────────────────────────────────
function isVagueRole(role) {
  const r = role.toLowerCase().trim();
  const vague = new Set(["software engineer", "software developer", "developer",
    "programmer", "engineer", "it", "it professional", "sde", "swe"]);
  if (vague.has(r)) return true;
  if (r.length <= 4) return true;
  return false;
}

function isUnrealisticTimeline(hoursPerDay, targetTimelineMonths) {
  if (!Number.isFinite(hoursPerDay) || !Number.isFinite(targetTimelineMonths)) return false;
  return hoursPerDay <= 1 && targetTimelineMonths <= 3;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(input) {
  const { role, currentLevel, hoursPerDay, targetTimelineMonths } = input;
  const vague = isVagueRole(role);
  const unrealistic = isUnrealisticTimeline(hoursPerDay, targetTimelineMonths);

  const userContext = {
    role,
    currentLevel: currentLevel || "not provided",
    hoursPerDay: Number.isFinite(hoursPerDay) ? hoursPerDay : "not provided",
    targetTimelineMonths: Number.isFinite(targetTimelineMonths) ? targetTimelineMonths : "not provided",
    assumptionNote: vague ? `Treated "${role}" as a backend-focused role. State this clearly.` : "none",
    timelineFlag: unrealistic ? "unrealistic" : "not flagged",
  };

  const system = `You are a senior Indian tech hiring manager with 15+ years of experience. You produce brutally honest, no-fluff career roadmaps. India job market focus, real salary numbers, no paid course spam, no motivational filler. Force trade-offs. Call out gatekeeping. Be opinionated and specific.

CRITICAL INSTRUCTION: Output ONLY a single valid JSON object. No markdown, no code fences, no prose, no extra keys. Follow the EXACT schema below.

═══════════════════════════════════════════
REQUIRED JSON SCHEMA — COPY THIS STRUCTURE EXACTLY
═══════════════════════════════════════════

{
  "roleReality": {
    "jobTitle": "Exact job title as seen in Indian job postings",
    "demandTag": "high-demand",
    "dailyReality": "3-4 sentences describing the actual daily work grind, pressure points, and realities. Be specific, not generic.",
    "hardTruth": "1-2 sentences about the single biggest gatekeeping factor or barrier in India. Be blunt."
  },
  "skills": [
    {
      "name": "Skill Name Only — no bullets, no extra text",
      "priority": "must-have",
      "duration": "X–Y months",
      "resource": "Best free resource name"
    },
    {
      "name": "Second Skill Name",
      "priority": "important",
      "duration": "X months",
      "resource": "Resource name"
    }
  ],
  "studyPlan": [
    {
      "phase": "Phase 1",
      "title": "Short Phase Title",
      "subtitle": "Topic area e.g. Python & Core Math",
      "steps": [
        "→ What to learn and how",
        "→ What to build or practice",
        "→ Specific exit condition"
      ],
      "milestone": "Concrete thing the learner can do when this phase is complete"
    },
    {
      "phase": "Phase 2",
      "title": "Another Phase Title",
      "subtitle": "Topic area",
      "steps": ["→ Step", "→ Step"],
      "milestone": "Milestone description"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "priority": "high",
      "description": "What it solves, why recruiters care, what makes it impressive vs average.",
      "stack": ["Tech1", "Tech2", "Tech3"]
    }
  ],
  "traps": [
    {
      "title": "The Trap Name",
      "why": "Why beginners fall for it and how it hurts them specifically in the Indian job market.",
      "instead": "Specific actionable alternative."
    }
  ],
  "topCompanies": [
    {
      "name": "Specific Company Name (e.g. TCS, Zomato, Google)",
      "type": "Product/Service/Startup",
      "salaryRange": "₹X–Y LPA",
      "note": "What they look for / who they hire."
    }
  ],
  "finalRealityCheck": "2-3 sentences. Honest closing — what separates those who make it from those who don't. No pep talk.",
  "confidenceLevel": "high"
}

═══════════════════════════════════════════
STRICT RULES — VIOLATIONS WILL BREAK THE PARSER
═══════════════════════════════════════════

1. skills[].name — SHORT skill name ONLY. Do NOT include descriptions, bullets, or explanations.
   WRONG: "Python • Python is the most used language • Deep • Common mistake is..."
   RIGHT: "Python"

2. topCompanies[].name — MUST be a REAL, SPECIFIC company name.
   WRONG: "Company Name", "N DEFAULT", "Product Company", "Top Startup".
   RIGHT: "Atlassian", "PhonePe", "Infosys", "Zoho", "Nvidia".
   Provide 5 REAL companies that actively hire for this role in India.

3. studyPlan — MUST be an ARRAY of phase objects, each with phase/title/subtitle/steps/milestone keys.
   Do NOT return a plain string for studyPlan. Do NOT return "Output quality limited...".
   ALWAYS return 3–4 phase objects even for vague inputs.

4. projects — each item MUST be an object with name/priority/description/stack keys.
   Do NOT use keys like "Problem it solves" or "Why recruiters care".
   Do NOT return projects as plain strings.

5. traps — each item MUST be an object with title/why/instead keys.
   Do NOT return traps as plain strings.

6. skills[].priority — MUST be exactly one of: "must-have", "important", "nice-to-have"
7. projects[].priority — MUST be exactly one of: "high", "medium", "low"
8. Return 5–7 skills, 3–4 study phases, exactly 3 projects, 4–5 traps, and exactly 5 topCompanies.`;

  const user = `User inputs:\n${JSON.stringify(userContext, null, 2)}\n\nGenerate roadmap JSON only. Follow the schema EXACTLY. No prose outside the JSON.`;

  return { system, user };
}

// ─── Service entry point ──────────────────────────────────────────────────────
async function generateRoadmap(input) {
  const { system, user } = buildPrompt(input);
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const rawText = await createRoadmapCompletion(messages);

  console.log("\n[ai_raw_output_start]\n");
  console.log(rawText);
  console.log("\n[ai_raw_output_end]\n");

  const parsed = tryParseRoadmapJson(rawText);
  if (parsed === null) {
    const err = new Error("AI returned invalid JSON.");
    err.statusCode = 502;
    err.publicMessage = "AI service returned invalid output. Please try again.";
    throw err;
  }

  return normalizeRoadmap(parsed);
}

module.exports = { generateRoadmap };
