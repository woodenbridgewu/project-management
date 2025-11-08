import { Router } from 'express';
import { CommentController } from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const commentController = new CommentController();

router.use(authenticate);

// 任務評論路由
router.get('/tasks/:taskId/comments', (req, res) => commentController.getCommentsByTask(req, res));
router.post('/tasks/:taskId/comments', (req, res) => commentController.createComment(req, res));

// 評論操作路由
router.patch('/:id', (req, res) => commentController.updateComment(req, res));
router.delete('/:id', (req, res) => commentController.deleteComment(req, res));

export { router as commentRouter };

