import type { TenantContext } from "@/lib/tenant";
import { NotFoundError } from "@/lib/errors";
import { assertInList, loadFinanceConfig } from "./config";
import { formatDocumentNumber, nextCounterValue, purchaseOrderCounterScope } from "./numbering";
import { reconcilePoAgainstBills } from "./reconcile";
import { BILL_STATUSES_COUNTED_AS_COST } from "./bill-review-service";
import type { CreatePurchaseOrderInput, UpdatePurchaseOrderInput } from "@/lib/validations/purchase-order";

export async function createPurchaseOrder(
  db: TenantContext,
  organisationId: string,
  userId: string,
  projectId: string,
  input: CreatePurchaseOrderInput
) {
  const project = await db.project.findFirst({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project not found");

  const config = await loadFinanceConfig(organisationId);
  assertInList(input.status, config.poStatusList, "status");

  const sequence = await nextCounterValue(organisationId, purchaseOrderCounterScope(projectId));
  const number = formatDocumentNumber(config.poNumberPrefix, config.poNumberPadding, sequence);

  return db.purchaseOrder.create({
    data: {
      organisationId,
      projectId,
      supplierId: input.supplierId ?? null,
      number,
      itemsJson: input.itemsJson,
      value: input.value,
      expectedDate: input.expectedDate ?? null,
      status: input.status,
      createdByUserId: userId,
    },
  });
}

export async function updatePurchaseOrder(
  db: TenantContext,
  organisationId: string,
  poId: string,
  input: UpdatePurchaseOrderInput
) {
  const existing = await db.purchaseOrder.findFirst({ where: { id: poId } });
  if (!existing) throw new NotFoundError("Purchase order not found");

  if (input.status) {
    const config = await loadFinanceConfig(organisationId);
    assertInList(input.status, config.poStatusList, "status");
  }

  return db.purchaseOrder.update({
    where: { id: poId },
    data: {
      supplierId: input.supplierId,
      itemsJson: input.itemsJson,
      value: input.value,
      expectedDate: input.expectedDate,
      status: input.status,
    },
  });
}

/** Each PO row carries its reconcile result (total billed against it vs its value) — the PO↔bill reconcile the register surfaces. */
export async function listPurchaseOrders(db: TenantContext, organisationId: string, projectId: string) {
  const [purchaseOrders, config] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { projectId },
      include: {
        supplier: { select: { id: true, company: true } },
        bills: { where: { status: { in: BILL_STATUSES_COUNTED_AS_COST } }, select: { amountExGst: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    loadFinanceConfig(organisationId),
  ]);

  return purchaseOrders.map((po) => ({
    ...po,
    reconcile: reconcilePoAgainstBills(
      po.value,
      po.bills.map((b) => b.amountExGst),
      config.reconcileTolerancePct
    ),
  }));
}
