const { clearSessionCookie } = require("../_lib/auth");

module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.status(200).json({ ok: true });
};
