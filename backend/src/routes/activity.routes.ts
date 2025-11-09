import { Router } from 'express';
import { ActivityController } from '../controllers/activity.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const activityController = new ActivityController();

// 所有活動紀錄路由都需要認證
router.use(authenticate);

// 活動紀錄路由
router.get('/workspaces/:wid/activities', (req, res) => activityController.getWorkspaceActivities(req, res));
router.get('/projects/:pid/activities', (req, res) => activityController.getProjectActivities(req, res));
router.get('/tasks/:tid/activities', (req, res) => activityController.getTaskActivities(req, res));

export { router as activityRouter };

