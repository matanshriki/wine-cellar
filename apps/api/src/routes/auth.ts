import { Router } from 'express';
import passport from 'passport';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword, generateToken } from '../auth/utils.js';
import { registerSchema, loginSchema } from '../validation/schemas.js';
import { config } from '../config.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
      },
    });

    // Generate token
    const token = generateToken(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user registered via OAuth (no password)
    if (!user.passwordHash) {
      return res.status(401).json({ 
        error: 'This account uses Google login. Please sign in with Google.' 
      });
    }

    // Verify password
    const valid = await verifyPassword(data.password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(400).json({ error: error.message || 'Login failed' });
  }
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out' });
});

authRouter.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { verifyToken: verify } = await import('../auth/utils.js');
    const payload = verify(token);

    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        authProvider: user.authProvider,
      },
    });
  } catch (error: any) {
    console.error('Me error:', error);
    return res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Google OAuth routes
// Only register these routes if Google OAuth is configured
authRouter.get('/google', (req, res, next) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(501).json({ 
      error: 'Google OAuth not configured',
      message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables'
    });
  }
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })(req, res, next);
});

authRouter.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${config.webUrl}/login?error=google_auth_failed`
  }),
  (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.redirect(`${config.webUrl}/login?error=no_user`);
      }

      // Generate JWT token
      const token = generateToken(user.id);

      // Set cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Redirect to frontend with success
      res.redirect(`${config.webUrl}/?token=${token}`);
    } catch (error: any) {
      console.error('Google callback error:', error);
      res.redirect(`${config.webUrl}/login?error=callback_failed`);
    }
  }
);

