const logger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const userAgent = req.get("User-Agent") || "Unknown";

    console.log(`[${timestamp}] ${method} ${url}`);
    next();
};

module.exports = { logger };