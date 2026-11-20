/** Points per signal (card #246): train, tune, backtest, activate. UI: Triage > Workbench > Pontozás. */
import { Router } from 'express';
import { FEATURES, getModel, train, updateModel, backtest, storeBacktest, explainEmail } from '../services/signalscore.js';

const router = Router();
const wrap = fn => async (req, res, next) => {
  try { res.json(await fn(req)); } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); next(err); }
};

router.get('/', wrap(() => ({ model: getModel(), features: FEATURES })));
router.post('/train', wrap(() => train()));
router.patch('/', wrap(req => updateModel(req.body || {})));
// Body: { overrides?, high?, low? } — a draft; stored as the model's last backtest only when empty.
router.post('/backtest', wrap(req => {
  const draft = req.body || {};
  const r = backtest(draft);
  if (!draft.overrides && draft.high === undefined && draft.low === undefined) storeBacktest(r);
  return r;
}));
router.get('/email/:id', wrap(req => explainEmail(req.params.id)));

export default router;
