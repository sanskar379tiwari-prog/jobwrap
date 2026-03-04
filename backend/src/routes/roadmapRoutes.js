const express = require("express");
const { generateRoadmap } = require("../services/roadmapService");

const roadmapRouter = express.Router();

roadmapRouter.post("/", async (req, res, next) => {
  try {
    const role = typeof req.body?.role === "string" ? req.body.role.trim() : "";
    if (!role) {
      const err = new Error("Role is required.");
      err.statusCode = 400;
      err.publicMessage = "Role is required.";
      throw err;
    }

    const currentLevel =
      typeof req.body?.currentLevel === "string"
        ? req.body.currentLevel.trim()
        : "";

    const hoursPerDayRaw = req.body?.hoursPerDay;
    const targetTimelineMonthsRaw = req.body?.targetTimelineMonths;

    const hoursPerDay =
      hoursPerDayRaw === undefined || hoursPerDayRaw === null || hoursPerDayRaw === ""
        ? null
        : Number(hoursPerDayRaw);
    const targetTimelineMonths =
      targetTimelineMonthsRaw === undefined ||
      targetTimelineMonthsRaw === null ||
      targetTimelineMonthsRaw === ""
        ? null
        : Number(targetTimelineMonthsRaw);

    const input = {
      role,
      currentLevel: currentLevel || null,
      hoursPerDay: Number.isFinite(hoursPerDay) ? hoursPerDay : null,
      targetTimelineMonths: Number.isFinite(targetTimelineMonths)
        ? targetTimelineMonths
        : null,
    };

    const roadmap = await generateRoadmap(input);
    res.json({ roadmap });
  } catch (err) {
    next(err);
  }
});

module.exports = { roadmapRouter };

