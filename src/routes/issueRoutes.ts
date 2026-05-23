import { Router } from 'express';
import { createIssue, getAllIssues, getSingleIssue, updateIssue, deleteIssue } from '../controllers/issueController.js';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Publicly viewable endpoints
router.get('/', getAllIssues);
router.get('/:id', getSingleIssue);

// Protected endpoints requiring token evaluation checks
router.post('/', authenticateJWT as any, createIssue as any);
router.patch('/:id', authenticateJWT as any, updateIssue as any);

// Highly privileged management endpoint
router.delete('/:id', [authenticateJWT, requireRole('maintainer')] as any, deleteIssue as any);

export default router;