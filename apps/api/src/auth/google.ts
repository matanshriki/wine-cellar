/**
 * Google OAuth Strategy
 * 
 * Handles Google OAuth 2.0 authentication using Passport.js
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../db.js';
import { config } from '../config.js';

export function setupGoogleAuth() {
  // Only setup Google OAuth if credentials are provided
  if (!config.googleClientId || !config.googleClientSecret) {
    console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.');
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: `${config.apiUrl}/api/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          
          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Check if user exists with this Google ID
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (user) {
            // Update user info if changed
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                name: profile.displayName || user.name,
                picture: profile.photos?.[0]?.value || user.picture,
              },
            });
            return done(null, user);
          }

          // Check if user exists with this email (local account)
          user = await prisma.user.findUnique({
            where: { email },
          });

          if (user) {
            // Link Google account to existing local account
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                authProvider: 'google',
                name: profile.displayName || user.name,
                picture: profile.photos?.[0]?.value,
              },
            });
            return done(null, user);
          }

          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              googleId: profile.id,
              authProvider: 'google',
              name: profile.displayName,
              picture: profile.photos?.[0]?.value,
              passwordHash: null, // No password for OAuth users
            },
          });

          return done(null, user);
        } catch (error: any) {
          console.error('Google OAuth error:', error);
          return done(error);
        }
      }
    )
  );

  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  console.log('✅ Google OAuth configured');
  return true;
}

