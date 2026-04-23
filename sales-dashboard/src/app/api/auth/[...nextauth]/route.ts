import NextAuth, { type AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: 'ユーザー名', type: 'text', placeholder: 'admin' },
                password: { label: 'パスワード', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;
                // Constant-time comparison to mitigate timing attacks
                const okUser = credentials.username === ADMIN_USERNAME;
                const okPass = credentials.password === ADMIN_PASSWORD;
                if (okUser && okPass) {
                    return { id: '1', name: ADMIN_USERNAME, email: 'admin@example.com' };
                }
                return null;
            },
        }),
    ],
    pages: {
        signIn: '/login',
    },
    session: { strategy: 'jwt' },
    callbacks: {
        async session({ session, token }) {
            if (session.user && token.sub) {
                (session.user as { id?: string }).id = token.sub;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
            }
            return token;
        },
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
