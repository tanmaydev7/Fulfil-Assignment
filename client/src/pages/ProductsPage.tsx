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
import { Upload, RefreshCw, Plus, Pencil, Save, X, Trash2, AlertCircle, Loader2 } from "lucide-react";
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

const API_BASE_URL = process.env.BACKEND_URL || "http://localhost:8000";

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
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [inlineEditMode, setInlineEditMode] = useState(false);
  const [editedProducts, setEditedProducts] = useState<Map<number, Partial<Product>>>(new Map());
  const [editedCells, setEditedCells] = useState<Map<string, boolean>>(new Map()); // Track edited cells: "rowId-fieldName"
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<{ message: ProductsResponse }>(
        `${API_BASE_URL}/api/products/`,
        {
          params: {
            limit,
            offset,
          },
        }
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

  useEffect(() => {
    fetchProducts();
  }, [limit, offset]);

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
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setLimit(newPageSize);
    setOffset(0);
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

  return (
    <div className="container mx-auto p-6 h-screen max-h-screen flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product inventory
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={inlineEditMode ? "default" : "outline"}
            onClick={handleToggleInlineEdit}
            className={inlineEditMode ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {inlineEditMode ? "Exit Edit Mode" : "Inline Edit"}
          </Button>
          {inlineEditMode && editedProducts.size > 0 && (
            <Button
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Data ({editedProducts.size})
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={fetchProducts} disabled={loading || saving}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setAddProductDialogOpen(true)} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)} disabled={saving}>
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <div className="border rounded-lg overflow-hidden flex flex-col flex-1">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchProducts} variant="outline" className="mt-4">
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
            }}
            enableFilters={false}
            enableSorting={false}
            enableColumnResizing={true}
            enableColumnActions={false}
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
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            // Refresh products when dialog closes (in case upload was successful)
            fetchProducts();
          }
        }}
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
    </div>
  );
}

