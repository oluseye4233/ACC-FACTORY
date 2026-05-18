import { Router, type IRouter } from "express";
import { getExemplar, listExemplars } from "../data/exemplars";

const router: IRouter = Router();

router.get("/exemplars", (_req, res): void => {
  res.json(listExemplars());
});

router.get("/exemplars/:id", (req, res): void => {
  const exemplar = getExemplar(req.params.id);
  if (!exemplar) {
    res.status(404).json({ error: "Exemplar not found" });
    return;
  }
  res.json(exemplar);
});

export default router;
