import { Router } from "express";
import { deleteAccount } from "../controllers/account.controller.js";
import { authenticate } from "../middleware/authenticate.js";

export const accountRouter = Router();

accountRouter.delete("/", authenticate, deleteAccount);
