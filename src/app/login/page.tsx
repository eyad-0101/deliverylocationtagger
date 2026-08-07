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
        className="card w-full max-w-sm flex flex-col gap-5 bg-white/90 backdrop-blur-sm"
      >
        <div className="text-center mb-3">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent">دخول المندوب</h1>
          <p className="text-sm text-[var(--color-muted)] mt-2">
            أداة تحديد مواقع العملاء
          </p>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium">
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

        <div className="flex flex-col gap-2.5 text-sm font-medium">
          الوردية
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShift("Day")}
              className={`rounded-xl border py-3 text-sm font-semibold transition-all ${
                shift === "Day"
                  ? "border-[var(--color-primary)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-md"
                  : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-muted-bg)]"
              }`}
            >
              نهار (Day)
            </button>
            <button
              type="button"
              onClick={() => setShift("Night")}
              className={`rounded-xl border py-3 text-sm font-semibold transition-all ${
                shift === "Night"
                  ? "border-[var(--color-primary)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white shadow-md"
                  : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-muted-bg)]"
              }`}
            >
              ليل (Night)
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary mt-3" disabled={loading}>
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>

        <p className="text-xs text-center text-[var(--color-muted)] mt-1">
          أول مرة تدخل بهذا الاسم أو الرقم؟ هيتم إنشاء حسابك تلقائيًا.
        </p>
      </form>
    </main>
  );
}
