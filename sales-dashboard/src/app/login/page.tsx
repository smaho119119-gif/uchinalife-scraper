'use client';

import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2 } from 'lucide-react';

function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setError(null);
        setSubmitting(true);
        try {
            const result = await signIn('credentials', {
                username,
                password,
                redirect: false,
            });

            if (result?.ok) {
                router.push(callbackUrl);
                router.refresh();
            } else {
                setError('ユーザー名またはパスワードが正しくありません');
            }
        } catch (err) {
            console.error('Login failed:', err);
            setError('ログイン処理中にエラーが発生しました。しばらく待ってから再度お試しください。');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 px-4">
            <Card className="w-full max-w-sm bg-slate-900 border-slate-800">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <div className="p-3 rounded-full bg-slate-800">
                            <Lock className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                    <CardTitle className="text-center text-white">営業ダッシュボード</CardTitle>
                    <CardDescription className="text-center text-slate-400">
                        ログイン情報を入力してください
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="username" className="text-slate-200">
                                    ユーザー名
                                </Label>
                                <Input
                                    id="username"
                                    placeholder="admin"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="password" className="text-slate-200">
                                    パスワード
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                    autoComplete="current-password"
                                    required
                                />
                            </div>
                        </div>
                        {error && (
                            <p
                                role="alert"
                                className="mt-3 text-sm text-red-300 bg-red-950/50 border border-red-700/50 rounded p-2"
                            >
                                {error}
                            </p>
                        )}
                        <Button
                            className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            type="submit"
                            disabled={submitting || !username || !password}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ログイン中...
                                </>
                            ) : (
                                'ログイン'
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <p className="text-xs text-slate-500">初期設定: admin / admin</p>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen bg-slate-950">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
