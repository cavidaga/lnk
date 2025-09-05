// lib/render-helpers.js

// escape HTML special chars (safe for <meta> etc.)
export function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// default analysis data (used if no hash/data provided)
export const defaultData = {
  title: "Ukrayna sülhü və Azərbaycan üçün potensial təhlükələr",
  platform: "Facebook",
  reliability: 45,
  political_bias: -3.5,
  socio_cultural_bias: 0.0,
  summary: "Tarixçi və analitik ...",
  footer: "LNK tərəfindən təhlil edilib",
};

// compute dot position for quadrant
export function calcDot(political_bias, reliability) {
  const cx = 40 + ((Number(political_bias) + 5) / 10) * 420;
  const cy = 40 + (1 - Number(reliability) / 100) * 420;
  return { cx, cy };
}
