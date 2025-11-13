import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
	isLoading?: boolean;
}

export function Pagination({
	currentPage,
	totalPages,
	totalItems,
	pageSize,
	onPageChange,
	onPageSizeChange,
	isLoading = false,
	footerRef
}: PaginationProps) {
	// Calculate the range of items being displayed
	const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
	const endItem = Math.min(currentPage * pageSize, totalItems);

	// Generate page numbers for pagination
	const getPageNumbers = () => {
		const pageNumbers = [];
		const maxPageButtons = 5; // Maximum number of page buttons to show

		let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
		const endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

		// Adjust if we're near the end
		if (endPage - startPage + 1 < maxPageButtons) {
			startPage = Math.max(1, endPage - maxPageButtons + 1);
		}

		for (let i = startPage; i <= endPage; i++) {
			pageNumbers.push(i);
		}

		return pageNumbers;
	};

	return (
		<div ref={footerRef} className="flex flex-col md:flex-row items-center justify-between px-4 py-4 border-t sticky bottom-0 bg-background w-full">
			<div className="flex items-center gap-2 mb-4 md:mb-0">
				<Select
					value={pageSize.toString()}
					onValueChange={value => onPageSizeChange(Number(value))}
					disabled={isLoading}
				>
					<SelectTrigger className="min-w-[100px] max-w-[150px] flex-1">
						<SelectValue placeholder="Page size" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="5">5 per page</SelectItem>
						<SelectItem value="10">10 per page</SelectItem>
						<SelectItem value="20">20 per page</SelectItem>
						<SelectItem value="50">50 per page</SelectItem>
						<SelectItem value="100">100 per page</SelectItem>
					</SelectContent>
				</Select>
				<span className="text-sm text-muted-foreground">
					{totalItems === 0 ? (
						"No items"
					) : (
						<>
							Showing {startItem} to {endItem} of {totalItems} items
							{totalPages > 0 && (
								<>
									{" "}
									(Page {currentPage} of {totalPages})
								</>
							)}
						</>
					)}
				</span>
			</div>
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					onClick={() => onPageChange(1)}
					disabled={currentPage === 1 || isLoading}
					className="h-8 w-8"
				>
					<ChevronsLeft className="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onPageChange(currentPage - 1)}
					disabled={currentPage === 1 || isLoading}
					className="h-8"
				>
					<ChevronLeft className="h-4 w-4 mr-1" />
					Previous
				</Button>

				{/* Page number buttons */}
				<div className="hidden md:flex">
					{getPageNumbers().map(pageNumber => (
						<Button
							key={pageNumber}
							variant={pageNumber === currentPage ? "default" : "outline"}
							size="sm"
							onClick={() => onPageChange(pageNumber)}
							disabled={isLoading || pageNumber === currentPage}
							className="h-8 w-8 mx-0.5 relative"
						>
							{pageNumber}
						</Button>
					))}
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() => onPageChange(currentPage + 1)}
					disabled={currentPage >= totalPages || isLoading}
					className="h-8"
				>
					Next <ChevronRight className="h-4 w-4 ml-1" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					onClick={() => onPageChange(totalPages)}
					disabled={currentPage >= totalPages || isLoading}
					className="h-8 w-8"
				>
					<ChevronsRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}