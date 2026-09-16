const fs = require("fs");
const path = require("path");
const supabase = require("../config/supabase");
const { saveBase64Media } = require("../utils/uploadHelper");

const activityStorePath = path.join(__dirname, "../data/activities.json");
const harvestStorePath = path.join(__dirname, "../data/harvest.json");

const normalizeActivity = (row) => ({
  id: String(row.id),
  cropId: String(row.crop_id ?? row.cropId ?? ""),
  kind: row.kind || "sowing",
  title: row.title || "Field activity",
  note: row.note || "",
  date: row.date || row.created_at || new Date().toISOString(),
  media: row.media || "text",
  aiEnhanced: Boolean(row.ai_enhanced ?? row.aiEnhanced),
  aiSummary: row.ai_summary || row.aiSummary || undefined,
  confidence: typeof row.confidence === "number" ? row.confidence : undefined,
  photo: row.photo || undefined,
  audio: row.audio || undefined,
});

const normalizeKind = (kind) => {
  const allowed = ["sowing", "irrigation", "fertilizer", "pest", "weeding", "flowering", "photo", "harvest"];
  return allowed.includes(kind) ? kind : "sowing";
};

const isTableMissingError = (error) => {
  const message = error?.message || "";
  return /could not find the table|does not exist|relation/i.test(message);
};

