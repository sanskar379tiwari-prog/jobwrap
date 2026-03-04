function errorHandler(err, req, res, next) {
  const status = err?.statusCode || 500;
  const message =
    err?.publicMessage ||
    (status >= 500
      ? "AI service is unavailable or returned invalid output. Please try again."
      : "Invalid request.");

  if (process.env.NODE_ENV !== "test") {
    console.error("[error]", {
      status,
      message: err?.message || String(err),
    });
  }

  res.status(status).json({ error: { message } });
}

module.exports = { errorHandler };

