import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { SearchController } from '../controllers/search.controller';

const router = Router();
const searchController = new SearchController();

// 所有搜尋路由都需要認證
router.use(authenticate);

// 全文搜尋
router.get('/', (req, res) => searchController.search(req, res));

// 搜尋建議（自動完成）
router.get('/suggestions', (req, res) => searchController.searchSuggestions(req, res));

export { router as searchRouter };