const readActivityStore = () => {
  try {
    const raw = fs.readFileSync(activityStorePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeActivityStore = (records) => {
  fs.writeFileSync(activityStorePath, JSON.stringify(records, null, 2));
};

const bumpCropScoreLocal = (cropId) => {
  try {
    if (!fs.existsSync(harvestStorePath)) return;
    const raw = fs.readFileSync(harvestStorePath, "utf8");
    const harvests = JSON.parse(raw);
    if (!Array.isArray(harvests)) return;
    const updated = harvests.map((h) => {
      if (String(h.id) === String(cropId)) {
        const current = typeof h.score === "number" ? h.score : 70;
        return { ...h, score: Math.min(99, current + 2) };
      }
      return h;
    });
    fs.writeFileSync(harvestStorePath, JSON.stringify(updated, null, 2));
  } catch (e) {
    console.error("Failed to bump local crop score:", e.message);
  }
};

const getActivities = async (req, res) => {
  try {
    if (!supabase) {
      const all = readActivityStore().map(normalizeActivity);
      const data = req.query.cropId
        ? all.filter((activity) => String(activity.cropId) === String(req.query.cropId))
        : all;
      return res.json({ success: true, data });
    }

    let query = supabase.from("activities").select("*").order("created_at", { ascending: false });

    if (req.query.cropId) {
      query = query.eq("crop_id", req.query.cropId);
    }

    const { data, error } = await query;

    if (error) {
      if (!isTableMissingError(error)) {
        return res.status(500).json({ success: false, error: error.message });
      }

      const fallback = readActivityStore()
        .map(normalizeActivity)
        .filter((activity) => (!req.query.cropId ? true : String(activity.cropId) === String(req.query.cropId)));
      return res.json({ success: true, data: fallback });
    }

    res.json({ success: true, data: (data || []).map(normalizeActivity) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getActivityById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid activity id" });
    }

    if (!supabase) {
      const fallback = readActivityStore().find((activity) => String(activity.id) === String(id));
      if (!fallback) {
        return res.status(404).json({ success: false, error: "Activity not found" });
      }
      return res.json({ success: true, data: normalizeActivity(fallback) });
    }

    const { data, error } = await supabase.from("activities").select("*").eq("id", id).single();

    if (error) {
      if (!isTableMissingError(error)) {
        return res.status(404).json({ success: false, error: error.message });
      }

      const fallback = readActivityStore().find((activity) => String(activity.id) === String(id));
      if (!fallback) {
        return res.status(404).json({ success: false, error: "Activity not found" });
      }
      return res.json({ success: true, data: normalizeActivity(fallback) });
    }

    res.json({ success: true, data: normalizeActivity(data) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const createActivity = async (req, res) => {
  try {
    const payload = {
      crop_id: req.body.crop_id ?? req.body.cropId ?? null,
      kind: normalizeKind(req.body.kind || "sowing"),
      title: req.body.title || "Field activity",
      note: req.body.note || "",
      date: req.body.date || new Date().toISOString(),
      media: req.body.media || "text",
      ai_enhanced: Boolean(req.body.aiEnhanced),
      ai_summary: req.body.aiSummary || null,
      confidence: typeof req.body.confidence === "number" ? req.body.confidence : null,
      photo: req.body.photo ? saveBase64Media(req.body.photo, "activity") : null,
      audio: req.body.audio ? saveBase64Media(req.body.audio, "audio") : null,
    };

    if (!supabase) {
      const activityRecord = {
        id: Date.now(),
        crop_id: payload.crop_id,
        kind: payload.kind,
        title: payload.title,
        note: payload.note,
        date: payload.date,
        media: payload.media,
        ai_enhanced: payload.ai_enhanced,
        ai_summary: payload.ai_summary,
        confidence: payload.confidence,
        photo: payload.photo,
        audio: payload.audio,
        created_at: new Date().toISOString(),
      };
      const nextRecords = [activityRecord, ...readActivityStore()];
      writeActivityStore(nextRecords);

      if (payload.crop_id) {
        bumpCropScoreLocal(payload.crop_id);
      }

      return res.status(201).json({ success: true, data: normalizeActivity(activityRecord) });
    }

    const { data, error } = await supabase.from("activities").insert([payload]).select("*");

    if (error) {
      if (!isTableMissingError(error)) {
        return res.status(500).json({ success: false, error: error.message });
      }

      const existing = readActivityStore();
      const activityRecord = {
        id: Date.now(),
        crop_id: payload.crop_id,
        kind: payload.kind,
        title: payload.title,
        note: payload.note,
        date: payload.date,
        media: payload.media,
        ai_enhanced: payload.ai_enhanced,
        ai_summary: payload.ai_summary,
        confidence: payload.confidence,
        photo: payload.photo,
        audio: payload.audio,
        created_at: new Date().toISOString(),
      };
      const nextRecords = [activityRecord, ...existing];
      writeActivityStore(nextRecords);

      if (payload.crop_id) {
        const cropId = Number(payload.crop_id);
        if (Number.isFinite(cropId)) {
          const { data: cropRows } = await supabase.from("harvest").select("score").eq("id", cropId);
          const currentScore = cropRows?.[0]?.score || 70;
          const nextScore = Math.min(99, currentScore + 2);
          await supabase.from("harvest").update({ score: nextScore }).eq("id", cropId);
        }
      }

      return res.status(201).json({ success: true, data: normalizeActivity(activityRecord) });
    }

    const activity = normalizeActivity(Array.isArray(data) ? data[0] : data);

    if (activity.cropId) {
      const cropId = Number(activity.cropId);
      if (Number.isFinite(cropId)) {
        const { data: cropRows } = await supabase.from("harvest").select("score").eq("id", cropId);
        const currentScore = cropRows?.[0]?.score || 70;
        const nextScore = Math.min(99, currentScore + 2);
        await supabase.from("harvest").update({ score: nextScore }).eq("id", cropId);
      }
    }

    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const buildUpdatePayload = (body) => {
  const payload = {};
  if (body.crop_id !== undefined || body.cropId !== undefined) {
    payload.crop_id = body.crop_id ?? body.cropId ?? null;
  }
  if (body.kind !== undefined) payload.kind = normalizeKind(body.kind);
  if (body.title !== undefined) payload.title = body.title;
  if (body.note !== undefined) payload.note = body.note;
  if (body.date !== undefined) payload.date = body.date;
  if (body.media !== undefined) payload.media = body.media;
  if (body.aiEnhanced !== undefined) payload.ai_enhanced = Boolean(body.aiEnhanced);
  if (body.aiSummary !== undefined) payload.ai_summary = body.aiSummary || null;
  if (body.confidence !== undefined) {
    payload.confidence = typeof body.confidence === "number" ? body.confidence : null;
  }
  if (body.photo !== undefined) {
    payload.photo = body.photo ? saveBase64Media(body.photo, "activity") : null;
  }
  if (body.audio !== undefined) {
    payload.audio = body.audio ? saveBase64Media(body.audio, "audio") : null;
  }
  return payload;
};

const updateActivity = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid activity id" });
    }

    const payload = buildUpdatePayload(req.body || {});

    if (!supabase) {
      const existing = readActivityStore();
      const target = existing.find((a) => String(a.id) === String(id));
      if (!target) {
        return res.status(404).json({ success: false, error: `Activity #${id} not found` });
      }
      const nextRecords = existing.map((a) =>
        String(a.id) === String(id) ? { ...a, ...payload, id: a.id } : a
      );
      writeActivityStore(nextRecords);
      return res.json({ success: true, data: [normalizeActivity({ ...target, ...payload })] });
    }

    const { data, error } = await supabase.from("activities").update(payload).eq("id", id).select("*");

    if (error) {
      if (!isTableMissingError(error)) {
        return res.status(500).json({ success: false, error: error.message });
      }

      const existing = readActivityStore();
      const target = existing.find((a) => String(a.id) === String(id));
      if (!target) {
        return res.status(404).json({ success: false, error: `Activity #${id} not found` });
      }
      const nextRecords = existing.map((a) =>
        String(a.id) === String(id) ? { ...a, ...payload, id: a.id } : a
      );
      writeActivityStore(nextRecords);
      return res.json({ success: true, data: [normalizeActivity({ ...target, ...payload })] });
    }

    res.json({ success: true, data: (data || []).map(normalizeActivity) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteActivity = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: "Invalid activity id" });
    }

    if (!supabase) {
      const existing = readActivityStore();
      writeActivityStore(existing.filter((a) => String(a.id) !== String(id)));
      return res.json({ success: true, message: "Activity deleted" });
    }

    const { error } = await supabase.from("activities").delete().eq("id", id);

    if (error) {
      const existing = readActivityStore();
      writeActivityStore(existing.filter((a) => String(a.id) !== String(id)));
      return res.json({ success: true, message: "Activity deleted" });
    }

    res.json({ success: true, message: "Activity deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
};
