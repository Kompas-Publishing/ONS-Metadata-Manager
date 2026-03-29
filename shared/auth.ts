import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { type User } from "./schema.js";
import { type IStorage } from "./storage.js";

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
            return done(null, false, { message: "No password set for this account" });
          }

          const isValid = await bcrypt.compare(password, user.password as string);

          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          if (user.status !== "active" && user.status !== "pending") {
            return done(null, false, { message: "Account is not active. Please contact an administrator." });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  return passport;
}
