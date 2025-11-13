import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ProductUploadDialog } from "../components/ProductUploadDialog";
import { AddProductDialog } from "../components/AddProductDialog";
import { EditProductDialog } from "../components/EditProductDialog";
import { Upload, RefreshCw, Plus, Pencil } from "lucide-react";
import axios from "axios";
import { Table, TruncatedCell } from "@/src/components/table/table";
import type { MRT_ColumnDef } from "mantine-react-table";

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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

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

  const columns = useMemo<MRT_ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        size: 150,
      },
      {
        accessorKey: "name",
        header: "Name",
        size: 200,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value ? <TruncatedCell>{value}</TruncatedCell> : <span className="text-muted-foreground">-</span>;
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 300,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          return value ? <TruncatedCell>{value}</TruncatedCell> : <span className="text-muted-foreground">-</span>;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 120,
        Cell: ({ cell }) => {
          const status = cell.getValue<"active" | "inactive">();
          return (
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status === "active"
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
        size: 100,
        Cell: ({ row }) => {
          const product = row.original;
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditProduct(product)}
              className="h-8 w-8 p-0"
              aria-label="Edit product"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          );
        },
      },
    ],
    []
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
          <Button variant="outline" onClick={fetchProducts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setAddProductDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)}>
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
    </div>
  );
}

