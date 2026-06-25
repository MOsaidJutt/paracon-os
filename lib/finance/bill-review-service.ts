import type { TenantContext } from "@/lib/tenant";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { auditLog } from "@/lib/audit";
import { assertInList, loadFinanceConfig } from "./config";
import { canApproveBill, canMarkPaid, canMarkReconciled, canMarkSentToEzzyBills } from "./bill-pipeline";
import type { CreateSupplierBillInput, AllocateSupplierBillInput, UpdateSupplierBillChecklistInput } from "@/lib/validations/supplier-bill";

const RECEIVED = "Received";
const UNDER_REVIEW = "Under review";
const APPROVED = "Approved";
const QUERIED = "Queried";
const REJECTED = "Rejected";
const SENT_TO_EZZYBILLS = "Sent to EzzyBills";
const PAID = "Paid";
const RECONCILED = "Reconciled";

const ALLOCATED = "Allocated";
const UNALLOCATED = "Unallocated";

export async function createSupplierBillManual(
  db: TenantContext,
  organisationId: string,
  input: CreateSupplierBillInput
) {
  if (input.projectId) {
    const project = await db.project.findFirst({ where: { id: input.projectId } });
    if (!project) throw new NotFoundError("Project not found");
  }
  if (input.poId) {
    const po = await db.purchaseOrder.findFirst({ where: { id: input.poId, ...(input.projectId ? { projectId: input.projectId } : {}) } });
    if (!po) throw new NotFoundError("Purchase order not found");
  }

  return db.supplierBill.create({
    data: {
      organisationId,
      projectId: input.projectId ?? null,
      supplierId: input.supplierId ?? null,
      supplierNameRaw: input.supplierNameRaw ?? null,
      poId: input.poId ?? null,
      billFileId: input.billFileId,
      invoiceNumber: input.invoiceNumber ?? null,
      invoiceDate: input.invoiceDate ?? null,
      amountExGst: input.amountExGst,
      gstAmount: input.gstAmount,
      amountIncGst: input.amountIncGst,
      jobNumberRaw: input.jobNumberRaw ?? null,
      allocationStatus: input.projectId ? ALLOCATED : UNALLOCATED,
      status: RECEIVED,
      source: "Manual",
    },
  });
}

