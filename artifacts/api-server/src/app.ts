import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import { authMiddleware } from "./middlewares/auth";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/healthz", (_req, res) => { res.json({ status: "ok" }); });
app.use("/api", authMiddleware, router);

export default app;
