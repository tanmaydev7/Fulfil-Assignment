import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductUploadDialog } from "../components/ProductUploadDialog";
import { Upload } from "lucide-react";

export default function ProductsPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product inventory
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload CSV
        </Button>
      </div>

      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <p>Your products will appear here</p>
      </div>

      <ProductUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
    </div>
  );
}