export async function listSupplierBills(
  db: TenantContext,
  filter: { projectId?: string; allocationStatus?: string; status?: string }
) {
  return db.supplierBill.findMany({
    where: {
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
      ...(filter.allocationStatus ? { allocationStatus: filter.allocationStatus } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    include: {
      project: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, company: true } },
      po: { select: { id: true, number: true, value: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** The Unallocated tray's one-click action — assigns a project (and optionally PO/supplier) to a bill the mailbox watcher couldn't confidently match. */
export async function allocateSupplierBill(
  db: TenantContext,
  organisationId: string,
  userId: string,
  billId: string,
  input: AllocateSupplierBillInput
) {
  const existing = await db.supplierBill.findFirst({ where: { id: billId } });
  if (!existing) throw new NotFoundError("Supplier bill not found");

  const project = await db.project.findFirst({ where: { id: input.projectId } });
  if (!project) throw new NotFoundError("Project not found");
  if (input.poId) {
    const po = await db.purchaseOrder.findFirst({ where: { id: input.poId, projectId: input.projectId } });
    if (!po) throw new NotFoundError("Purchase order not found on this project");
  }

  const bill = await db.supplierBill.update({
    where: { id: billId },
    data: {
      projectId: input.projectId,
      poId: input.poId ?? existing.poId,
      supplierId: input.supplierId ?? existing.supplierId,
      allocationStatus: ALLOCATED,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "supplier_bill.allocate",
    entityType: "SupplierBill",
    entityId: bill.id,
    before: { allocationStatus: existing.allocationStatus, projectId: existing.projectId },
    after: { allocationStatus: ALLOCATED, projectId: input.projectId },
  });

  return bill;
}

export async function updateSupplierBillChecklist(
  db: TenantContext,
  organisationId: string,
  userId: string,
  billId: string,
  input: UpdateSupplierBillChecklistInput
) {
  const existing = await db.supplierBill.findFirst({ where: { id: billId } });
  if (!existing) throw new NotFoundError("Supplier bill not found");

  if (input.poId) {
    const po = await db.purchaseOrder.findFirst({ where: { id: input.poId, projectId: existing.projectId ?? undefined } });
    if (!po) throw new NotFoundError("Purchase order not found on this project");
  }

  // Auto-advance Received -> Under review the first time anyone touches the checklist.
  const nextStatus = existing.status === RECEIVED ? UNDER_REVIEW : existing.status;

  const bill = await db.supplierBill.update({
    where: { id: billId },
    data: {
      poId: input.poId,
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      amountExGst: input.amountExGst,
      gstAmount: input.gstAmount,
      amountIncGst: input.amountIncGst,
      orderedConfirmed: input.orderedConfirmed,
      receivedConfirmed: input.receivedConfirmed,
      quantityConfirmed: input.quantityConfirmed,
      priceConfirmed: input.priceConfirmed,
      reviewNote: input.reviewNote,
      status: nextStatus,
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: "supplier_bill.checklist_update",
    entityType: "SupplierBill",
    entityId: bill.id,
    after: {
      orderedConfirmed: bill.orderedConfirmed,
      receivedConfirmed: bill.receivedConfirmed,
      quantityConfirmed: bill.quantityConfirmed,
      priceConfirmed: bill.priceConfirmed,
    },
  });

  return bill;
}

async function recordDecision(
  db: TenantContext,
  organisationId: string,
  userId: string,
  billId: string,
  status: string,
  note: string | null
) {
  const existing = await db.supplierBill.findFirst({ where: { id: billId } });
  if (!existing) throw new NotFoundError("Supplier bill not found");

  const bill = await db.supplierBill.update({
    where: { id: billId },
    data: {
      status,
      reviewNote: note ?? existing.reviewNote,
      lastDecisionByUserId: userId,
      lastDecisionAt: new Date(),
    },
  });

  await auditLog({
    organisationId,
    userId,
    action: `supplier_bill.${status.toLowerCase().replace(/\s+/g, "_")}`,
    entityType: "SupplierBill",
    entityId: bill.id,
    before: { status: existing.status },
    after: { status, note },
  });

  return bill;
}

/** The approval gate: a bill can only be Approved once all four checklist items the PM ticks today are confirmed. */
export async function approveSupplierBill(db: TenantContext, organisationId: string, userId: string, billId: string) {
  const config = await loadFinanceConfig(organisationId);
  assertInList(APPROVED, config.billStatusList, "status");

  const existing = await db.supplierBill.findFirst({ where: { id: billId } });
  if (!existing) throw new NotFoundError("Supplier bill not found");
  if (!canApproveBill(existing)) {
    throw new BadRequestError(
      "All four checklist items (ordered, received, quantity, price) must be confirmed before a bill can be approved."
    );
  }

  return recordDecision(db, organisationId, userId, billId, APPROVED, null);
}

export async function querySupplierBill(db: TenantContext, organisationId: string, userId: string, billId: string, note: string) {
  return recordDecision(db, organisationId, userId, billId, QUERIED, note);
}

export async function rejectSupplierBill(db: TenantContext, organisationId: string, userId: string, billId: string, note: string) {
  return recordDecision(db, organisationId, userId, billId, REJECTED, note);
}

export async function markSupplierBillSentToEzzyBills(db: TenantContext, organisationId: string, userId: string, billId: string) {
  const existing = await db.supplierBill.findFirst({ where: { id: billId } });
  if (!existing) throw new NotFoundError("Supplier bill not found");
  if (!canMarkSentToEzzyBills(existing.status)) throw new BadRequestError('A bill must be Approved before it can be marked "Sent to EzzyBills".');
  return recordDecision(db, organisationId, userId, billId, SENT_TO_EZZYBILLS, null);
}

export async function markSupplierBillPaid(db: TenantContext, organisationId: string, userId: string, billId: string) {
  const existing = await db.supplierBill.findFirst({ where: { id: billId } });
  if (!existing) throw new NotFoundError("Supplier bill not found");
  if (!canMarkPaid(existing.status)) {
    throw new BadRequestError("A bill must be Approved (or sent to EzzyBills) before it can be marked Paid.");
  }
  return recordDecision(db, organisationId, userId, billId, PAID, null);
}

export async function markSupplierBillReconciled(db: TenantContext, organisationId: string, userId: string, billId: string) {
  const existing = await db.supplierBill.findFirst({ where: { id: billId } });
  if (!existing) throw new NotFoundError("Supplier bill not found");
  if (!canMarkReconciled(existing.status)) throw new BadRequestError("A bill must be Paid before it can be marked Reconciled.");
  return recordDecision(db, organisationId, userId, billId, RECONCILED, null);
}

/** Statuses counted as real, committed cost for cost-vs-budget — Received/Under review/Queried/Rejected bills aren't yet real spend. */
export const BILL_STATUSES_COUNTED_AS_COST = [APPROVED, SENT_TO_EZZYBILLS, PAID, RECONCILED];
