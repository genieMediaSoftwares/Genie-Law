function readableFieldName(path) {
  const last = String(path)
    .split(".")
    .filter((part) => !/^\d+$/.test(part))
    .join(" ");

  const spaced = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const AppError = require("../utils/AppError");
const { FILE_TOO_LARGE_MESSAGE } = require("../config/uploadLimits");

const translateInfrastructureError = (err) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return {
      statusCode: 409,
      message: field
        ? `This ${field} is already in use.`
        : "This record already exists.",
      code: "DUPLICATE_KEY",
    };
  }

  if (err.name === "ValidationError" && err.errors) {
    const names = Object.keys(err.errors);

    const fields = {};
    for (const name of names) {
      const detail = err.errors[name];
      const label = readableFieldName(name);

      switch (detail?.kind) {
        case "required":
          fields[name] = `${label} is required.`;
          break;
        case "enum":
          fields[name] = `${label} is not one of the accepted values.`;
          break;
        case "ObjectId":
          fields[name] = `${label} is not a valid reference.`;
          break;
        case "Number":
        case "Date":
          fields[name] = `${label} is not a valid ${detail.kind.toLowerCase()}.`;
          break;
        case "minlength":
        case "maxlength":
          fields[name] = `${label} is not an accepted length.`;
          break;
        default:
          fields[name] = `${label} is not valid.`;
      }
    }

    return {
      statusCode: 400,
      message: names.length
        ? "Some of the details provided are not valid."
        : "Some of the details provided are not valid.",
      code: "VALIDATION_ERROR",
      fields,
    };
  }

  if (err.name === "CastError") {
    return {
      statusCode: 400,
      message: "The requested record could not be found.",
      code: "INVALID_IDENTIFIER",
    };
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return {
      statusCode: 401,
      message: "Invalid or expired token.",
      code: "INVALID_TOKEN",
    };
  }

  if (err.name === "MongoServerError" || err.name === "MongoNetworkError") {
    return {
      statusCode: 503,
      message: "Service temporarily unavailable. Please try again.",
      code: "SERVICE_UNAVAILABLE",
    };
  }

  return null;
};

const errorMiddleware = (
  err,
  req,
  res,
  next
) => {
  if (err instanceof AppError) {
    console.warn(`${req.method} ${req.originalUrl} → ${err.statusCode} ${err.code || ""}`.trim());
  } else {
    console.error(err);
  }

  let message = err.message || "Internal Server Error";
  let statusCode = err.statusCode || 500;
  let code = err instanceof AppError ? err.code : undefined;
  let fields;

  if (err.code === "LIMIT_FILE_SIZE") {
    message = FILE_TOO_LARGE_MESSAGE;
    statusCode = 413;
    code = "FILE_TOO_LARGE";
  } else {
    const translated = translateInfrastructureError(err);
    if (translated) {
      ({ message, statusCode, code } = translated);
      fields = translated.fields;
    }
  }

  const body = {
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(err instanceof AppError && err.details ? { data: err.details } : {}),
    ...(fields && Object.keys(fields).length ? { fields } : {}),
  };

  res.status(statusCode).json(body);
};

module.exports = errorMiddleware;
