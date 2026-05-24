import { type Response } from 'express';
import { pool } from '../config/db.js';
import { type AuthenticatedRequest } from '../middleware/authMiddleware.js';

// 1. Create Issue
export const createIssue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, type } = req.body;
    const reporter_id = req.user?.id;

    if (!title || title.length > 150) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: 'Title is required and must not exceed 150 characters.',
      });
      return;
    }

    if (!description || description.length < 20) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: 'Description is required and must be at least 20 characters long.',
      });
      return;
    }

    if (type !== 'bug' && type !== 'feature_request') {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: 'Type must be either "bug" or "feature_request".',
      });
      return;
    }

    const queryText = `
      INSERT INTO issues (title, description, type, reporter_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, description, type, status, reporter_id, created_at, updated_at;
    `;
    
    const result = await pool.query(queryText, [title, description, type, reporter_id]);
    
    res.status(201).json({
      success: true,
      message: 'Issue created successfully',
      data: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error during issue creation',
      errors: error.message,
    });
  }
};

// 2. Get All Issues (With Filtering, Sorting, and Zero SQL JOINs)
export const getAllIssues = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sort, type, status } = req.query;

    let queryText = 'SELECT * FROM issues';
    const queryParams: any[] = [];
    const whereClauses: string[] = [];

    // Apply filtering query flags safely
    if (type === 'bug' || type === 'feature_request') {
      queryParams.push(type);
      whereClauses.push(`type = $${queryParams.length}`);
    }

    if (status === 'open' || status === 'in_progress' || status === 'resolved') {
      queryParams.push(status);
      whereClauses.push(`status = $${queryParams.length}`);
    }

    if (whereClauses.length > 0) {
      queryText += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Apply sorting sorting rule defaults
    if (sort === 'oldest') {
      queryText += ' ORDER BY created_at ASC;';
    } else {
      queryText += ' ORDER BY created_at DESC;'; // Default behavior
    }

    const issuesResult = await pool.query(queryText, queryParams);
    const issues = issuesResult.rows;

    if (issues.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    // Batch fetch user records to manually populate reporter models without SQL JOIN expressions
    const reporterIds = Array.from(new Set(issues.map(i => i.reporter_id)));
    const userQuery = 'SELECT id, name, role FROM users WHERE id = ANY($1);';
    const usersResult = await pool.query(userQuery, [reporterIds]);
    
    // Convert array structure into a high-speed ID dictionary lookup map
    const userMap = usersResult.rows.reduce((acc: any, user: any) => {
      acc[user.id] = user;
      return acc;
    }, {});

    // Stitch the structural response layout together manually in memory
    const unifiedPayload = issues.map(issue => {
      const { reporter_id, ...issueContent } = issue;
      return {
        ...issueContent,
        reporter: userMap[reporter_id] || { id: reporter_id, name: 'Unknown User', role: 'contributor' }
      };
    });

    res.status(200).json({
      success: true,
      data: unifiedPayload,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve issues list',
      errors: error.message,
    });
  }
};

// 3. Get Single Issue (No JOIN structural implementation)
export const getSingleIssue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const issueQuery = 'SELECT * FROM issues WHERE id = $1;';
    const issueResult = await pool.query(issueQuery, [id]);

    if (issueResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Retrieval failed',
        errors: 'The requested issue resource could not be found.',
      });
      return;
    }

    const issue = issueResult.rows[0];

    // Fetch matching reporter context independently via secondary query
    const userQuery = 'SELECT id, name, role FROM users WHERE id = $1;';
    const userResult = await pool.query(userQuery, [issue.reporter_id]);
    const user = userResult.rows[0];

    const { reporter_id, ...issueData } = issue;
    res.status(200).json({
      success: true,
      data: {
        ...issueData,
        reporter: user || { id: reporter_id, name: 'Unknown User', role: 'contributor' },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to find issue entity context',
      errors: error.message,
    });
  }
};

// 4. Update Issue (Enforcing the complex authorization workflow rules)
export const updateIssue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, type, status } = req.body;
    const currentUser = req.user;

    // Pull item historical context to evaluate contextual business rule conditions
    const findQuery = 'SELECT * FROM issues WHERE id = $1;';
    const existingResult = await pool.query(findQuery, [id]);

    if (existingResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Update processing failed',
        errors: 'Target issue could not be found to perform modification.',
      });
      return;
    }

    const issue = existingResult.rows[0];

    // Evaluate explicit validation constraints requested in assignment specifications
    if (currentUser?.role === 'contributor') {
      if (issue.reporter_id !== currentUser.id) {
        res.status(403).json({
          success: false,
          message: 'Action prohibited',
          errors: 'Contributors do not possess authorized clearance to update foreign issue records.',
        });
        return;
      }

      if (issue.status !== 'open') {
        res.status(403).json({
          success: false,
          message: 'Action prohibited',
          errors: 'Contributors are explicitly blocked from modifying items once state has shifted out of open.',
        });
        return;
      }
      
      if (status && status !== issue.status) {
        res.status(403).json({
          success: false,
          message: 'Action prohibited',
          errors: 'Contributors are not permitted to change issue workflow status fields.',
        });
        return;
      }
    }

    // Compose dynamic parameter updates maintaining values where new items are not supplied
    const finalTitle = title || issue.title;
    const finalDesc = description || issue.description;
    const finalType = type || issue.type;
    const finalStatus = status || issue.status;

    const updateQuery = `
      UPDATE issues
      SET title = $1, description = $2, type = $3, status = $4
      WHERE id = $5
      RETURNING id, title, description, type, status, reporter_id, created_at, updated_at;
    `;
    
    const updateResult = await pool.query(updateQuery, [finalTitle, finalDesc, finalType, finalStatus, id]);

    res.status(200).json({
      success: true,
      message: 'Issue updated successfully',
      data: updateResult.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal execution block encountered modifying data records',
      errors: error.message,
    });
  }
};

// 5. Delete Issue (Strict maintainer boundary protection)
export const deleteIssue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const checkQuery = 'SELECT id FROM issues WHERE id = $1;';
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Deletion abort triggered',
        errors: 'The issue artifact cannot be cleared because it does not exist.',
      });
      return;
    }

    const deleteQuery = 'DELETE FROM issues WHERE id = $1;';
    await pool.query(deleteQuery, [id]);

    res.status(200).json({
      success: true,
      message: 'Issue deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server failed to finalize drop script operation',
      errors: error.message,
    });
  }
};