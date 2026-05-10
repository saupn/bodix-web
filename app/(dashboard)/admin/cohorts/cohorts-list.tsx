"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Status = "upcoming" | "active" | "completed";

interface ProgramRef {
  name: string;
  slug: string;
}

interface CohortRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: Status;
  current_members: number | null;
  max_members: number | null;
  program_id: string;
  programs: ProgramRef | ProgramRef[] | null;
}

interface ProgramOption {
  id: string;
  name: string;
  slug: string;
}

interface WaitingUser {
  id: string;
  full_name: string | null;
  phone: string | null;
  bodix_program: string | null;
  payment_status: string | null;
}

function programNameOf(c: CohortRow): string {
  const p = Array.isArray(c.programs) ? c.programs[0] : c.programs;
  return p?.name ?? "-";
}

function formatDate(d: string): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

function statusBadge(s: Status) {
  const map: Record<Status, string> = {
    upcoming: "bg-blue-50 text-blue-700 border-blue-200",
    active: "bg-green-50 text-green-700 border-green-200",
    completed: "bg-neutral-100 text-neutral-600 border-neutral-200",
  };
  const label: Record<Status, string> = {
    upcoming: "Sắp tới",
    active: "Đang chạy",
    completed: "Đã xong",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${map[s]}`}>
      {label[s]}
    </span>
  );
}

export function CohortsList({
  cohorts,
  programs,
  usersWaiting,
}: {
  cohorts: CohortRow[];
  programs: ProgramOption[];
  usersWaiting: WaitingUser[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showCreate, setShowCreate] = useState(false);
  const [giftFor, setGiftFor] = useState<CohortRow | null>(null);
  const [confirmStart, setConfirmStart] = useState<CohortRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CohortRow | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="mt-8 space-y-8">
      {/* Section 1: User chưa được gán cohort (orphan paid)
          User thanh toán → tự động gán cohort upcoming. Section này chỉ liệt
          kê user còn sót (cohort đầy / chưa có upcoming lúc thanh toán).
          Cron rescue-check sẽ auto-fill mỗi đêm. */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Chưa gán cohort
          </h2>
          <span className="text-sm text-neutral-500">
            {usersWaiting.length} user
          </span>
        </div>
        {usersWaiting.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Tất cả user đã thanh toán đều đã được gán cohort.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-neutral-500">
              Cron tự gán mỗi đêm khi có cohort upcoming còn chỗ.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {usersWaiting.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700"
                >
                  <span className="font-medium">{u.full_name || u.phone || u.id.slice(0, 8)}</span>
                  {u.bodix_program && (
                    <span className="text-neutral-500">· {u.bodix_program}</span>
                  )}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Section 2: Tạo cohort */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          + Tạo đợt tập mới
        </button>
      </div>

      {/* Section 3: Bảng cohorts */}
      <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Tên
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Chương trình
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Ngày bắt đầu
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-600">
                Members
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-neutral-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {cohorts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-neutral-500"
                >
                  Chưa có cohort nào. Bấm &quot;Tạo đợt tập mới&quot; để bắt đầu.
                </td>
              </tr>
            )}
            {cohorts.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-neutral-900">
                  {c.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                  {programNameOf(c)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                  {formatDate(c.start_date)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {statusBadge(c.status)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-700">
                  {c.current_members ?? 0}
                  {c.max_members ? ` / ${c.max_members}` : ""}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                  <div className="inline-flex flex-wrap items-center justify-end gap-2">
                    {c.status === "upcoming" && (
                      <>
                        {(c.current_members ?? 0) < (c.max_members ?? 50) ? (
                          <button
                            type="button"
                            onClick={() => setGiftFor(c)}
                            className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                          >
                            🎁 Tặng vé
                          </button>
                        ) : (
                          <span className="rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-500">
                            Đầy chỗ
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmStart(c)}
                          className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                        >
                          Bắt đầu
                        </button>
                        <Link
                          href={`/admin/cohorts/${c.id}/analytics`}
                          className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Xem
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(c)}
                          className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Xóa
                        </button>
                      </>
                    )}
                    {c.status === "active" && (
                      <Link
                        href={`/admin/cohorts/${c.id}/analytics`}
                        className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Xem
                      </Link>
                    )}
                    {c.status === "completed" && (
                      <Link
                        href={`/admin/cohorts/${c.id}/analytics`}
                        className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Xem
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {showCreate && (
        <CreateCohortModal
          programs={programs}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}

      {giftFor && (
        <GiftTicketModal
          cohort={giftFor}
          onClose={() => setGiftFor(null)}
          onGranted={() => {
            setGiftFor(null);
            refresh();
          }}
        />
      )}

      {confirmStart && (
        <ConfirmStartModal
          cohort={confirmStart}
          onClose={() => setConfirmStart(null)}
          onStarted={() => {
            setConfirmStart(null);
            refresh();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          cohort={confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onDeleted={() => {
            setConfirmDelete(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateCohortModal({
  programs,
  onClose,
  onCreated,
}: {
  programs: ProgramOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, start_date: startDate, program_id: programId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không thể tạo cohort.");
        return;
      }
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Tạo đợt tập mới" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tên đợt tập">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Đợt tháng 5/2026"
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>
        <Field label="Ngày bắt đầu (≥ 3 ngày từ hôm nay)">
          <input
            type="date"
            value={startDate}
            min={minDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>
        <Field label="Chương trình">
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? "Đang tạo..." : "Tạo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Gift ticket modal ────────────────────────────────────────────────────────

function GiftTicketModal({
  cohort,
  onClose,
  onGranted,
}: {
  cohort: CohortRow;
  onClose: () => void;
  onGranted: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại của người nhận.");
      return;
    }
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do tặng vé.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/cohorts/${cohort.id}/grant-complimentary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim(), reason: reason.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không thể tặng vé.");
        return;
      }
      onGranted();
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const remaining =
    (cohort.max_members ?? 50) - (cohort.current_members ?? 0);

  return (
    <Modal title={`🎁 Tặng vé "${cohort.name}"`} onClose={onClose}>
      <p className="text-sm text-neutral-600">
        Tặng 1 vé miễn phí cho KOL / beta tester / người quen. Enrollment được
        tạo với <code className="font-mono">is_complimentary=true</code>, gán
        cohort luôn — KHÔNG tính vào doanh thu.
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Còn {remaining} chỗ trong cohort này.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Số điện thoại người nhận">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="VD: 0909123456"
            required
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>
        <Field label="Lý do tặng vé">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: KOL Linh – beta tester đợt đầu"
            required
            rows={3}
            maxLength={500}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {loading ? "Đang tặng..." : "Tặng vé"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Confirm start modal ──────────────────────────────────────────────────────

function ConfirmStartModal({
  cohort,
  onClose,
  onStarted,
}: {
  cohort: CohortRow;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cohorts/${cohort.id}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không thể bắt đầu.");
        return;
      }
      onStarted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Bắt đầu "${cohort.name}"?`} onClose={onClose}>
      <p className="text-sm text-neutral-700">
        Tất cả users trong cohort sẽ chuyển sang <strong>Ngày 1</strong> và bắt đầu nhận thông báo.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Hành động này không thể hoàn tác trực tiếp.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={start}
          disabled={loading}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {loading ? "Đang bắt đầu..." : "Bắt đầu"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  cohort,
  onClose,
  onDeleted,
}: {
  cohort: CohortRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cohorts/${cohort.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không thể xóa.");
        return;
      }
      onDeleted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Xóa "${cohort.name}"?`} onClose={onClose}>
      <p className="text-sm text-neutral-700">
        Cohort sẽ bị xóa vĩnh viễn. Chỉ cho phép khi chưa có user nào.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Đang xóa..." : "Xóa"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Modal primitive ──────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-neutral-400 hover:text-neutral-700"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}
