import { Router } from 'express';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { getAuditLog } from '../database.js';

const router = Router();

router.use(authenticate, adminOnly);

router.get('/audit', (req, res) => {
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);
  const usePagination = Number.isInteger(page) && page > 0 && Number.isInteger(limit) && limit > 0 && limit <= 100;
  const result = getAuditLog({
    search: req.query.search,
    page: usePagination ? page : undefined,
    limit: usePagination ? limit : undefined,
  });
  res.json(result);
});

export default router;