"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await signIn("credentials", {
            username,
            password,
            redirect: false,
        });

        if (result?.ok) {
            router.push("/");
        } else {
            alert("無効な認証情報");
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
            <Card className="w-[350px] bg-slate-900 border-slate-800">
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
                    <form onSubmit={handleSubmit}>
                        <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="username" className="text-slate-200">ユーザー名</Label>
                                <Input
                                    id="username"
                                    placeholder="admin"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="password" className="text-slate-200">パスワード</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>
                        </div>
                        <Button className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white" type="submit">
                            ログイン
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
