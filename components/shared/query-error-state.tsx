import { Button } from "@/components/ui/button";

/** Standard inline error-with-retry block for a failed query. Renders in place — never a redirect. */
export function QueryErrorState({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "Retrying..." : "Retry"}
      </Button>
    </div>
  );
}
