import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        try {
          // Find user in database
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() }
          });

          if (!user || !user.hashedPassword) {
            throw new Error('Invalid email or password');
          }

          // Verify password
          const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
          if (!isValid) {
            throw new Error('Invalid email or password');
          }

          // Return user object
          return {
            id: user.id,
            email: user.email,
            username: user.username,
            avatarUrl: user.avatarUrl,
            role: user.role
          };
        } catch (error) {
          console.error('Auth error:', error);
          throw new Error('Authentication failed');
        }
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.role = user.role;
        token.username = user.username;
        token.avatarUrl = user.avatarUrl;
      }
      return token;
    },

    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.username = token.username;
        session.user.avatarUrl = token.avatarUrl;
      }
      return session;
    }
  },

  pages: {
    signIn: '/auth/signin',
  },

  secret: process.env.NEXTAUTH_SECRET,
};
