import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import axios from "axios";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL

interface Webhook {
  id: number;
  url: string;
  name: string;
  event_types: string[];
  enabled: boolean;
  secret?: string;
  headers?: Record<string, string>;
  timeout: number;
  retry_count: number;
}

interface WebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: Webhook | null;
  onSuccess?: () => void;
}

interface WebhookFormData {
  url: string;
  name: string;
  event_types: string[];
  enabled: boolean;
  secret: string;
  headers: string; // JSON string for editing
  timeout: number;
  retry_count: number;
}

const EVENT_TYPES = [
  { value: 'product.created', label: 'Product Created' },
  { value: 'product.updated', label: 'Product Updated' },
  { value: 'product.deleted', label: 'Product Deleted' },
  { value: 'product.bulk_updated', label: 'Product Bulk Updated' },
  { value: 'product.bulk_deleted', label: 'Product Bulk Deleted' },
  { value: 'product.uploaded', label: 'Product Uploaded' },
];

export const WebhookDialog = ({ open, onOpenChange, webhook, onSuccess }: WebhookDialogProps) => {
  const [formData, setFormData] = useState<WebhookFormData>({
    url: "",
    name: "",
    event_types: [],
    enabled: true,
    secret: "",
    headers: "{}",
    timeout: 30,
    retry_count: 3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when dialog opens or webhook changes
  useEffect(() => {
    if (open) {
      if (webhook) {
        // Edit mode
        setFormData({
          url: webhook.url,
          name: webhook.name,
          event_types: webhook.event_types || [],
          enabled: webhook.enabled,
          secret: webhook.secret || "",
          headers: webhook.headers ? JSON.stringify(webhook.headers, null, 2) : "{}",
          timeout: webhook.timeout || 30,
          retry_count: webhook.retry_count || 3,
        });
      } else {
        // Add mode - reset to defaults
        setFormData({
          url: "",
          name: "",
          event_types: [],
          enabled: true,
          secret: "",
          headers: "{}",
          timeout: 30,
          retry_count: 3,
        });
      }
      setError(null);
    }
  }, [open, webhook]);

  const handleInputChange = (field: keyof WebhookFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (error) {
      setError(null);
    }
  };

  const handleEventTypeToggle = (eventType: string) => {
    setFormData((prev) => {
      const currentTypes = prev.event_types;
      if (currentTypes.includes(eventType)) {
        return {
          ...prev,
          event_types: currentTypes.filter((t) => t !== eventType),
        };
      } else {
        return {
          ...prev,
          event_types: [...currentTypes, eventType],
        };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate headers JSON
      let parsedHeaders = {};
      if (formData.headers.trim()) {
        try {
          parsedHeaders = JSON.parse(formData.headers);
        } catch (e) {
          setError("Headers must be valid JSON");
          setLoading(false);
          return;
        }
      }

      const payload = {
        url: formData.url,
        name: formData.name,
        event_types: formData.event_types,
        enabled: formData.enabled,
        secret: formData.secret || undefined,
        headers: parsedHeaders,
        timeout: formData.timeout,
        retry_count: formData.retry_count,
      };

      if (webhook) {
        // Update existing webhook
        await axios.patch(
          `${API_BASE_URL}/api/webhooks/${webhook.id}/`,
          payload
        );
      } else {
        // Create new webhook
        await axios.post(
          `${API_BASE_URL}/api/webhooks/`,
          payload
        );
      }

      // Success - close dialog and refresh webhooks
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        `Failed to ${webhook ? 'update' : 'create'} webhook`;
      
      // Handle validation errors
      if (err.response?.data?.message && typeof err.response.data.message === "object") {
        const validationErrors = Object.entries(err.response.data.message)
          .map(([field, messages]) => {
            const messageArray = Array.isArray(messages) ? messages : [messages];
            return `${field}: ${messageArray.join(", ")}`;
          })
          .join("\n");
        setError(validationErrors);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{webhook ? "Edit Webhook" : "Add New Webhook"}</DialogTitle>
          <DialogDescription>
            {webhook
              ? "Update the webhook configuration below."
              : "Configure a new webhook endpoint to receive product events."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="My Webhook"
              />
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="url">
                URL <span className="text-destructive">*</span>
              </Label>
              <input
                id="url"
                type="url"
                required
                value={formData.url}
                onChange={(e) => handleInputChange("url", e.target.value)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="https://example.com/webhook"
              />
            </div>

            {/* Event Types */}
            <div className="space-y-2">
              <Label>
                Event Types <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-2 border rounded-md p-3">
                {EVENT_TYPES.map((event) => (
                  <div key={event.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={event.value}
                      checked={formData.event_types.includes(event.value)}
                      onCheckedChange={() => handleEventTypeToggle(event.value)}
                      disabled={loading}
                    />
                    <Label
                      htmlFor={event.value}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {event.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Secret */}
            <div className="space-y-2">
              <Label htmlFor="secret">Secret (Optional)</Label>
              <input
                id="secret"
                type="password"
                value={formData.secret}
                onChange={(e) => handleInputChange("secret", e.target.value)}
                disabled={loading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Secret key for webhook signature"
              />
              <p className="text-xs text-muted-foreground">
                Used to generate HMAC-SHA256 signature for webhook verification
              </p>
            </div>

            {/* Headers */}
            <div className="space-y-2">
              <Label htmlFor="headers">Custom Headers (JSON)</Label>
              <textarea
                id="headers"
                value={formData.headers}
                onChange={(e) => handleInputChange("headers", e.target.value)}
                disabled={loading}
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder='{"Authorization": "Bearer token"}'
              />
              <p className="text-xs text-muted-foreground">
                JSON object with custom headers to include in webhook requests
              </p>
            </div>

            {/* Timeout and Retry Count */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <input
                  id="timeout"
                  type="number"
                  min="1"
                  max="300"
                  required
                  value={formData.timeout}
                  onChange={(e) => handleInputChange("timeout", parseInt(e.target.value))}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retry_count">Retry Count</Label>
                <input
                  id="retry_count"
                  type="number"
                  min="0"
                  max="10"
                  required
                  value={formData.retry_count}
                  onChange={(e) => handleInputChange("retry_count", parseInt(e.target.value))}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => handleInputChange("enabled", checked === true)}
                disabled={loading}
              />
              <Label htmlFor="enabled" className="text-sm font-normal cursor-pointer">
                Enable webhook
              </Label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="whitespace-pre-wrap">{error}</div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || formData.event_types.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {webhook ? "Updating..." : "Creating..."}
                </>
              ) : (
                webhook ? "Update Webhook" : "Create Webhook"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

