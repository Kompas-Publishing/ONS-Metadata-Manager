import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import { type User } from "@shared/schema";
import { type IStorage } from "./storage";

export function setupPassport(storage: IStorage) {
  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: any, done) => {
    try {
      if (!id || typeof id !== 'string') {
        return done(null, false);
      }
      const user = await storage.getUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error('Deserialization error:', error);
      done(null, false);
    }
  });

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          if (!user.password) {
            return done(null, false, { message: "Please use social login" });
          }

          const isValid = await bcrypt.compare(password, user.password as string);
          
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          if (user.status !== "active") {
            return done(null, false, { message: "Account is not active. Please contact an administrator." });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || 
    `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/api/auth/google/callback`;

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: googleCallbackURL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            
            if (!email) {
              return done(new Error("No email found from Google profile"));
            }

            let user = await storage.getUserByEmail(email);

            if (!user) {
              user = await storage.createUser({
                email,
                firstName: profile.name?.givenName || null,
                lastName: profile.name?.familyName || null,
                profileImageUrl: profile.photos?.[0]?.value || null,
                authProvider: "google",
                status: "pending",
                canRead: 0,
                canWrite: 0,
                canEdit: 0,
                fileVisibility: "own",
                isAdmin: 0,
              });
            } else if (user.authProvider !== "google") {
              return done(null, false, { message: "Email already registered with password login" });
            }

            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

  return passport;
}
