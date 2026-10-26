import { Suspense } from "react";
import EditEmployeeForm from "./EditEmployeeForm";

export const instant = false;

export default async function EditEmployeePage({ params }) {
  const { id } = await params;
  const employeeId = id;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Edit Employee</h1>
          <p>Perbarui data karyawan dan penugasan</p>
        </div>
      </div>
      <Suspense fallback={<p>Memuat form...</p>}>
        <EditEmployeeForm employeeId={employeeId} />
      </Suspense>
    </main>
  );
}
