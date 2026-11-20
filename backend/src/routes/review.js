/** The review list (card #242). UI: "Átnézés" page. */
import { Router } from 'express';
import { counts, list, decide, undo, decideMany, undoMany } from '../services/review.js';

const router = Router();
const wrap = fn => async (req, res, next) => {
  try { res.json(await fn(req)); } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); next(err); }
};

router.get('/counts', wrap(() => counts()));
router.post('/bulk', wrap(req => decideMany(req.body?.ids, req.body || {})));
router.post('/bulk/undo', wrap(req => undoMany(req.body?.ids || [])));
router.get('/:list', wrap(req => list(req.params.list, { limit: req.query.limit, all: req.query.all === '1' })));
router.post('/:emailId', wrap(req => decide(req.params.emailId, req.body || {})));
router.delete('/:emailId', wrap(req => undo(req.params.emailId)));

export default router;
