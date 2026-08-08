"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Shift = "Day" | "Night";

const POLL_INTERVAL_MS = 6000;

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [shift, setShift] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set on a 403 with approved: false — switches to a waiting screen that
  // quietly retries the same login every few seconds, so the driver
  // doesn't have to keep re-submitting the form once an admin approves them.
  const [waitingApproval, setWaitingApproval] = useState(false);

  async function attemptLogin(silent: boolean) {
    if (!silent) {
      setError(null);
      setLoading(true);
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: shift }),
      });
      const data = await res.json();

      if (res.ok) {
        setWaitingApproval(false);
        router.push("/dashboard");
        router.refresh();
        return;
      }

      if (data.approved === false) {
        setWaitingApproval(true);
        setError(null);
        return;
      }

      setWaitingApproval(false);
      if (res.status === 429) {
        setError(data.error ?? "محاولات كثيرة جدًا، حاول مرة أخرى بعد قليل");
      } else {
        setError(data.error ?? "حدث خطأ، حاول مرة أخرى");
      }
    } catch {
      if (!silent) setError("تعذر الاتصال بالخادم");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!waitingApproval) return;
    const timer = setInterval(() => attemptLogin(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingApproval]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!shift) {
      setError("اختر وردية الدخول: نهار أم ليل");
      return;
    }

    await attemptLogin(false);
  }

  if (waitingApproval) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="card w-full max-w-sm flex flex-col gap-4 items-center text-center">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
          <div>
            <h1 className="text-lg font-bold">حسابك بانتظار الموافقة</h1>
            <p className="text-sm text-[var(--color-muted)] mt-1">
              اطلب من أحد المسؤولين قبول حسابك. هذه الصفحة ستدخلك تلقائيًا
              فور الموافقة، لا داعي لإعادة المحاولة يدويًا.
            </p>
          </div>
          <button className="btn-outline text-sm" onClick={() => setWaitingApproval(false)}>
            رجوع
          </button>
        </div>
      </main>
    );
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
          أول مرة تدخل بهذا الاسم أو الرقم؟ هيتم إنشاء حسابك تلقائيًا، وينتظر
          موافقة أحد المسؤولين قبل الدخول.
        </p>
      </form>
    </main>
  );
}
