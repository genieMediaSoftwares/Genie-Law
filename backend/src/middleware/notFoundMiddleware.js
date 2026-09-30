const notFoundMiddleware = (req, res, next) => {
  if (res.headersSent) return next();

  return res.status(404).json({
    success: false,
    message: "The requested resource could not be found.",
    code: "NOT_FOUND",
  });
};

module.exports = notFoundMiddleware;
