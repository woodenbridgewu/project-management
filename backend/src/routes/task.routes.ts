import { Router } from 'express';
import { TaskController } from '../controllers/task.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const taskController = new TaskController();

router.use(authenticate);

// 使用箭頭函數綁定 this 上下文
router.get('/projects/:projectId/tasks', (req, res) => taskController.getTasksByProject(req, res));
router.post('/projects/:projectId/tasks', (req, res) => taskController.createTask(req, res));
router.get('/:id', (req, res) => taskController.getTaskById(req, res));
router.patch('/:id', (req, res) => taskController.updateTask(req, res));
router.delete('/:id', (req, res) => taskController.deleteTask(req, res));
router.post('/:id/move', (req, res) => taskController.moveTask(req, res));

export { router as taskRouter };