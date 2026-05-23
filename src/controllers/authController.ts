import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validate mandatory payload values
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Registration failed',
        errors: 'Name, email, and password fields are strictly required.',
      });
      return;
    }

    // Assign default role if none is supplied
    const assignedRole = role || 'contributor';
    if (assignedRole !== 'contributor' && assignedRole !== 'maintainer') {
      res.status(400).json({
        success: false,
        message: 'Registration failed',
        errors: 'Role must be either "contributor" or "maintainer".',
      });
      return;
    }

    // 2. Encrypt user password using bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. Write pure raw SQL to insert the user (Absolutely no ORM/builders used)
    const queryText = `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at, updated_at;
    `;
    
    const result = await pool.query(queryText, [name, email, hashedPassword, assignedRole]);
    const newUser = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: newUser,
    });
  } catch (error: any) {
    // Catch unique constraint failures for emails
    if (error.code === '23505') {
      res.status(400).json({
        success: false,
        message: 'Registration failed',
        errors: 'An account with this email address already exists.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
      errors: error.message,
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Login failed',
        errors: 'Email and password are required fields.',
      });
      return;
    }

    // Fetch user details securely with a direct raw SQL query string matching the email
    const queryText = 'SELECT * FROM users WHERE email = $1;';
    const result = await pool.query(queryText, [email]);

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Authentication failed',
        errors: 'Invalid email credentials or password.',
      });
      return;
    }

    const user = result.rows[0];

    // Verify the encrypted user credentials matches the raw password input
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Authentication failed',
        errors: 'Invalid email credentials or password.',
      });
      return;
    }

    // Construct token payload containing fields required by subsequent authorization steps
    const tokenPayload = {
      id: user.id,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    // Clean up security objects prior to dispatching responses
    delete user.password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error during login operation',
      errors: error.message,
    });
  }
};