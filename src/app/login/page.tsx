"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Shift = "Day" | "Night";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [shift, setShift] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!shift) {
      setError("اختر وردية الدخول: نهار أم ليل");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: shift }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error ?? "محاولات كثيرة جدًا، حاول مرة أخرى بعد قليل");
        } else {
          setError(data.error ?? "حدث خطأ، حاول مرة أخرى");
        }
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
          <h1 className="text-xl font-bold">دخول المندوب</h1>
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

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          الوردية
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShift("Day")}
              className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                shift === "Day"
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)]"
              }`}
            >
              نهار (Day)
            </button>
            <button
              type="button"
              onClick={() => setShift("Night")}
              className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                shift === "Night"
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)]"
              }`}
            >
              ليل (Night)
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-destructive)]" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary mt-2" disabled={loading}>
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>

        <p className="text-xs text-center text-[var(--color-muted)] mt-2">
          أول مرة تدخل بهذا الاسم أو الرقم؟ هيتم إنشاء حسابك تلقائيًا.
        </p>
      </form>
    </main>
  );
}
