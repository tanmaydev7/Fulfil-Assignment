import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductUploadDialog } from "../components/ProductUploadDialog";
import { AddProductDialog } from "../components/AddProductDialog";
import { EditProductDialog } from "../components/EditProductDialog";
import { Upload, RefreshCw, Plus, Pencil, Save, X, Trash2, AlertCircle, Loader2, FileX, Search } from "lucide-react";
import axios from "axios";
import { Table, TruncatedCell } from "@/src/components/table/table";
import type { MRT_ColumnDef, MRT_Row } from "mantine-react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDebouncedCallback } from 'use-debounce'

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL

interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

interface ProductsResponse {
  count: number;
  limit: number;
  offset: number;
  results: Product[];
}

export default function ProductsPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [editProductDialogOpen, setEditProductDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteProcessingStatus, setDeleteProcessingStatus] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    sku: "",
    name: "",
    description: "",
    status: "",
  });
  const [inlineEditMode, setInlineEditMode] = useState(false);
  const [editedProducts, setEditedProducts] = useState<Map<number, Partial<Product>>>(new Map());
  const [editedCells, setEditedCells] = useState<Map<string, boolean>>(new Map()); // Track edited cells: "rowId-fieldName"
  const [saving, setSaving] = useState(false);

  const fetchProducts = async (lim?: number, off?: number, fil?: {sku: string, name: string, description: string, status: string}) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        limit: lim ?? limit,
        offset: off ?? offset,
      };
      const skuFilter = ((fil?.sku ?? filters?.sku ?? ""))?.trim()
      const descriptionFilter = ((fil?.description ?? filters?.description ?? ""))?.trim()
      const nameFilter = ((fil?.name ?? filters?.name ?? ""))?.trim()
      const statusFilter = ((fil?.status ?? filters?.status ?? ""))?.trim()

      // Add filters to params if they have values
      if (skuFilter) {
        params.sku = skuFilter
      }
      if (nameFilter) {
        params.name = nameFilter
      }
      if (descriptionFilter) {
        params.description = descriptionFilter
      }
      if (statusFilter !== "all") {
        params.status = statusFilter
      }
      
      const response = await axios.get<{ message: ProductsResponse }>(
        `${API_BASE_URL}/api/products/`,
        { params }
      );
      const data = response.data.message;
      setProducts(data.results);
      setTotalCount(data.count);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to fetch products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };


  const debounceFetchProducts = useDebouncedCallback((limit, offset, filters) => {
    fetchProducts(limit, offset, filters)
  }, 500)

  useEffect(() => {
    fetchProducts();
    // Clear selection when page changes
    setSelectedRowIds([]);
  }, []);

  const currentPage = Math.floor(offset / limit);
  const pageSize = limit;

  const handleCellChange = useCallback((row: MRT_Row<Product>, field: keyof Product, value: any) => {
    const productId = row.original.id;
    const originalValue = row.original[field];
    
    // Only track if value changed
    if (value === originalValue) {
      // Remove from edited if value matches original
      const cellKey = `${productId}-${field}`;
      setEditedCells((prev) => {
        const newMap = new Map(prev);
        newMap.delete(cellKey);
        return newMap;
      });
      
      setEditedProducts((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(productId);
        if (existing) {
          const updated = { ...existing };
          delete updated[field];
          if (Object.keys(updated).length === 0) {
            newMap.delete(productId);
          } else {
            newMap.set(productId, updated);
          }
        }
        return newMap;
      });
      return;
    }
    
    const cellKey = `${productId}-${field}`;
    
    // Mark cell as edited
    setEditedCells((prev) => {
      const newMap = new Map(prev);
      newMap.set(cellKey, true);
      return newMap;
    });
    
    // Update edited products
    setEditedProducts((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(productId) || {};
      newMap.set(productId, { ...existing, [field]: value });
      return newMap;
    });
  }, []);

  const handleSaveAll = async () => {
    if (editedProducts.size === 0) return;

    setSaving(true);
    setError(null);

    try {
      const updateOperations = Array.from(editedProducts.entries()).map(([id, updates]) => ({
        id,
        ...updates,
      }));

      await axios.patch(
        `${API_BASE_URL}/api/products/edit/`,
        { update_operations: updateOperations }
      );

      // Clear edited cells and products after successful save
      setEditedProducts(new Map());
      setEditedCells(new Map());
      
      // Refresh to get updated data
      await fetchProducts();
    } catch (err: any) {
      const errorMessage =
        typeof err.response?.data?.message === 'string'
        ? err.response?.data?.message : err.response?.data?.message?.errors.join(' ')
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleInlineEdit = () => {
    if (inlineEditMode) {
      // Clear all edits when disabling
      setEditedProducts(new Map());
      setEditedCells(new Map());
    }
    setInlineEditMode(!inlineEditMode);
  };

  const columns = useMemo<MRT_ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        size: 150,
        Cell: ({ cell, row }) => {
          const value = cell.getValue<string>();
          const productId = row.original.id;
          const cellKey = `${productId}-sku`;
          const isEdited = editedCells.has(cellKey);
          
          if (inlineEditMode) {
            return (
              <input
                type="text"
                defaultValue={value}
                className={`flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isEdited ? "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400" : ""
                }`}
                onChange={(e) => {
                  handleCellChange(row, "sku", e.target.value);
                }}
              />
            );
          }
          return (
            <span className={isEdited ? "bg-yellow-100 dark:bg-yellow-900/20 px-1 rounded" : ""}>
              {value}
            </span>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Name",
        size: 200,
        Cell: ({ cell, row }) => {
          const value = cell.getValue<string>();
          const productId = row.original.id;
          const cellKey = `${productId}-name`;
          const isEdited = editedCells.has(cellKey);
          
          if (inlineEditMode) {
            return (
              <input
                type="text"
                defaultValue={value}
                className={`flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isEdited ? "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400" : ""
                }`}
                onChange={(e) => {
                  handleCellChange(row, "name", e.target.value);
                }}
              />
            );
          }
          return (
            <div className={isEdited ? "bg-yellow-100 dark:bg-yellow-900/20 px-1 rounded inline-block" : ""}>
              {value ? <TruncatedCell>{value}</TruncatedCell> : <span className="text-muted-foreground">-</span>}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 300,
        Cell: ({ cell, row }) => {
          const value = cell.getValue<string>();
          const productId = row.original.id;
          const cellKey = `${productId}-description`;
          const isEdited = editedCells.has(cellKey);
          
          if (inlineEditMode) {
            return (
              <textarea
                defaultValue={value}
                rows={2}
                className={`flex min-h-[60px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isEdited ? "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400" : ""
                }`}
                onChange={(e) => {
                  handleCellChange(row, "description", e.target.value);
                }}
              />
            );
          }
          return (
            <div className={isEdited ? "bg-yellow-100 dark:bg-yellow-900/20 px-1 rounded inline-block" : ""}>
              {value ? <TruncatedCell>{value}</TruncatedCell> : <span className="text-muted-foreground">-</span>}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ cell, row }) => {
          const status = cell.getValue<"active" | "inactive">();
          const productId = row.original.id;
          const cellKey = `${productId}-status`;
          const isEdited = editedCells.has(cellKey);
          
          if (inlineEditMode) {
            return (
              <Select
                defaultValue={status}
                onValueChange={(value: "active" | "inactive") => {
                  handleCellChange(row, "status", value);
                }}
              >
                <SelectTrigger className={`w-full h-8 ${isEdited ? "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-400" : ""}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            );
          }
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                isEdited ? "ring-2 ring-yellow-400" : ""
              } ${status === "active"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Created At",
        size: 150,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return <span className="text-muted-foreground">{new Date(date).toLocaleDateString()}</span>;
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 120,
        Cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditProduct(product)}
                className="h-7 w-7 p-0"
                aria-label="Edit in dialog"
                title="Edit in dialog"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(product)}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Delete product"
                title="Delete product"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },
    ],
    [inlineEditMode, editedCells, handleCellChange]
  );

  const handlePageChange = (page: number) => {
    setOffset(page * limit);
    fetchProducts(limit, page * limit, filters)
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setLimit(newPageSize);
    setOffset(0);
    fetchProducts(newPageSize, 0, filters)
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditProductDialogOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    setDeleting(true);
    setError(null);

    try {
      await axios.delete(
        `${API_BASE_URL}/api/products/edit/`,
        { data: { id: productToDelete.id } }
      );

      // Close dialog and refresh products
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
      await fetchProducts();
    } catch (err: any) {
      const errorMessage =
        typeof err.response?.data?.message === 'string'
          ? err.response?.data?.message
          : err.response?.data?.message?.errors?.join(' ') || err.message || "Failed to delete product";
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteClick = (deleteAll: boolean) => {
    if (deleteAll) {
      // Delete all products in database - will send delete_all: true
      setSelectedRowIds([]); // Clear selection for delete all
    } else {
      // Delete selected rows
      if (selectedRowIds.length === 0) {
        setError("Please select at least one product to delete");
        return;
      }
    }
    setBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    const isDeleteAll = selectedRowIds.length === 0;

    setBulkDeleting(true);
    setError(null);
    setDeleteProcessingStatus("");

    try {
      const requestData = isDeleteAll 
        ? { delete_all: true }
        : { ids: selectedRowIds };

      const response = await axios.delete(
        `${API_BASE_URL}/api/products/edit/`,
        { data: requestData }
      );

      const result = response.data.message;

      // Check if async (has task_id) or sync
      if (result.task_id) {
        // Async processing (>= 100 rows)
        setDeleteTaskId(result.task_id);
        setDeleteProcessingStatus(`Processing ${result.total} products in background...`);
        // Don't close dialog yet, wait for task completion
      } else {
        // Sync processing (< 100 rows)
        setBulkDeleteConfirmOpen(false);
        setSelectedRowIds([]);
        await fetchProducts();
      }
    } catch (err: any) {
      const errorMessage =
        typeof err.response?.data?.message === 'string'
          ? err.response?.data?.message
          : err.response?.data?.message?.errors?.join(' ') || err.message || "Failed to delete products";
      setError(errorMessage);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Poll task status for async bulk delete
  useEffect(() => {
    if (deleteTaskId && bulkDeleteConfirmOpen) {
      let pollCount = 0;
      const maxPolls = 60; // Max 10 minutes (60 * 10 seconds)
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        if (pollCount > maxPolls) {
          setError("Processing took too long. Please check the server logs.");
          setBulkDeleting(false);
          clearInterval(pollInterval);
          return;
        }
        
        try {
          const response = await axios.get(
            `${API_BASE_URL}/api/tasks/${deleteTaskId}/status/`
          );
          const taskData = response.data.message;

          if (taskData.state === "SUCCESS") {
            setDeleteProcessingStatus("Deletion completed successfully!");
            setBulkDeleting(false);
            clearInterval(pollInterval);
            // Close dialog and refresh after a short delay
            setTimeout(async () => {
              setBulkDeleteConfirmOpen(false);
              setDeleteTaskId(null);
              setSelectedRowIds([]);
              await fetchProducts();
            }, 1500);
          } else if (taskData.state === "FAILURE") {
            const errorMsg = taskData.error || taskData.result?.error || "Deletion failed";
            setError(errorMsg);
            setBulkDeleting(false);
            clearInterval(pollInterval);
          } else {
            const statusMessages: Record<string, string> = {
              PENDING: "Waiting to start...",
              STARTED: "Deleting products in progress...",
              RETRY: "Retrying...",
            };
            setDeleteProcessingStatus(
              statusMessages[taskData.state] || `Processing... (${taskData.state})`
            );
          }
        } catch (err: any) {
          console.error("Error polling task status:", err);
          if (pollCount > 10) {
            setError("Unable to check task status. Please try again later.");
            setBulkDeleting(false);
            clearInterval(pollInterval);
          }
        }
      }, 10000); // Poll every 10 seconds

      return () => clearInterval(pollInterval);
    }
  }, [deleteTaskId, bulkDeleteConfirmOpen, limit, offset, filters]);

  return (
    <div className="container mx-auto p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product inventory
          </p>
        </div>
        <TooltipProvider>
        <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={inlineEditMode ? "default" : "outline"}
                  size="icon"
                  onClick={handleToggleInlineEdit}
                  className={inlineEditMode ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {inlineEditMode ? "Exit Edit Mode" : "Inline Edit"}
              </TooltipContent>
            </Tooltip>
            {inlineEditMode && editedProducts.size > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    onClick={handleSaveAll}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {saving ? "Saving..." : `Save Data (${editedProducts.size})`}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => fetchProducts()} 
                  disabled={loading || saving}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon"
                  onClick={() => setAddProductDialogOpen(true)} 
                  disabled={saving}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Product</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon"
                  variant="outline"
                  onClick={() => setUploadDialogOpen(true)} 
                  disabled={saving}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload CSV</TooltipContent>
            </Tooltip>
            {selectedRowIds.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleBulkDeleteClick(false)}
                    disabled={saving || bulkDeleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
          </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Delete Selected ({selectedRowIds.length})
                </TooltipContent>
              </Tooltip>
            )}
            {totalCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleBulkDeleteClick(true)}
                    disabled={saving || bulkDeleting || loading}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <FileX className="h-4 w-4" />
          </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Delete All ({totalCount})
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>

      {/* Filters */}
      <div className="mb-4 p-4 border rounded-lg bg-background">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label htmlFor="filter-sku" className="text-xs font-medium text-muted-foreground">
              SKU
            </label>
            <input
              id="filter-sku"
              type="text"
              value={filters.sku}
              onChange={(e) => {
                setOffset(0); // Reset to first page when filter changes
                setFilters((prev) => {
                  debounceFetchProducts(limit, 0, ({ ...prev, sku: e.target.value }))
                  return ({ ...prev, sku: e.target.value })
                });
              }}
              placeholder="Filter by SKU..."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="filter-name" className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <input
              id="filter-name"
              type="text"
              value={filters.name}
              onChange={(e) => {
                setOffset(0); // Reset to first page when filter changes
                setFilters((prev) => {
                  debounceFetchProducts(limit, 0, ({ ...prev, name: e.target.value }))
                  return ({ ...prev, name: e.target.value })
                });
              }}
              placeholder="Filter by name..."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="filter-description" className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <input
              id="filter-description"
              type="text"
              value={filters.description}
              onChange={(e) => {
                setOffset(0); // Reset to first page when filter changes
                setFilters((prev) => {
                  debounceFetchProducts(limit, 0, ({ ...prev, description: e.target.value }))
                  return ({ ...prev, description: e.target.value })
                });
              }}
              placeholder="Filter by description..."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="filter-status" className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select
              value={filters.status}
              onValueChange={(value) => {
                setOffset(0);
                setFilters((prev) => {
                  debounceFetchProducts(limit, 0, ({ ...prev, status: value }))
                  return ({ ...prev, status: value })
                });
              }}
            >
              <SelectTrigger id="filter-status" className="h-9 w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="gap-1 flex flex-col">
            <label htmlFor="" className="text-xs font-medium text-muted-foreground mb-1">
              &nbsp;
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({ sku: "", name: "", description: "", status: "" });
                setOffset(0);
                fetchProducts(limit, 0, { sku: "", name: "", description: "", status: "" })
              }}
              className="h-9"
              disabled={!(filters.sku || filters.name || filters.description || (filters.status && filters.status !== "all"))}
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filters
            </Button>
          </div>
        </div>
        
      </div>

      {/* Products Table */}
      <div className="border rounded-lg overflow-hidden flex flex-col flex-1">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => fetchProducts()} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={products}
            state={{
              isLoading: loading,
              density: 'xs',
              rowSelection: Object.fromEntries(selectedRowIds.map(id => [id.toString(), true])),
            }}
            enableFilters={false}
            enableSorting={false}
            enableColumnResizing={true}
            enableColumnActions={false}
            enableRowSelection={true}
            onRowSelectionChange={(updater) => {
              if (typeof updater === 'function') {
                const newSelection = updater(Object.fromEntries(selectedRowIds.map(id => [id.toString(), true])));
                const selectedIds = Object.keys(newSelection)
                  .filter(key => newSelection[key])
                  .map(key => parseInt(key));
                setSelectedRowIds(selectedIds);
              }
            }}
            getRowId={(row) => (row.id ?? '').toString()}
            pagination={{
              pageIndex: currentPage,
              pageSize: pageSize,
              totalCount: totalCount,
              onPageChange: handlePageChange,
              onPageSizeChange: handlePageSizeChange,
              isLoading: loading,
            }}
            mantinePaperProps={{
              sx: {
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                border: 'none !important'
              },
            }}
            mantineTableContainerProps={{ sx: { flex: 1 , border: 'none !important'} }}
            key={products.length}
          />
        )}
      </div>

      <AddProductDialog
        open={addProductDialogOpen}
        onOpenChange={setAddProductDialogOpen}
        onSuccess={fetchProducts}
      />

      <EditProductDialog
        open={editProductDialogOpen}
        onOpenChange={setEditProductDialogOpen}
        product={selectedProduct}
        onSuccess={fetchProducts}
      />

      <ProductUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={fetchProducts}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {productToDelete && (
            <div className="py-4">
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">SKU:</span> {productToDelete.sku}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Name:</span> {productToDelete.name}
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
                setProductToDelete(null);
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

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={(open) => {
        if (!open && !bulkDeleting) {
          setBulkDeleteConfirmOpen(false);
          setSelectedRowIds([]);
          setDeleteTaskId(null);
          setDeleteProcessingStatus("");
          setError(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Delete Products</DialogTitle>
            <DialogDescription>
              {selectedRowIds.length === 0 
                ? `Are you sure you want to delete ALL ${totalCount} product(s) in the database? This action cannot be undone.`
                : `Are you sure you want to delete ${selectedRowIds.length} selected product(s)? This action cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">Number of products to delete:</span> {selectedRowIds.length === 0 ? totalCount : selectedRowIds.length}
              </div>
              {(selectedRowIds.length === 0 ? totalCount : selectedRowIds.length) < 100 ? (
                <div className="flex items-start gap-2 text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">Immediate Processing</div>
                    <div className="text-blue-700 dark:text-blue-300">
                      Since you're deleting less than 100 products, the deletion will be processed immediately. You'll see the results right away.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <div className="font-medium text-amber-900 dark:text-amber-100 mb-1">Background Processing</div>
                    <div className="text-amber-700 dark:text-amber-300">
                      Since you're deleting 100 or more products, the deletion will be processed in the background. You can continue using the application while it processes. The dialog will show progress and close automatically when complete.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {deleteProcessingStatus && (
            <div className="flex items-start gap-2 text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
              {bulkDeleting ? (
                <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
              )}
              <div className="text-blue-700 dark:text-blue-300">{deleteProcessingStatus}</div>
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
                if (!bulkDeleting) {
                  setBulkDeleteConfirmOpen(false);
                  setSelectedRowIds([]);
                  setDeleteTaskId(null);
                  setDeleteProcessingStatus("");
                  setError(null);
                }
              }}
              disabled={bulkDeleting || !!deleteTaskId}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBulkDeleteConfirm}
              disabled={bulkDeleting || !!deleteTaskId}
            >
              {bulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {deleteTaskId ? "Processing..." : "Deleting..."}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedRowIds.length === 0 ? totalCount : selectedRowIds.length} Product(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

