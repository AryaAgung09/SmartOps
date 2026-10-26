"use client";
import UserTable from "./UserTable";
import { ROLE_OPTIONS } from "@/lib/roles";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function UserToolbar({ users }) {
  const router = useRouter();
  const { data: session } = useSession();
  const canCreateUser = session?.user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");

  const filteredUsers = users.filter((user) => {
    const keyword = search.toLowerCase();

    const matchesSearch =
      user.name.toLowerCase().includes(keyword) ||
      (user.email || "").toLowerCase().includes(keyword);

    const matchesRole =
      role === "ALL" || user.role === role;

    return matchesSearch && matchesRole;
  });

  return (
    <>
      <div className="user-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <select
          value={role}
          onChange={(event) =>
            setRole(event.target.value)
          }
        >
          <option value="ALL">Semua Role</option>
          {ROLE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        {canCreateUser && (
          <button
            type="button"
            onClick={() => router.push("/users/create")}
          >
            + Tambah User
          </button>
        )}
      </div>

      <UserTable users={filteredUsers} />
    </>
  );
}