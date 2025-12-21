import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: "Username", type: "text", placeholder: "admin" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                // Simple mock auth for demonstration
                if (credentials?.username === "admin" && credentials?.password === "admin") {
                    return { id: "1", name: "Admin User", email: "admin@example.com" }
                }
                return null
            }
        })
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async session({ session, token }: any) {
            return session
        },
        async jwt({ token, user }: any) {
            return token
        }
    }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
