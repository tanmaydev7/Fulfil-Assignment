import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, RefreshCw, Pencil, Trash2, TestTube, Loader2, AlertCircle, CheckCircle2, XCircle, X } from "lucide-react";
import axios from "axios";
import { Table } from "@/src/components/table/table";
import type { MRT_ColumnDef } from "mantine-react-table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WebhookDialog } from "../components/WebhookDialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  last_response_code?: number;
  last_response_time?: number;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<Webhook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status_code?: number;
    response_time_ms?: number;
    error?: string;
  } | null>(null);

  const fetchWebhooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<{ message: Webhook[] }>(
        `${API_BASE_URL}/api/webhooks/`
      );
      setWebhooks(response.data.message);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to fetch webhooks");
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleAddWebhook = () => {
    setSelectedWebhook(null);
    setWebhookDialogOpen(true);
  };

  const handleEditWebhook = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setWebhookDialogOpen(true);
  };

  const handleDeleteClick = (webhook: Webhook) => {
    setWebhookToDelete(webhook);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!webhookToDelete) return;

    setDeleting(true);
    setError(null);

    try {
      await axios.delete(
        `${API_BASE_URL}/api/webhooks/${webhookToDelete.id}/`
      );

      setDeleteConfirmOpen(false);
      setWebhookToDelete(null);
      await fetchWebhooks();
    } catch (err: any) {
      const errorMessage =
        typeof err.response?.data?.message === 'string'
          ? err.response?.data?.message
          : err.response?.data?.message?.errors?.join(' ') || err.message || "Failed to delete webhook";
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleEnabled = async (webhook: Webhook) => {
    try {
      await axios.patch(
        `${API_BASE_URL}/api/webhooks/${webhook.id}/`,
        { enabled: !webhook.enabled }
      );
      await fetchWebhooks();
    } catch (err: any) {
      const errorMessage =
        typeof err.response?.data?.message === 'string'
          ? err.response?.data?.message
          : err.response?.data?.message?.errors?.join(' ') || err.message || "Failed to update webhook";
      setError(errorMessage);
    }
  };

  const handleTestWebhook = async (webhook: Webhook) => {
    setTestingWebhookId(webhook.id);
    setTestResult(null);
    setError(null);

    try {
      const response = await axios.post<{ message: any }>(
        `${API_BASE_URL}/api/webhooks/${webhook.id}/test/`
      );
      setTestResult({
        success: response.data.message.success,
        status_code: response.data.message.status_code,
        response_time_ms: response.data.message.response_time_ms,
      });
      await fetchWebhooks(); // Refresh to get updated last_triggered_at, etc.
    } catch (err: any) {
      const errorData = err.response?.data?.message;
      setTestResult({
        success: false,
        status_code: errorData?.status_code,
        response_time_ms: errorData?.response_time_ms,
        error: errorData?.error || err.message || "Failed to test webhook",
      });
    } finally {
      setTestingWebhookId(null);
    }
  };

  const getStatusBadge = (webhook: Webhook) => {
    if (!webhook.enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    if (!webhook.last_response_code) {
      return <Badge variant="outline">Never Triggered</Badge>;
    }
    if (webhook.last_response_code >= 200 && webhook.last_response_code < 300) {
      return <Badge className="bg-green-600">Success</Badge>;
    }
    return <Badge variant="destructive">Failed</Badge>;
  };

  const columns = useMemo<MRT_ColumnDef<Webhook>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        size: 200,
      },
      {
        accessorKey: "url",
        header: "URL",
        size: 300,
        Cell: ({ cell }) => {
          const url = cell.getValue<string>();
          return (
            <span className="text-sm font-mono text-muted-foreground truncate block max-w-[300px]">
              {url}
            </span>
          );
        },
      },
      {
        accessorKey: "event_types",
        header: "Event Types",
        size: 250,
        Cell: ({ cell }) => {
          const events = cell.getValue<string[]>();
          return (
            <div className="flex flex-wrap gap-1">
              {events.map((event, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {event}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: "enabled",
        header: "Status",
        size: 120,
        Cell: ({ row }) => {
          const webhook = row.original;
          return (
            <div className="flex items-center gap-2">
              {getStatusBadge(webhook)}
              <Switch
                checked={webhook.enabled}
                onCheckedChange={() => handleToggleEnabled(webhook)}
              />
            </div>
          );
        },
      },
      {
        accessorKey: "last_response_code",
        header: "Last Response",
        size: 150,
        Cell: ({ row }) => {
          const webhook = row.original;
          if (!webhook.last_response_code) {
            return <span className="text-muted-foreground text-sm">-</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${
                webhook.last_response_code >= 200 && webhook.last_response_code < 300
                  ? "text-green-600"
                  : "text-red-600"
              }`}>
                {webhook.last_response_code}
              </span>
              {webhook.last_response_time && (
                <span className="text-xs text-muted-foreground">
                  {webhook.last_response_time.toFixed(0)}ms
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "last_triggered_at",
        header: "Last Triggered",
        size: 180,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          if (!date) return <span className="text-muted-foreground text-sm">-</span>;
          return (
            <span className="text-sm">
              {new Date(date).toLocaleString()}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 150,
        Cell: ({ row }) => {
          const webhook = row.original;
          return (
            <div className="flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestWebhook(webhook)}
                      disabled={testingWebhookId === webhook.id}
                      className="h-7 w-7 p-0"
                    >
                      {testingWebhookId === webhook.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <TestTube className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Test Webhook</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditWebhook(webhook)}
                      className="h-7 w-7 p-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(webhook)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      },
    ],
    [testingWebhookId]
  );

  return (
    <div className="container mx-auto p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground mt-1">
            Configure and manage webhook endpoints
          </p>
        </div>
        <TooltipProvider>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchWebhooks}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" onClick={handleAddWebhook}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Webhook</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Test Result Display */}
      {testResult && (
        <div className={`mb-4 p-4 rounded-lg border ${
          testResult.success
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}>
          <div className="flex items-start gap-3">
            {testResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-medium mb-1">
                {testResult.success ? "Webhook Test Successful" : "Webhook Test Failed"}
              </div>
              <div className="text-sm space-y-1">
                {testResult.status_code && (
                  <div>
                    <span className="font-medium">Status Code:</span> {testResult.status_code}
                  </div>
                )}
                {testResult.response_time_ms !== undefined && (
                  <div>
                    <span className="font-medium">Response Time:</span> {testResult.response_time_ms.toFixed(0)}ms
                  </div>
                )}
                {testResult.error && (
                  <div>
                    <span className="font-medium">Error:</span> {testResult.error}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTestResult(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 rounded-lg border border-destructive bg-destructive/10">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-destructive mb-1">Error</div>
              <div className="text-sm text-destructive">{error}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Webhooks Table */}
      <div className="border rounded-lg overflow-hidden flex flex-col flex-1">
        {error && !testResult ? (
          <div className="p-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchWebhooks} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={webhooks}
            state={{
              isLoading: loading,
              density: 'xs',
            }}
            enableFilters={false}
            enableSorting={false}
            enableColumnResizing={true}
            enableColumnActions={false}
            mantinePaperProps={{
              sx: {
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                border: 'none !important'
              },
            }}
            mantineTableContainerProps={{ sx: { flex: 1, border: 'none !important' } }}
            key={webhooks.length}
          />
        )}
      </div>

      <WebhookDialog
        open={webhookDialogOpen}
        onOpenChange={setWebhookDialogOpen}
        webhook={selectedWebhook}
        onSuccess={fetchWebhooks}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {webhookToDelete && (
            <div className="py-4">
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Name:</span> {webhookToDelete.name}
                </div>
                <div className="text-sm">
                  <span className="font-medium">URL:</span> {webhookToDelete.url}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="whitespace-pre-wrap">{error}</div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setWebhookToDelete(null);
                setError(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

