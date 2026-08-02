"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "حدث خطأ، حاول مرة أخرى");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-sm flex flex-col gap-4"
      >
        <div className="text-center mb-2">
          <h1 className="text-xl font-bold">تسجيل دخول المندوب</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            أداة تحديد مواقع العملاء
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          رقم الهاتف أو الاسم
          <input
            className="field"
            type="text"
            placeholder="01012345678 أو الاسم"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          كلمة المرور
          <input
            className="field"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <p className="text-sm text-[var(--color-destructive)]" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary mt-2" disabled={loading}>
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>

        <p className="text-xs text-center text-[var(--color-muted)] mt-2">
          نسيت كلمة المرور؟ تواصل مع مسؤول النظام لإعادة تعيينها.
        </p>
      </form>
    </main>
  );
}
