"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { REQUEST_TYPES } from "@/lib/requestTypes";

export default function RequestFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus =
    searchParams.get("status") || "";

  const currentType =
    searchParams.get("type") || "";

  const currentSearch =
    searchParams.get("search") || "";

  function updateFilter(name, value) {
    const params = new URLSearchParams(
      searchParams.toString()
    );

    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    router.push(`/requests?${params.toString()}`);
  }

  function handleSearch(event) {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget
    );

    const search =
      formData.get("search")?.toString().trim() ||
      "";

    updateFilter("search", search);
  }

  function resetFilter() {
    router.push("/requests");
  }

  return (
    <div className="request-filters">
      <form
        className="request-search"
        onSubmit={handleSearch}
      >
        <input
          type="text"
          name="search"
          defaultValue={currentSearch}
          placeholder="Cari judul request..."
        />

        <button type="submit">
          Cari
        </button>
      </form>

      <div className="filter-group">
        <select
          value={currentStatus}
          onChange={(event) =>
            updateFilter(
              "status",
              event.target.value
            )
          }
        >
          <option value="">
            Semua Status
          </option>

          <option value="PENDING">
            Pending
          </option>

          <option value="IN_REVIEW">
            In Review
          </option>

          <option value="APPROVED">
            Approved
          </option>

          <option value="REJECTED">
            Rejected
          </option>

          <option value="COMPLETED">
            Completed
          </option>

          <option value="CANCELLED">
            Cancelled
          </option>
        </select>

        <select
          value={currentType}
          onChange={(event) =>
            updateFilter(
              "type",
              event.target.value
            )
          }
        >
          <option value="">
            Semua Tipe
          </option>

          {REQUEST_TYPES.map((item) => (
            <option
              key={item.value}
              value={item.value}
            >
              {item.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={resetFilter}
        >
          Reset
        </button>
      </div>
    </div>
  );
}