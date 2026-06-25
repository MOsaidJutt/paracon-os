"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DeliveryItem = {
  id: string;
  status: string;
  itemsJson: { description: string }[];
  supplier: { id: string; company: string } | null;
};

export function DeliveryChecklist({
  deliveries,
  statusList,
  deliveryStatus,
  onSetStatus,
}: {
  deliveries: DeliveryItem[];
  statusList: string[];
  deliveryStatus: Record<string, string>;
  onSetStatus: (deliveryId: string, status: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Deliveries</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {deliveries.length === 0 && <p className="text-sm text-muted-foreground">No deliveries expected.</p>}
        {deliveries.map((delivery) => {
          const description = delivery.itemsJson.map((i) => i.description).join(", ") || "Delivery";
          const confirmed = deliveryStatus[delivery.id];
          return (
            <div key={delivery.id} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-foreground">
                {description}
                {delivery.supplier ? (
                  <span className="font-normal text-muted-foreground"> — {delivery.supplier.company}</span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {statusList.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={confirmed === status ? "default" : "outline"}
                    className="h-12 flex-1 min-w-[90px] text-base"
                    onClick={() => onSetStatus(delivery.id, status)}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
