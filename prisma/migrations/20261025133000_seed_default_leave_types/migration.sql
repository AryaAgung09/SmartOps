-- Seed the default leave catalog required by the leave request form.
INSERT IGNORE INTO `leave_types` (`code`, `name`, `description`, `defaultDays`, `requiresApproval`, `isPaid`, `isActive`, `createdAt`, `updatedAt`)
VALUES
  ('ANNUAL', 'Cuti Tahunan', 'Hak cuti tahunan karyawan.', 12, true, true, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('SICK', 'Cuti Sakit', 'Cuti karena kondisi kesehatan.', 12, true, true, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('MATERNITY', 'Cuti Melahirkan', 'Cuti melahirkan sesuai kebijakan perusahaan.', 90, true, true, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('UNPAID', 'Cuti Tanpa Dibayar', 'Cuti di luar saldo cuti berbayar.', 30, true, false, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
