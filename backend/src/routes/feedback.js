/** The owner's verdict corrections ("Rossz besorolás") and their report. */
import { Router } from 'express';
import { get, give, remove, report, suggest } from '../services/feedback.js';

const router = Router();
const wrap = fn => async (req, res, next) => {
  try { res.json(await fn(req)); } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); next(err); }
};

router.get('/report', wrap(req => report({ days: req.query.days })));
router.post('/suggest', wrap(req => suggest({ days: req.body?.days })));
router.get('/:emailId', wrap(req => get(req.params.emailId)));
router.post('/:emailId', wrap(req => give(req.params.emailId, req.body || {})));
router.delete('/:emailId', wrap(req => remove(req.params.emailId)));

export default router;
