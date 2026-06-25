import type { TenantContext } from "@/lib/tenant";
import { NotFoundError } from "@/lib/errors";
import { assertInList, loadFinanceConfig } from "./config";
import type { CreateDeliveryInput, UpdateDeliveryInput } from "@/lib/validations/delivery";

export async function createDelivery(
  db: TenantContext,
  organisationId: string,
  projectId: string,
  input: CreateDeliveryInput
) {
  const project = await db.project.findFirst({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project not found");

  if (input.poId) {
    const po = await db.purchaseOrder.findFirst({ where: { id: input.poId, projectId } });
    if (!po) throw new NotFoundError("Purchase order not found on this project");
  }

  const config = await loadFinanceConfig(organisationId);
  assertInList(input.status, config.deliveryStatusList, "status");

  return db.delivery.create({
    data: {
      organisationId,
      projectId,
      poId: input.poId ?? null,
      supplierId: input.supplierId ?? null,
      itemsJson: input.itemsJson,
      expectedDate: input.expectedDate ?? null,
      deliveredDate: input.deliveredDate ?? null,
      status: input.status,
    },
  });
}

export async function updateDelivery(
  db: TenantContext,
  organisationId: string,
  deliveryId: string,
  input: UpdateDeliveryInput
) {
  const existing = await db.delivery.findFirst({ where: { id: deliveryId } });
  if (!existing) throw new NotFoundError("Delivery not found");

  if (input.status) {
    const config = await loadFinanceConfig(organisationId);
    assertInList(input.status, config.deliveryStatusList, "status");
  }

  return db.delivery.update({
    where: { id: deliveryId },
    data: {
      poId: input.poId,
      supplierId: input.supplierId,
      itemsJson: input.itemsJson,
      expectedDate: input.expectedDate,
      deliveredDate: input.deliveredDate,
      status: input.status,
    },
  });
}

export async function listDeliveries(db: TenantContext, projectId: string) {
  return db.delivery.findMany({
    where: { projectId },
    include: { supplier: { select: { id: true, company: true } }, po: { select: { id: true, number: true } } },
    orderBy: { createdAt: "desc" },
  });
}
