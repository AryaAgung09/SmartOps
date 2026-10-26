  import NextAuth from "next-auth";
  import CredentialsProvider from "next-auth/providers/credentials";

  import { prisma } from "@/lib/prisma";
  import { verifyPassword } from "@/lib/password";

  export const authOptions = {
    providers: [
      CredentialsProvider({
        name: "Credentials",

        credentials: {
          email: {
            label: "Email",
            type: "email",
          },
          password: {
            label: "Password",
            type: "password",
          },
        },

        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const email = String(credentials.email)
            .trim()
            .toLowerCase();

          const password = String(credentials.password);

          const user = await prisma.user.findUnique({
            where: {
              email,
            },
          });

          if (!user || !user.email || !user.passwordHash) {
            return null;
          }

          const validPassword = await verifyPassword(
            password,
            user.passwordHash
          );

          if (!validPassword) {
            return null;
          }

          return {
            id: String(user.id),
            name: user.name,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId,
          };
        },
      }),
    ],

    session: {
      strategy: "jwt",
    },

    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.id = user.id;
          token.role = user.role;
          token.departmentId = user.departmentId;
        }

        return token;
      },

      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.departmentId = token.departmentId;
        }

        return session;
      },
    },

    pages: {
      signIn: "/login",
    },

    secret: process.env.NEXTAUTH_SECRET,
  };

  export default NextAuth(authOptions);