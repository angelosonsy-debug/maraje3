import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import materialsRouter from "./materials";
import authRouter from "./auth";
import uploadsRouter from "./uploads";
import reportsRouter from "./reports";
import engagementRouter from "./engagement";
import requestsRouter from "./requests";
import telegramRouter from "./telegram";
import intakeRouter from "./intake";
import flashcardsRouter from "./flashcards";
import premiumRouter from "./premium";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(materialsRouter);
router.use(authRouter);
router.use(uploadsRouter);
router.use(reportsRouter);
router.use(engagementRouter);
router.use(requestsRouter);
router.use(telegramRouter);
router.use(intakeRouter);
router.use(flashcardsRouter);
router.use(premiumRouter);

export default router;
