import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { apiRateLimiter } from "./middlewares/rate-limit";
import router from "./routes";
import pagesRouter from "./routes/pages";
import shareRouter from "./routes/share";
import { logger } from "./lib/logger";

const app: Express = express();
const allowedOrigins = new Set(
  (process.env["CORS_ORIGINS"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const isProduction = process.env["NODE_ENV"] === "production";
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    if (!isProduction && allowedOrigins.size === 0) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
};

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOptions));
app.use("/api", apiRateLimiter);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Outside /api on purpose: it's the literal public link people share, e.g.
// https://<domain>/m/42, not an API call.
app.use(shareRouter);
// Stage 8 — Google Play policy pages (/privacy, /terms, /delete-account,
// /takedown). Also literal links, not API calls — Play Console and users
// open these directly in a browser.
app.use(pagesRouter);

app.use("/api", router);

export default app;
