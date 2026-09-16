const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "../uploads");

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Saves a base64 data URL or raw base64 string to the local uploads directory.
 * If the value is already an HTTP URL or local /uploads/ path, it is left untouched.
 *
 * @param {string} dataString - Base64 data URL (e.g. data:image/jpeg;base64,...)
 * @param {string} prefix - Filename prefix (e.g. 'crop', 'activity', 'audio')
 * @returns {string|null} The relative URL path (e.g. '/uploads/crop-171000-abc.jpg') or original value
 */
function saveBase64Media(dataString, prefix = "file") {
  if (!dataString || typeof dataString !== "string") {
    return dataString || null;
  }

  const trimmed = dataString.trim();

  // Already a URL or served upload path
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/uploads/")
  ) {
    return trimmed;
  }

  // Match data:mime;base64,content
  const matches = trimmed.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let ext = "jpg";
  let base64Data = trimmed;

  if (matches && matches.length === 3) {
    const mimeType = matches[1].toLowerCase();
    base64Data = matches[2];

    if (mimeType.includes("png")) ext = "png";
    else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
    else if (mimeType.includes("webp")) ext = "webp";
    else if (mimeType.includes("gif")) ext = "gif";
    else if (mimeType.includes("svg")) ext = "svg";
    else if (mimeType.includes("audio/webm") || mimeType.includes("webm")) ext = "webm";
    else if (mimeType.includes("audio/mp4") || mimeType.includes("m4a")) ext = "m4a";
    else if (mimeType.includes("audio/mpeg") || mimeType.includes("mp3")) ext = "mp3";
    else if (mimeType.includes("audio/ogg") || mimeType.includes("ogg")) ext = "ogg";
    else if (mimeType.includes("audio/wav") || mimeType.includes("wav")) ext = "wav";
  } else {
    // If it doesn't match standard data URL and doesn't look like base64, return as is
    if (!/^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 100))) {
      return dataString;
    }
  }

  try {
    const buffer = Buffer.from(base64Data, "base64");
    const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const filename = `${prefix}-${uniqueId}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filepath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error("Failed to save media to local uploads directory:", err.message);
    return dataString;
  }
}

module.exports = {
  saveBase64Media,
  UPLOAD_DIR,
};
